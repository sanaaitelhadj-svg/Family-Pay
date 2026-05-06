import bcrypt from 'bcryptjs';
import { prismaAdmin, withTenant } from '../lib/prisma.js';
import {
  generateAccessToken,
  generateRefreshToken,
  storeRefreshToken,
  revokeRefreshToken,
  isRefreshTokenValid,
  verifyRefreshToken,
  TokenPayload,
} from './token.service.js';
import { FamilyPayError } from '../lib/errors.js';

export async function register(data: {
  email: string;
  password: string;
  role: 'PAYER' | 'BENEFICIARY' | 'PARTNER';
  firstName: string;
  lastName: string;
  tenantId: string;
  phone?: string;
}) {
  const existing = await prismaAdmin.user.findFirst({ where: { email: data.email } });
  if (existing) throw new FamilyPayError('EMAIL_ALREADY_EXISTS', 409, 'Email already in use');

  const passwordHash = await bcrypt.hash(data.password, 12);

  const user = await prismaAdmin.user.create({
    data: {
      tenantId: data.tenantId,
      email: data.email,
      phone: data.phone,
      passwordHash,
      role: data.role,
      firstName: data.firstName,
      lastName: data.lastName,
    },
    select: { id: true, email: true, role: true, tenantId: true, firstName: true, lastName: true },
  });

  const wallet = await prismaAdmin.wallet.create({
    data: { tenantId: data.tenantId, userId: user.id, balance: 0, currency: 'MAD' },
  });

  // Auto-créer le profil Partner si rôle PARTNER
  if (data.role === 'PARTNER') {
    await prismaAdmin.partner.create({
      data: {
        tenantId: data.tenantId,
        userId: user.id,
        walletId: wallet.id,
        businessName: `${data.firstName} ${data.lastName}`,
        category: 'general',
        isActive: true,
        isVerified: false,
      },
    });
  }

  const accessToken = generateAccessToken(user.id, user.tenantId, user.role);
  const { token: refreshToken, jti } = generateRefreshToken(user.id, user.tenantId, user.role);
  await storeRefreshToken(jti, user.id);

  return { user, accessToken, refreshToken };
}

export async function login(email: string, password: string) {
  const user = await prismaAdmin.user.findUnique({
    where: { email },
    select: {
      id: true, email: true, passwordHash: true, role: true, tenantId: true,
      firstName: true, lastName: true, isActive: true, kycStatus: true,
    },
  });

  if (!user || !user.passwordHash)
    throw new FamilyPayError('INVALID_CREDENTIALS', 401, 'Invalid email or password');
  if (!user.isActive)
    throw new FamilyPayError('ACCOUNT_DISABLED', 403, 'Account is disabled');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid)
    throw new FamilyPayError('INVALID_CREDENTIALS', 401, 'Invalid email or password');

  await prismaAdmin.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const accessToken = generateAccessToken(user.id, user.tenantId, user.role);
  const { token: refreshToken, jti } = generateRefreshToken(user.id, user.tenantId, user.role);
  await storeRefreshToken(jti, user.id);

  const { passwordHash: _, ...safeUser } = user;
  return { user: safeUser, accessToken, refreshToken };
}

export async function refresh(oldRefreshToken: string) {
  let payload: TokenPayload;
  try {
    payload = verifyRefreshToken(oldRefreshToken);
  } catch {
    throw new FamilyPayError('INVALID_REFRESH_TOKEN', 401, 'Invalid or expired refresh token');
  }

  const valid = await isRefreshTokenValid(payload.jti, payload.sub);
  if (!valid)
    throw new FamilyPayError('REFRESH_TOKEN_REVOKED', 401, 'Refresh token has been revoked');

  await revokeRefreshToken(payload.jti);

  const accessToken = generateAccessToken(payload.sub, payload.tenantId, payload.role);
  const { token: refreshToken, jti } = generateRefreshToken(payload.sub, payload.tenantId, payload.role);
  await storeRefreshToken(jti, payload.sub);

  return { accessToken, refreshToken };
}

export async function logout(userId: string, oldRefreshToken: string): Promise<void> {
  try {
    const payload = verifyRefreshToken(oldRefreshToken);
    await revokeRefreshToken(payload.jti);
  } catch {
    // Token déjà expiré — logout quand même
  }
}

export async function me(userId: string, tenantId: string) {
  return withTenant(tenantId, (tx) =>
    tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true, email: true, phone: true, role: true,
        firstName: true, lastName: true, avatarUrl: true,
        kycStatus: true, isMinor: true, twoFaEnabled: true, createdAt: true,
        wallet: { select: { id: true, balance: true, currency: true, frozen: true } },
      },
    }),
  );
}
