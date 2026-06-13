import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma.js';
import { sendPasswordResetEmail } from '../../lib/email.js';
import { AuthService } from './auth.service.js';
import { authenticate } from '../../middleware/authenticate.js';
import { AddCardSchema,
  RegisterSponsorSchema,
  RegisterBeneficiarySchema,
  RegisterMerchantSchema,
  RequestOtpSchema,
  VerifyOtpSchema,
  RefreshTokenSchema,
} from './auth.schema.js';

export const authRouter = Router();

const wrap = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

authRouter.post('/sponsor/register', wrap(async (req, res) => {
  const input = RegisterSponsorSchema.parse(req.body);
  const result = await AuthService.registerSponsor(input);
  res.status(201).json(result);
}));

authRouter.post('/sponsor/login', wrap(async (req, res) => {
  const { phone } = RequestOtpSchema.parse({ ...req.body, purpose: 'LOGIN' });
  const result = await AuthService.loginSponsor(phone);
  res.json(result);
}));

authRouter.post('/beneficiary/register', wrap(async (req, res) => {
  const input = RegisterBeneficiarySchema.parse(req.body);
  const result = await AuthService.registerBeneficiary(input);
  res.status(201).json(result);
}));


authRouter.post('/merchant/check', wrap(async (req, res) => {
  const { prisma } = await import('../../lib/prisma.js');
  const { phone, email, businessName, city, address, category } = req.body;

  // Doublon nom commercial + ville + adresse + catégorie
  if (businessName && city && category) {
    const where: any = {
      businessName: { equals: businessName.trim(), mode: 'insensitive' },
      city:         { equals: city.trim(),         mode: 'insensitive' },
      category,
    };
    if (address) where.address = { equals: address.trim(), mode: 'insensitive' };
    const byName = await prisma.merchant.findFirst({ where });
    if (byName) {
      const loc = address ? `${city} — ${address}` : city;
      res.status(409).json({ field: 'businessName', message: `Un marchand "${businessName}" (${category}) existe déjà à ${loc}` }); return;
    }
  }

  // Doublon téléphone
  const byPhone = phone ? await prisma.user.findUnique({ where: { phone } }) : null;
  if (byPhone) { res.status(409).json({ field: 'phone', message: 'Ce numéro de téléphone est déjà utilisé' }); return; }

  // Doublon email
  const byEmail = email ? await prisma.user.findFirst({ where: { email: email.toLowerCase() } }) : null;
  if (byEmail) { res.status(409).json({ field: 'email', message: 'Cet email est déjà utilisé' }); return; }

  res.json({ available: true });
}));

authRouter.post('/merchant/register', wrap(async (req, res) => {
  const input = RegisterMerchantSchema.parse(req.body);
  const result = await AuthService.registerMerchant(input);
  res.status(201).json(result);
}));

authRouter.post('/verify-otp', wrap(async (req, res) => {
  const { phone, code, purpose } = VerifyOtpSchema.parse(req.body);
  const result = await AuthService.verifyOtpAndIssueTokens(phone, code, purpose);
  res.json(result);
}));

authRouter.post('/refresh', wrap(async (req, res) => {
  const { refreshToken } = RefreshTokenSchema.parse(req.body);
  const result = await AuthService.refresh(refreshToken);
  res.json(result);
}));

authRouter.post('/sponsor/invite', authenticate(['SPONSOR']), wrap(async (req, res) => {
  const result = await AuthService.createInvitation(req.user!.profileId);
  res.status(201).json(result);
}));

authRouter.post('/sponsor/add-card', authenticate(['SPONSOR']), wrap(async (req, res) => {
  const input = AddCardSchema.parse(req.body);
  const { prisma } = await import('../../lib/prisma.js');
  await prisma.sponsor.update({
    where: { id: req.user!.profileId },
    data: {
      maskedCardReference:  input.maskedCardReference,
      pspCustomerReference: input.pspCustomerReference,
    },
  });
  res.json({ message: 'Carte enregistrée avec succès.' });
}));

authRouter.post('/logout', authenticate(), wrap(async (req, res) => {
  const { refreshToken } = RefreshTokenSchema.parse(req.body);
  await AuthService.logout(refreshToken, req.user!.userId);
  res.json({ message: 'Déconnexion réussie' });
}));

authRouter.post('/admin/seed', wrap(async (req, res) => {
  const { setupToken } = req.body;
  await AuthService.seedAdmin(setupToken);
  res.status(201).json({ message: 'Admin créé.' });
}));

authRouter.post('/admin/login', wrap(async (req, res) => {
  const { email, password } = req.body;
  const ip        = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.socket?.remoteAddress ?? null;
  const userAgent = req.headers['user-agent'] ?? null;
  const result = await AuthService.loginAdmin(email, password, ip, userAgent);
  res.json(result);
}));

authRouter.post('/merchant/login', wrap(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'MISSING_FIELDS', message: 'Email et mot de passe requis' }); return;
  }
  const result = await AuthService.loginMerchantWithPassword(email.trim().toLowerCase(), password);
  res.json(result);
}));


authRouter.post('/merchant/forgot-password', wrap(async (req, res) => {
  const bcrypt = await import('bcryptjs');
  const { email } = req.body;
  if (!email) { res.status(400).json({ message: 'Email requis' }); return; }

  const user = await prisma.user.findFirst({
    where: { email: email.trim().toLowerCase(), role: 'PARTNER', isActive: true },
  });

  if (!user) { res.json({ message: 'Si ce compte existe, un email a été envoyé' }); return; }

  await prisma.otpCode.updateMany({
    where: { email: email.toLowerCase(), purpose: 'PASSWORD_RESET', usedAt: null },
    data:  { usedAt: new Date() },
  });

  const code     = Math.floor(100000 + Math.random() * 900000).toString();
  const codeHash = await bcrypt.hash(code, 10);

  await prisma.otpCode.create({
    data: {
      phone:     'email:' + email.toLowerCase(),
      email:     email.toLowerCase(),
      purpose:   'PASSWORD_RESET',
      codeHash,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  await sendPasswordResetEmail(email.trim(), code);
  res.json({ message: 'Si ce compte existe, un email a été envoyé' });
}));

authRouter.post('/merchant/reset-password', wrap(async (req, res) => {
  const bcrypt = await import('bcryptjs');
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    res.status(400).json({ message: 'Email, code OTP et nouveau mot de passe requis' }); return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ error: 'PASSWORD_TOO_SHORT', message: 'Le mot de passe doit contenir au moins 8 caractères' }); return;
  }

  const otpRecord = await prisma.otpCode.findFirst({
    where: { email: email.toLowerCase(), purpose: 'PASSWORD_RESET', usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });

  if (!otpRecord) {
    res.status(400).json({ error: 'OTP_INVALID', message: 'Code invalide ou expiré' }); return;
  }

  const valid = await bcrypt.compare(otp, otpRecord.codeHash);
  if (!valid) {
    res.status(400).json({ error: 'OTP_INVALID', message: 'Code incorrect' }); return;
  }

  await prisma.otpCode.update({ where: { id: otpRecord.id }, data: { usedAt: new Date() } });

  const user = await prisma.user.findFirst({ where: { email: email.toLowerCase(), role: 'PARTNER' } });
  if (!user) { res.status(404).json({ message: 'Compte introuvable' }); return; }

  // Vérifier les 6 derniers mots de passe
  const history = await prisma.passwordHistory.findMany({
    where:   { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take:    6,
  });

  for (const h of history) {
    const isSame = await bcrypt.compare(newPassword, h.passwordHash);
    if (isSame) {
      res.status(400).json({
        error:   'PASSWORD_REUSED',
        message: 'Ce mot de passe a déjà été utilisé récemment. Choisissez-en un nouveau.',
      }); return;
    }
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: user.id }, data: { password: newHash } });
  await prisma.passwordHistory.create({ data: { userId: user.id, passwordHash: newHash } });

  // Garder seulement les 10 derniers
  const allHistory = await prisma.passwordHistory.findMany({
    where:   { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });
  if (allHistory.length > 10) {
    await prisma.passwordHistory.deleteMany({
      where: { id: { in: allHistory.slice(10).map((h: any) => h.id) } },
    });
  }

  res.json({ message: 'Mot de passe réinitialisé avec succès ✅' });
}));

authRouter.post('/beneficiary/login', wrap(async (req, res) => {
  const { phone } = RequestOtpSchema.parse({ ...req.body, purpose: 'LOGIN' });
  const result = await AuthService.loginBeneficiary(phone);
  res.json(result);
}));
