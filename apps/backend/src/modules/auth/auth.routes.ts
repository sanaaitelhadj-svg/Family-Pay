import { Router, Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service.js';
import { authenticate } from '../../middleware/authenticate.js';
import {
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
  const result = await AuthService.loginAdmin(email, password);
  res.json(result);
}));

authRouter.post('/merchant/login', wrap(async (req, res) => {
  const { phone } = RequestOtpSchema.parse({ ...req.body, purpose: 'LOGIN' });
  const result = await AuthService.loginMerchant(phone);
  res.json(result);
}));
