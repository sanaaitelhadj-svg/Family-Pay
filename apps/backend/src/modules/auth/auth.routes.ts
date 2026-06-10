import { Router, Request, Response, NextFunction } from 'express';
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

authRouter.post('/beneficiary/login', wrap(async (req, res) => {
  const { phone } = RequestOtpSchema.parse({ ...req.body, purpose: 'LOGIN' });
  const result = await AuthService.loginBeneficiary(phone);
  res.json(result);
}));
