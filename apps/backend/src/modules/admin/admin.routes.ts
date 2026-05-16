import { Router } from 'express';
import { z } from 'zod';
import { AdminService } from './admin.service.js';
import { authenticate } from '../../middleware/authenticate.js';

export const adminRouter = Router();

adminRouter.get('/fraud-review', authenticate(['ADMIN']), async (_req, res, next) => {
  try {
    const list = await AdminService.listPendingReview();
    res.json(list);
  } catch (err) {
    next(err);
  }
});

adminRouter.patch('/:id/approve', authenticate(['ADMIN']), async (req, res, next) => {
  try {
    await AdminService.approve(req.params['id'] as string);
    res.json({ message: 'Autorisation approuvée et transaction créée.' });
  } catch (err) {
    next(err);
  }
});

adminRouter.patch('/:id/reject', authenticate(['ADMIN']), async (req, res, next) => {
  try {
    const { reason } = z.object({ reason: z.string().min(5) }).parse(req.body);
    await AdminService.reject(req.params['id'] as string, reason);
    res.json({ message: 'Autorisation refusée.' });
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/stats', authenticate(['ADMIN']), async (_req, res, next) => {
  try {
    const stats = await AdminService.getStats();
    res.json(stats);
  } catch (err) { next(err); }
});

adminRouter.get('/merchants', authenticate(['ADMIN']), async (req, res, next) => {
  try {
    const { kycStatus } = req.query as { kycStatus?: string };
    const merchants = await AdminService.listMerchants(kycStatus);
    res.json(merchants);
  } catch (err) { next(err); }
});

adminRouter.patch('/merchants/:id/approve', authenticate(['ADMIN']), async (req, res, next) => {
  try {
    await AdminService.approveMerchant(req.params['id'] as string);
    res.json({ message: 'Marchand approuvé.' });
  } catch (err) { next(err); }
});

adminRouter.patch('/merchants/:id/reject', authenticate(['ADMIN']), async (req, res, next) => {
  try {
    const { reason } = z.object({ reason: z.string().min(5) }).parse(req.body);
    await AdminService.rejectMerchant(req.params['id'] as string, reason);
    res.json({ message: 'Marchand rejeté.' });
  } catch (err) { next(err); }
});

adminRouter.get('/sponsors', authenticate(['ADMIN']), async (_req, res, next) => {
  try { res.json(await AdminService.getSponsors()); } catch (err) { next(err); }
});

adminRouter.get('/sponsors/:id', authenticate(['ADMIN']), async (req, res, next) => {
  try { res.json(await AdminService.getSponsor(req.params['id'] as string)); } catch (err) { next(err); }
});

adminRouter.get('/beneficiaries', authenticate(['ADMIN']), async (_req, res, next) => {
  try { res.json(await AdminService.getBeneficiaries()); } catch (err) { next(err); }
});

adminRouter.get('/beneficiaries/:id', authenticate(['ADMIN']), async (req, res, next) => {
  try { res.json(await AdminService.getBeneficiary(req.params['id'] as string)); } catch (err) { next(err); }
});

adminRouter.get('/transactions', authenticate(['ADMIN']), async (req, res, next) => {
  try {
    const { status } = req.query as { status?: string };
    res.json(await AdminService.getTransactions(status));
  } catch (err) { next(err); }
});

adminRouter.get('/audit-logs', authenticate(['ADMIN']), async (req, res, next) => {
  try {
    const { action } = req.query as { action?: string };
    res.json(await AdminService.getAuditLogs(action));
  } catch (err) { next(err); }
});
