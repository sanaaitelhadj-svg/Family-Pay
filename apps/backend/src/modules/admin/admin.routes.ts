import { Router } from 'express';
import { z } from 'zod';
import { AdminService } from './admin.service.js';
import { authenticate } from '../../middleware/authenticate.js';
import { prisma } from '../../lib/prisma.js';

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
adminRouter.get('/commissions', authenticate(['ADMIN']), async (req, res, next) => {
  try {
    const { merchantId, status } = req.query as Record<string, string>;
    res.json(await AdminService.getCommissions(merchantId, status));
  } catch (err) { next(err); }
});

adminRouter.get('/commissions/stats', authenticate(['ADMIN']), async (_req, res, next) => {
  try {
    res.json(await AdminService.getCommissionStats());
  } catch (err) { next(err); }
});

adminRouter.patch('/merchants/:id/commission', authenticate(['ADMIN']), async (req, res, next) => {
  try {
    const { commissionType, commissionRate } = req.body;
    res.json(await AdminService.updateMerchantCommission(req.params['id'] as string, commissionType, Number(commissionRate)));
  } catch (err) { next(err); }
});

adminRouter.get('/subscriptions', authenticate(['ADMIN']), async (req, res, next) => {
  try {
    const { entityType, status } = req.query as Record<string, string>;
    res.json(await AdminService.getSubscriptions(entityType, status));
  } catch (err) { next(err); }
});

adminRouter.post('/subscriptions', authenticate(['ADMIN']), async (req, res, next) => {
  try {
    res.json(await AdminService.createSubscription(req.body));
  } catch (err) { next(err); }
});

adminRouter.patch('/subscriptions/:id', authenticate(['ADMIN']), async (req, res, next) => {
  try {
    res.json(await AdminService.updateSubscription(req.params['id'] as string, req.body.status));
  } catch (err) { next(err); }
});
adminRouter.patch('/merchants/:id/contract', authenticate(['ADMIN']), async (req, res, next) => {
  try {
    const { contractUrl } = req.body;
    const merchant = await prisma.merchant.update({
      where: { id: req.params['id'] as string },
      data: { contractUrl },
    });
    res.json(merchant);
  } catch (err) { next(err); }
});

adminRouter.get('/merchants', authenticate(['ADMIN']), async (_req, res, next) => {
  try {
    const list = await AdminService.listMerchants();
    res.json(list);
  } catch (err) { next(err); }
});

adminRouter.patch('/merchants/:id/activate', authenticate(['ADMIN']), async (req, res, next) => {
  try {
    const schema = z.object({
      contractUrl:    z.string().url().optional(),
      billingType:    z.enum(['commission', 'subscription']),
      commissionType: z.string().optional(),
      commissionRate: z.number().positive().max(1).optional(),
      planId:         z.string().optional(),
      startDate:      z.string().optional(),
      endDate:        z.string().optional(),
    });
    const body = schema.parse(req.body);
    await AdminService.activateMerchant(req.params['id'] as string, body);
    res.json({ message: 'Marchand activé.' });
  } catch (err) { next(err); }
});

adminRouter.patch('/merchants/:id/reject', authenticate(['ADMIN']), async (req, res, next) => {
  try {
    const { reason } = z.object({ reason: z.string().min(5) }).parse(req.body);
    await AdminService.rejectMerchant(req.params['id'] as string, reason);
    res.json({ message: 'Marchand rejeté.' });
  } catch (err) { next(err); }
});

adminRouter.patch('/merchants/:id/status', authenticate(['ADMIN']), async (req, res, next) => {
  try {
    const { status } = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']) }).parse(req.body);
    await AdminService.setMerchantStatus(req.params['id'] as string, status);
    res.json({ message: 'Statut mis à jour.' });
  } catch (err) { next(err); }
});

adminRouter.get('/subscription-plans', authenticate(['ADMIN']), async (_req, res, next) => {
  try { res.json(await AdminService.listSubscriptionPlans()); }
  catch (err) { next(err); }
});

adminRouter.post('/subscription-plans', authenticate(['ADMIN']), async (req, res, next) => {
  try {
    const schema = z.object({
      name:           z.string().min(2),
      description:    z.string().optional(),
      price:          z.number().positive(),
      durationMonths: z.number().int().positive(),
      features:       z.any().optional(),
    });
    const plan = await AdminService.createSubscriptionPlan(schema.parse(req.body));
    res.status(201).json(plan);
  } catch (err) { next(err); }
});

adminRouter.patch('/subscription-plans/:id', authenticate(['ADMIN']), async (req, res, next) => {
  try {
    const schema = z.object({
      name:           z.string().min(2).optional(),
      description:    z.string().optional(),
      price:          z.number().positive().optional(),
      durationMonths: z.number().int().positive().optional(),
      features:       z.any().optional(),
      isActive:       z.boolean().optional(),
    });
    const plan = await AdminService.updateSubscriptionPlan(req.params['id'] as string, schema.parse(req.body));
    res.json(plan);
  } catch (err) { next(err); }
});

adminRouter.delete('/subscription-plans/:id', authenticate(['ADMIN']), async (req, res, next) => {
  try {
    await AdminService.updateSubscriptionPlan(req.params['id'] as string, { isActive: false });
    res.json({ message: 'Offre désactivée.' });
  } catch (err) { next(err); }
});

adminRouter.patch('/merchants/:id/billing', authenticate(['ADMIN']), async (req, res, next) => {
  try {
    const schema = z.object({
      contractUrl:    z.string().url().optional(),
      billingType:    z.enum(['commission', 'subscription']),
      commissionType: z.string().optional(),
      commissionRate: z.number().positive().max(1).optional(),
      planId:         z.string().optional(),
      startDate:      z.string().optional(),
      endDate:        z.string().optional(),
    });
    await AdminService.updateMerchantBilling(req.params['id'] as string, schema.parse(req.body));
    res.json({ message: 'Facturation mise à jour.' });
  } catch (err) { next(err); }
});

adminRouter.patch('/merchants/:id/info', authenticate(['ADMIN']), async (req, res, next) => {
  try {
    const schema = z.object({
      businessName:       z.string().min(2).optional(),
      city:               z.string().optional(),
      address:            z.string().optional(),
      pspMerchantReference: z.string().optional(),
      riskLevel:          z.string().optional(),
    });
    await AdminService.updateMerchantInfo(req.params['id'] as string, schema.parse(req.body));
    res.json({ message: 'Informations mises à jour.' });
  } catch (err) { next(err); }
});

