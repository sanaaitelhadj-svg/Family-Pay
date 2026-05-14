import { Router } from 'express';
import { MerchantService } from './merchant.service.js';
import { RegisterMerchantSchema, AdminRejectSchema, AdminActivateSchema } from './merchant.schema.js';
import { authenticate } from '../../middleware/authenticate.js';

export const merchantRouter = Router();

merchantRouter.post('/register', async (req, res, next) => {
  try {
    const data = RegisterMerchantSchema.parse(req.body);
    const otpResult = await MerchantService.register(data);
    res.status(201).json({ message: 'Inscription reçue. Vérifiez votre téléphone.', otp: otpResult });
  } catch (err) {
    next(err);
  }
});

merchantRouter.get('/pending', authenticate(['ADMIN']), async (_req, res, next) => {
  try {
    const merchants = await MerchantService.listPending();
    res.json(merchants);
  } catch (err) {
    next(err);
  }
});

merchantRouter.patch('/:id/approve', authenticate(['ADMIN']), async (req, res, next) => {
  try {
    await MerchantService.approve(req.params['id'] as string);
    res.json({ message: 'Marchand approuvé.' });
  } catch (err) {
    next(err);
  }
});

merchantRouter.patch('/:id/reject', authenticate(['ADMIN']), async (req, res, next) => {
  try {
    const data = AdminRejectSchema.parse(req.body);
    await MerchantService.reject(req.params['id'] as string, data);
    res.json({ message: 'Marchand refusé.' });
  } catch (err) {
    next(err);
  }
});

merchantRouter.patch('/:id/activate', authenticate(['ADMIN']), async (req, res, next) => {
  try {
    const data = AdminActivateSchema.parse(req.body);
    await MerchantService.activate(req.params['id'] as string, data);
    res.json({ message: 'Marchand activé.' });
  } catch (err) {
    next(err);
  }
});

merchantRouter.patch('/:id/suspend', authenticate(['ADMIN']), async (req, res, next) => {
  try {
    await MerchantService.suspend(req.params['id'] as string);
    res.json({ message: 'Marchand suspendu.' });
  } catch (err) {
    next(err);
  }
});
