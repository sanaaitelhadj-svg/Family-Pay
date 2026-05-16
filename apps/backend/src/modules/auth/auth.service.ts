import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { OtpService } from './otp.service.js';
import { TokenService, JwtPayload } from './token.service.js';
import type {
  RegisterSponsorInput,
  RegisterBeneficiaryInput,
  RegisterMerchantInput,
} from './auth.schema.js';

export class AuthService {
  static async registerSponsor(input: RegisterSponsorInput): Promise<{ message: string; devOtp?: string }> {
    const existing = await prisma.user.findUnique({ where: { phone: input.phone } });
    if (existing) {
      throw new AppError('Ce numéro est déjà utilisé', 409, 'PHONE_ALREADY_EXISTS');
    }

    await prisma.user.create({
      data: {
        phone: input.phone,
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        role: 'SPONSOR',
        cndpConsentAt: new Date(),
        sponsor: { create: {} },
      },
    });

    await AuthService.createAuditLog(null, 'SPONSOR_REGISTERED', 'User', input.phone);

    const otp = await OtpService.requestOtp(input.phone, 'SIGNUP');
    return {
      message: 'Inscription en attente de vérification OTP',
      ...(process.env.NODE_ENV === 'development' && { devOtp: otp }),
    };
  }

  static async loginSponsor(phone: string): Promise<{ message: string; devOtp?: string }> {
    const user = await prisma.user.findUnique({ where: { phone, role: 'SPONSOR', isActive: true } });
    if (!user) {
      return { message: 'Code OTP envoyé si le compte existe' };
    }

    const otp = await OtpService.requestOtp(phone, 'LOGIN');
    return {
      message: 'Code OTP envoyé si le compte existe',
      ...(process.env.NODE_ENV === 'development' && { devOtp: otp }),
    };
  }

  static async registerBeneficiary(input: RegisterBeneficiaryInput): Promise<{ message: string; devOtp?: string }> {
    const sponsorId = await TokenService.validateInvitationToken(input.invitationToken);

    const sponsor = await prisma.sponsor.findUnique({ where: { id: sponsorId } });
    if (!sponsor) {
      throw new AppError("Sponsor introuvable", 400, 'SPONSOR_NOT_FOUND');
    }

    const existing = await prisma.user.findUnique({ where: { phone: input.phone } });
    if (existing) {
      throw new AppError('Ce numéro est déjà utilisé', 409, 'PHONE_ALREADY_EXISTS');
    }

    await prisma.user.create({
      data: {
        phone: input.phone,
        firstName: input.firstName,
        lastName: input.lastName,
        role: 'BENEFICIARY',
        cndpConsentAt: new Date(),
        beneficiary: {
          create: {
            sponsorId,
            isMinor: input.isMinor,
            parentalConsentAt: input.isMinor ? new Date() : null,
          },
        },
      },
    });

    await TokenService.consumeInvitationToken(input.invitationToken);
    await AuthService.createAuditLog(sponsorId, 'BENEFICIARY_REGISTERED', 'User', input.phone);

    const otp = await OtpService.requestOtp(input.phone, 'SIGNUP');
    return {
      message: 'Inscription en attente de vérification OTP',
      ...(process.env.NODE_ENV === 'development' && { devOtp: otp }),
    };
  }

  static async registerMerchant(input: RegisterMerchantInput): Promise<{ message: string; devOtp?: string }> {
    const existing = await prisma.user.findUnique({ where: { phone: input.phone } });
    if (existing) {
      throw new AppError('Ce numéro est déjà utilisé', 409, 'PHONE_ALREADY_EXISTS');
    }

    await prisma.user.create({
      data: {
        phone: input.phone,
        firstName: input.businessName,
        role: 'MERCHANT',
        cndpConsentAt: new Date(),
        merchant: {
          create: {
            businessName: input.businessName,
            category: input.category,
            address: input.address,
            city: input.city,
            phone: input.phone,
          },
        },
      },
    });

    await AuthService.createAuditLog(null, 'MERCHANT_REGISTERED', 'Merchant', input.phone);

    const otp = await OtpService.requestOtp(input.phone, 'SIGNUP');
    return {
      message: 'Inscription soumise — vérification OTP requise, puis validation ALTIVAX',
      ...(process.env.NODE_ENV === 'development' && { devOtp: otp }),
    };
  }

  static async verifyOtpAndIssueTokens(
    phone: string,
    code: string,
    purpose: 'SIGNUP' | 'LOGIN'
  ): Promise<{ accessToken: string; refreshToken: string; user: object }> {
    await OtpService.verifyOtp(phone, code, purpose);

    const user = await prisma.user.findUnique({
      where: { phone, isActive: true },
      include: { sponsor: true, beneficiary: true, merchant: true },
    });

    if (!user) {
      throw new AppError('Utilisateur introuvable', 404, 'USER_NOT_FOUND');
    }

    const profileId = user.sponsor?.id ?? user.beneficiary?.id ?? user.merchant?.id ?? '';

    if (!user.isVerified) {
      await prisma.user.update({ where: { id: user.id }, data: { isVerified: true } });
    }

    const payload: JwtPayload = {
      userId: user.id,
      role: user.role as JwtPayload['role'],
      profileId,
    };

    const accessToken = TokenService.issueAccessToken(payload);
    const refreshToken = await TokenService.issueRefreshToken(user.id);

    await AuthService.createAuditLog(user.id, purpose === 'SIGNUP' ? 'USER_VERIFIED' : 'USER_LOGGED_IN', 'User', user.id);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        profileId,
      },
    };
  }

  static async refresh(oldRefreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const { userId } = await TokenService.rotateRefreshToken(oldRefreshToken);

    const user = await prisma.user.findUnique({
      where: { id: userId, isActive: true },
      include: { sponsor: true, beneficiary: true, merchant: true },
    });

    if (!user) {
      throw new AppError('Utilisateur introuvable', 404, 'USER_NOT_FOUND');
    }

    const profileId = user.sponsor?.id ?? user.beneficiary?.id ?? user.merchant?.id ?? '';

    const payload: JwtPayload = {
      userId: user.id,
      role: user.role as JwtPayload['role'],
      profileId,
    };

    const accessToken = TokenService.issueAccessToken(payload);
    const refreshToken = await TokenService.issueRefreshToken(user.id);

    return { accessToken, refreshToken };
  }

  static async createInvitation(sponsorId: string): Promise<{ invitationToken: string; invitationUrl: string }> {
    const sponsor = await prisma.sponsor.findUnique({ where: { id: sponsorId } });
    if (!sponsor) {
      throw new AppError('Sponsor introuvable', 404, 'SPONSOR_NOT_FOUND');
    }

    const token = await TokenService.issueInvitationToken(sponsorId);
    const invitationUrl = `${process.env.APP_URL ?? 'https://familypay.altivax.com'}/join/${token}`;

    await AuthService.createAuditLog(sponsorId, 'INVITATION_CREATED', 'Sponsor', sponsorId);

    return { invitationToken: token, invitationUrl };
  }

  static async logout(refreshToken: string, userId: string): Promise<void> {
    await TokenService.revokeRefreshToken(refreshToken);
    await AuthService.createAuditLog(userId, 'USER_LOGGED_OUT', 'User', userId);
  }

  private static async createAuditLog(
    actorId: string | null,
    action: string,
    entityType: string,
    entityId: string
  ): Promise<void> {
    await prisma.auditLog.create({
      data: { actorId, action, entityType, entityId, metadata: {} },
    });
  }
  static async seedAdmin(setupToken: string): Promise<void> {
    const expected = process.env.ADMIN_SETUP_TOKEN;
    if (!expected || setupToken !== expected) {
      throw new AppError('Token invalide', 403, 'FORBIDDEN');
    }
    // Ensure password column exists (Railway migration fallback)
    await prisma.$executeRaw`ALTER TABLE users ADD COLUMN IF NOT EXISTS password TEXT`;

    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) throw new AppError('ADMIN_EMAIL/ADMIN_PASSWORD manquants', 500, 'CONFIG_ERROR');

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new AppError('Admin déjà existant', 409, 'ALREADY_EXISTS');

    const hashed = await bcrypt.hash(password, 12);
    await prisma.user.create({
      data: {
        phone: 'ADMIN',
        firstName: 'Admin',
        email,
        password: hashed,
        role: 'ADMIN',
        isVerified: true,
        cndpConsentAt: new Date(),
      },
    });
  }

  static async loginAdmin(email: string, password: string): Promise<{ accessToken: string; refreshToken: string; user: object }> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.role !== 'ADMIN' || !user.password) {
      throw new AppError('Identifiants invalides', 401, 'INVALID_CREDENTIALS');
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new AppError('Identifiants invalides', 401, 'INVALID_CREDENTIALS');

    const accessToken = TokenService.issueAccessToken({ userId: user.id, role: user.role, profileId: '' });
    const refreshToken = await TokenService.issueRefreshToken(user.id);
    return { accessToken, refreshToken, user: { id: user.id, email: user.email, role: user.role, firstName: user.firstName } };
  }

  static async loginMerchant(phone: string): Promise<{ message: string }> {
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user || user.role !== 'MERCHANT') {
      return { message: 'Code OTP envoyé si le compte existe' };
    }
    await OtpService.requestOtp(phone, 'LOGIN');
    return { message: 'Code OTP envoyé si le compte existe' };
  }

  static async loginBeneficiary(phone: string): Promise<{ message: string }> {
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user || user.role !== 'BENEFICIARY') {
      return { message: 'Code OTP envoyé si le compte existe' };
    }
    await OtpService.requestOtp(phone, 'LOGIN');
    return { message: 'Code OTP envoyé si le compte existe' };
  }

}
