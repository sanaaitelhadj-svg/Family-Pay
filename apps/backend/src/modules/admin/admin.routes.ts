import * as bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from '../../middleware/requirePermission.js';
import { AdminService } from './admin.service.js';
import { authenticate } from '../../middleware/authenticate.js';
import { prisma } from '../../lib/prisma.js';
import { sessionMiddleware } from '../../middleware/sessionMiddleware.js';

export const adminRouter = Router();

adminRouter.use(sessionMiddleware);

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
  } catch (err) { next(err); return; }
});

adminRouter.get('/merchants', authenticate(['ADMIN']), async (req, res, next) => {
  try {
    const { kycStatus } = req.query as { kycStatus?: string };
    const merchants = await AdminService.listMerchants(kycStatus);
    res.json(merchants);
  } catch (err) { next(err); return; }
});

adminRouter.patch('/merchants/:id/approve', authenticate(['ADMIN']), async (req, res, next) => {
  try {
    await AdminService.approveMerchant(req.params['id'] as string);
    res.json({ message: 'Marchand approuvé.' });
  } catch (err) { next(err); return; }
});

adminRouter.patch('/merchants/:id/reject', authenticate(['ADMIN']), requirePermission('merchants', 'reject'), async (req, res, next) => {
  try {
    const { reason } = z.object({ reason: z.string().min(5) }).parse(req.body);
    await AdminService.rejectMerchant(req.params['id'] as string, reason);
    res.json({ message: 'Marchand rejeté.' });
  } catch (err) { next(err); return; }
});

adminRouter.get('/sponsors', authenticate(['ADMIN']), requirePermission('sponsors', 'read'), async (_req, res, next) => {
  try { res.json(await AdminService.getSponsors()); } catch (err) { next(err); return; }
});

adminRouter.get('/sponsors/:id', authenticate(['ADMIN']), async (req, res, next) => {
  try { res.json(await AdminService.getSponsor(req.params['id'] as string)); } catch (err) { next(err); return; }
});

adminRouter.get('/beneficiaries', authenticate(['ADMIN']), requirePermission('beneficiaries', 'read'), async (_req, res, next) => {
  try { res.json(await AdminService.getBeneficiaries()); } catch (err) { next(err); return; }
});

adminRouter.get('/beneficiaries/:id', authenticate(['ADMIN']), async (req, res, next) => {
  try { res.json(await AdminService.getBeneficiary(req.params['id'] as string)); } catch (err) { next(err); return; }
});

adminRouter.get('/transactions', authenticate(['ADMIN']), async (req, res, next) => {
  try {
    const { status } = req.query as { status?: string };
    res.json(await AdminService.getTransactions(status));
  } catch (err) { next(err); return; }
});

adminRouter.get('/audit-logs', authenticate(['ADMIN']), async (req, res, next) => {
  try {
    const page   = parseInt((req.query['page']   as string) ?? '1',  10);
    const limit  = parseInt((req.query['limit']  as string) ?? '50', 10);
    const action = (req.query['action'] as string) || undefined;
    const entity = (req.query['entity'] as string) || undefined;
    const result = (req.query['result'] as string) || undefined;
    const where: Record<string, unknown> = {};
    if (action) where['action']     = { contains: action, mode: 'insensitive' };
    if (entity) where['entityType'] = entity;
    if (result) where['result']     = result;
    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          admin: { select: { id: true, firstName: true, lastName: true, email: true, adminRole: { select: { name: true } } } },
        },
      }),
    ]);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.json({ total, page, limit, logs });
  } catch (err) { next(err); return; }
});
adminRouter.get('/commissions', authenticate(['ADMIN']), async (req, res, next) => {
  try {
    const { merchantId, status } = req.query as Record<string, string>;
    res.json(await AdminService.getCommissions(merchantId, status));
  } catch (err) { next(err); return; }
});

adminRouter.get('/commissions/stats', authenticate(['ADMIN']), async (_req, res, next) => {
  try {
    res.json(await AdminService.getCommissionStats());
  } catch (err) { next(err); return; }
});

adminRouter.patch('/merchants/:id/commission', authenticate(['ADMIN']), async (req, res, next) => {
  try {
    const u = (req as any).user;
    const actorId = u?.userId ?? u?.id ?? u?.sub;
    const { commissionType, commissionRate } = req.body;
    res.json(await AdminService.updateMerchantCommission(req.params['id'] as string, commissionType, Number(commissionRate), actorId));
  } catch (err) { next(err); return; }
});

adminRouter.get('/subscriptions', authenticate(['ADMIN']), async (req, res, next) => {
  try {
    const { entityType, status } = req.query as Record<string, string>;
    res.json(await AdminService.getSubscriptions(entityType, status));
  } catch (err) { next(err); return; }
});

adminRouter.post('/subscriptions', authenticate(['ADMIN']), async (req, res, next) => {
  try {
    res.json(await AdminService.createSubscription(req.body));
  } catch (err) { next(err); return; }
});

adminRouter.patch('/subscriptions/:id', authenticate(['ADMIN']), async (req, res, next) => {
  try {
    const u = (req as any).user;
    const actorId = u?.userId ?? u?.id ?? u?.sub;
    res.json(await AdminService.updateSubscription(req.params['id'] as string, req.body.status, actorId));
  } catch (err) { next(err); return; }
});
adminRouter.patch('/merchants/:id/contract', authenticate(['ADMIN']), async (req, res, next) => {
  try {
    const { contractUrl } = req.body;
    const merchant = await prisma.merchant.update({
      where: { id: req.params['id'] as string },
      data: { contractUrl },
    });
    res.json(merchant);
  } catch (err) { next(err); return; }
});

adminRouter.get('/merchants', authenticate(['ADMIN']), requirePermission('merchants', 'read'), async (_req, res, next) => {
  try {
    const list = await AdminService.listMerchants();
    res.json(list);
  } catch (err) { next(err); return; }
});

adminRouter.patch('/merchants/:id/activate', authenticate(['ADMIN']), requirePermission('merchants', 'approve'), async (req, res, next) => {
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
  } catch (err) { next(err); return; }
});

adminRouter.patch('/merchants/:id/reject', authenticate(['ADMIN']), requirePermission('merchants', 'reject'), async (req, res, next) => {
  try {
    const { reason } = z.object({ reason: z.string().min(5) }).parse(req.body);
    await AdminService.rejectMerchant(req.params['id'] as string, reason);
    res.json({ message: 'Marchand rejeté.' });
  } catch (err) { next(err); return; }
});

adminRouter.patch('/merchants/:id/status', authenticate(['ADMIN']), requirePermission('merchants', 'suspend'), async (req, res, next) => {
  try {
    const u = (req as any).user;
    const actorId = u?.userId ?? u?.id ?? u?.sub;
    const { status } = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']) }).parse(req.body);
    await AdminService.setMerchantStatus(req.params['id'] as string, status, actorId);
    res.json({ message: 'Statut mis à jour.' });
  } catch (err) { next(err); return; }
});

adminRouter.get('/subscription-plans', authenticate(['ADMIN']), requirePermission('subscriptions', 'read'), async (_req, res, next) => {
  try { res.json(await AdminService.listSubscriptionPlans()); }
  catch (err) { next(err); }
});

adminRouter.post('/subscription-plans', authenticate(['ADMIN']), requirePermission('subscriptions', 'add'), async (req, res, next) => {
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
  } catch (err) { next(err); return; }
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
  } catch (err) { next(err); return; }
});

adminRouter.delete('/subscription-plans/:id', authenticate(['ADMIN']), async (req, res, next) => {
  try {
    await AdminService.updateSubscriptionPlan(req.params['id'] as string, { isActive: false });
    res.json({ message: 'Offre désactivée.' });
  } catch (err) { next(err); return; }
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
  } catch (err) { next(err); return; }
});

adminRouter.patch('/merchants/:id/info', authenticate(['ADMIN']), async (req, res, next) => {
  try {
    const schema = z.object({
      businessName:          z.string().min(2).optional(),
      city:                  z.string().optional(),
      address:               z.string().optional(),
      gpsLat:                z.string().optional(),
      gpsLng:                z.string().optional(),
      pspMerchantReference:  z.string().optional(),
      riskLevel:             z.string().optional(),
      registrationNumber:    z.string().optional(),
      iceNumber:             z.string().optional(),
      taxId:                 z.string().optional(),
      fiscalId:              z.string().optional(),
      cinRepresentant:       z.string().optional(),
      rib:                   z.string().optional(),
      attestationBancaire:   z.string().optional(),
      contactAdmin:          z.any().optional(),
      contactFinance:        z.any().optional(),
      contactOps:            z.any().optional(),
      contactLegal:          z.any().optional(),
      contractUrl:           z.string().url().optional(),
    });
    const _u = (req as any).user; const _actorId = _u?.userId ?? _u?.id ?? _u?.sub;
    await AdminService.updateMerchantInfo(req.params['id'] as string, schema.parse(req.body), _actorId);
    res.json({ message: 'Informations mises à jour.' });
  } catch (err) { next(err); return; }
});

// ── Manual creation by admin ────────────────────────────────────────────────

adminRouter.post('/sponsors', authenticate(['ADMIN']), requirePermission('sponsors', 'add'), async (req, res, next) => {
  try {
    const schema = z.object({
      firstName:   z.string().min(2),
      lastName:    z.string().optional(),
      phone:       z.string().min(8),
      email:       z.string().email().optional(),
      password:    z.string().min(8),
    });
    const sponsor = await AdminService.createSponsor(schema.parse(req.body));
    res.status(201).json(sponsor);
  } catch (err) { next(err); return; }
});

adminRouter.post('/merchants/create', authenticate(['ADMIN']), requirePermission('merchants', 'add'), async (req, res, next) => {
  try {
    const schema = z.object({
      businessName:       z.string().min(2),
      category:          z.string(),
      city:              z.string(),
      phone:             z.string().min(8),
      password:          z.string().min(8),
      address:           z.string().optional(),
      registrationNumber: z.string().optional(),
      iceNumber:         z.string().optional(),
      activationStatus:  z.enum(['ACTIVE','INACTIVE']).default('INACTIVE'),
    });
    const merchant = await AdminService.createMerchantManual(schema.parse(req.body));
    res.status(201).json(merchant);
  } catch (err) { next(err); return; }
});

adminRouter.post('/beneficiaries', authenticate(['ADMIN']), requirePermission('beneficiaries', 'add'), async (req, res, next) => {
  try {
    const schema = z.object({
      firstName:    z.string().min(2),
      lastName:     z.string().optional(),
      phone:        z.string().min(8),
      password:     z.string().min(8),
      sponsorId:    z.string(),
      relationship: z.string().optional(),
    });
    const bene = await AdminService.createBeneficiary(schema.parse(req.body));
    res.status(201).json(bene);
  } catch (err) { next(err); return; }
});

// ── Admins management ───────────────────────────────────────────────────────

adminRouter.get('/admins', authenticate(['ADMIN']), requirePermission('admins', 'read'), async (_req, res, next) => {
  try { res.json(await AdminService.listAdmins()); }
  catch (err) { next(err); }
});

adminRouter.post('/admins', authenticate(['ADMIN']), requirePermission('admins', 'add'), async (req, res, next) => {
  try {
    const schema = z.object({
      firstName: z.string().min(2),
      lastName:  z.string().optional(),
      phone:     z.string().min(8),
      email:     z.string().email().optional(),
      password:  z.string().min(8),
    });
    const u = (req as any).user;
    const actorId = u?.userId ?? u?.id ?? u?.sub;
    const admin = await AdminService.createAdmin(schema.parse(req.body), actorId);
    res.status(201).json(admin);
  } catch (err) { next(err); return; }
});

adminRouter.patch('/admins/:id/status', authenticate(['ADMIN']), async (req, res, next) => {
  try {
    const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
    await AdminService.setAdminStatus(req.params['id'] as string, isActive);
    res.json({ message: 'Statut admin mis à jour.' });
  } catch (err) { next(err); return; }
});

// ──────────────────────────────────────────────────────────────────────────────
// RBAC — Admin Roles
// ──────────────────────────────────────────────────────────────────────────────
adminRouter.get('/roles', authenticate(['ADMIN']), async (_req, res, next) => {
  try {
    const roles = await AdminService.listRoles();
    res.json(roles);
  } catch (err) { next(err); return; }
});

adminRouter.post('/roles', authenticate(['ADMIN']), async (req, res, next) => {
  try {
    const schema = z.object({
      name:        z.string().min(2),
      description: z.string().optional(),
      permissions: z.record(z.any()),
    });
    const body = schema.parse(req.body);
    const role = await AdminService.createRole(body);
    res.status(201).json(role);
  } catch (err) { next(err); return; }
});

adminRouter.patch('/roles/:id', authenticate(['ADMIN']), async (req, res, next) => {
  try {
    const schema = z.object({
      name:        z.string().min(2).optional(),
      description: z.string().optional(),
      permissions: z.record(z.any()).optional(),
      isActive:    z.boolean().optional(),
    });
    const body = schema.parse(req.body);
    const role = await AdminService.updateRole(req.params['id'] as string, body);
    res.json(role);
  } catch (err) { next(err); return; }
});

adminRouter.delete('/roles/:id', authenticate(['ADMIN']), async (req, res, next) => {
  try {
    await AdminService.updateRole(req.params['id'] as string, { isActive: false });
    res.json({ message: 'Rôle désactivé.' });
  } catch (err) { next(err); return; }
});

adminRouter.patch('/admins/:id/role', authenticate(['ADMIN']), async (req, res, next) => {
  try {
    const { roleId } = z.object({ roleId: z.string().nullable() }).parse(req.body);
    await AdminService.assignRole(req.params['id'] as string, roleId);
    res.json({ message: 'Rôle assigné.' });
  } catch (err) { next(err); return; }
});

adminRouter.get('/me', authenticate(['ADMIN']), async (req, res, next) => {
  try {
    const u = (req as any).user;
    const uid = u?.userId ?? u?.id ?? u?.sub;
    const admin = await AdminService.getAdminMe(uid);
    res.json(admin);
  } catch (err) { next(err); return; }
});

adminRouter.patch('/admins/:id', authenticate(['ADMIN']), async (req, res, next) => {
  try {
    const schema = z.object({
      firstName: z.string().min(1).optional(),
      lastName:  z.string().optional(),
      phone:     z.string().optional(),
      email:     z.string().email().optional(),
      roleId:    z.string().nullable().optional(),
    });
    const body = schema.parse(req.body);
    await AdminService.updateAdmin(req.params['id'] as string, body);
    res.json({ message: 'Admin mis à jour.' });
  } catch (err) { next(err); return; }
});

adminRouter.delete('/admins/:id', authenticate(['ADMIN']), requirePermission('admins', 'delete'), async (req, res, next) => {
  try {
    await AdminService.deleteAdmin(req.params['id'] as string);
    res.json({ message: 'Admin supprimé.' });
  } catch (err) { next(err); return; }
});

// ── Sessions ──────────────────────────────────────────────────────────────────
adminRouter.get('/sessions', authenticate(['ADMIN']), async (_req, res, next) => {
  try {
    const sessions = await AdminService.listActiveSessions();
    res.json(sessions);
  } catch (err) { next(err); return; }
});

adminRouter.delete('/sessions/:id', authenticate(['ADMIN']), async (req, res, next) => {
  try {
    const u = (req as any).user;
    const revokedById = u?.userId ?? u?.id ?? u?.sub;
    await AdminService.revokeSession(req.params['id'] as string, revokedById);
    res.json({ message: 'Session révoquée.' });
  } catch (err) { next(err); return; }
});

// ── One-time role fixer (remove after use) ───────────────────────────────────

// ── Sponsors: edit / status / delete ─────────────────────────────────────────
adminRouter.patch('/sponsors/:id', authenticate(['ADMIN']), requirePermission('sponsors','write'), async (req, res, next) => {
  try {
    const u = (req as any).user; const actorId = u?.userId ?? u?.id;
    const { firstName, lastName, email } = req.body;
    const sponsor = await prisma.sponsor.findUnique({ where: { id: req.params['id'] as string }, select: { userId: true } });
    if (!sponsor) { res.status(404).json({ error: 'NOT_FOUND', message: 'Sponsor introuvable' }); return; }
    await prisma.user.update({ where: { id: sponsor.userId }, data: { firstName, lastName, email: email || undefined } });
    await prisma.auditLog.create({ data: { actorId, action: 'SPONSOR_UPDATED', result: 'SUCCESS', entityType: 'User', entityId: sponsor.userId, newData: { firstName, lastName, email } } });
    res.json({ message: 'Sponsor mis à jour' });
  } catch (err) { next(err); return; }
});

adminRouter.patch('/sponsors/:id/status', authenticate(['ADMIN']), requirePermission('sponsors','suspend'), async (req, res, next) => {
  try {
    const u = (req as any).user; const actorId = u?.userId ?? u?.id;
    const sponsor = await prisma.sponsor.findUnique({ where: { id: req.params['id'] as string }, include: { user: { select: { isActive: true } } } });
    if (!sponsor) { res.status(404).json({ error: 'NOT_FOUND', message: 'Sponsor introuvable' }); return; }
    const newIsActive = typeof req.body?.isActive === 'boolean' ? req.body.isActive : !sponsor.user.isActive;
    await prisma.user.update({ where: { id: sponsor.userId }, data: { isActive: newIsActive } });
    await prisma.auditLog.create({ data: { actorId, action: newIsActive ? 'SPONSOR_ACTIVATED' : 'SPONSOR_SUSPENDED', result: 'SUCCESS', entityType: 'Sponsor', entityId: req.params['id'] as string, metadata: { before: { isActive: sponsor.user.isActive }, after: { isActive: newIsActive } } as any } });
    res.json({ message: `Sponsor ${newIsActive ? 'activé' : 'suspendu'}`, isActive: newIsActive });
  } catch (err) { next(err); return; }
});

adminRouter.delete('/sponsors/:id', authenticate(['ADMIN']), requirePermission('sponsors','delete'), async (req, res, next) => {
  try {
    const u = (req as any).user; const actorId = u?.userId ?? u?.id;
    const sponsor = await prisma.sponsor.findUnique({ where: { id: req.params['id'] as string }, select: { userId: true } });
    if (!sponsor) { res.status(404).json({ error: 'NOT_FOUND', message: 'Sponsor introuvable' }); return; }
    await prisma.user.update({ where: { id: sponsor.userId }, data: { isActive: false } });
    await prisma.auditLog.create({ data: { actorId, action: 'SPONSOR_DELETED', result: 'SUCCESS', entityType: 'User', entityId: sponsor.userId } });
    res.json({ message: 'Sponsor désactivé' });
  } catch (err) { next(err); return; }
});

// ── Beneficiaries: edit / status / delete ────────────────────────────────────
adminRouter.patch('/beneficiaries/:id', authenticate(['ADMIN']), requirePermission('beneficiaries','write'), async (req, res, next) => {
  try {
    const u = (req as any).user; const actorId = u?.userId ?? u?.id;
    const { firstName, lastName, email } = req.body;
    const bene = await prisma.beneficiary.findUnique({ where: { id: req.params['id'] as string }, select: { userId: true } });
    if (!bene) { res.status(404).json({ error: 'NOT_FOUND', message: 'Bénéficiaire introuvable' }); return; }
    await prisma.user.update({ where: { id: bene.userId }, data: { firstName, lastName, email: email || undefined } });
    await prisma.auditLog.create({ data: { actorId, action: 'BENEFICIARY_UPDATED', result: 'SUCCESS', entityType: 'User', entityId: bene.userId, newData: { firstName, lastName, email } } });
    res.json({ message: 'Bénéficiaire mis à jour' });
  } catch (err) { next(err); return; }
});

adminRouter.patch('/beneficiaries/:id/status', authenticate(['ADMIN']), requirePermission('beneficiaries','suspend'), async (req, res, next) => {
  try {
    const u = (req as any).user; const actorId = u?.userId ?? u?.id;
    const bene = await prisma.beneficiary.findUnique({ where: { id: req.params['id'] as string }, include: { user: { select: { isActive: true } } } });
    if (!bene) { res.status(404).json({ error: 'NOT_FOUND', message: 'Bénéficiaire introuvable' }); return; }
    const newIsActive = !bene.user.isActive;
    await prisma.user.update({ where: { id: bene.userId }, data: { isActive: newIsActive } });
    await prisma.auditLog.create({ data: { actorId, action: newIsActive ? 'BENEFICIARY_ACTIVATED' : 'BENEFICIARY_SUSPENDED', result: 'SUCCESS', entityType: 'User', entityId: bene.userId, metadata: { before: { isActive: bene.user.isActive }, after: { isActive: newIsActive } } as any } });
    res.json({ message: `Bénéficiaire ${newIsActive ? 'activé' : 'suspendu'}`, isActive: newIsActive });
  } catch (err) { next(err); return; }
});

adminRouter.delete('/beneficiaries/:id', authenticate(['ADMIN']), requirePermission('beneficiaries','delete'), async (req, res, next) => {
  try {
    const u = (req as any).user; const actorId = u?.userId ?? u?.id;
    const bene = await prisma.beneficiary.findUnique({ where: { id: req.params['id'] as string }, select: { userId: true } });
    if (!bene) { res.status(404).json({ error: 'NOT_FOUND', message: 'Bénéficiaire introuvable' }); return; }
    await prisma.user.update({ where: { id: bene.userId }, data: { isActive: false } });
    await prisma.auditLog.create({ data: { actorId, action: 'BENEFICIARY_DELETED', result: 'SUCCESS', entityType: 'User', entityId: bene.userId } });
    res.json({ message: 'Bénéficiaire désactivé' });
  } catch (err) { next(err); return; }
});

adminRouter.post('/fix-roles', authenticate(['ADMIN']), async (_req, res, next) => {
  try {
    const ALL_PAGES = ['dashboard','merchants','sponsors','beneficiaries','transactions',
      'fraud','subscriptions','commissions','admins','roles','auditLogs'];
    const ALL_ACTIONS = ['*','add','edit','delete','suspend','approve','reject','assign-role','export'];
    const fullAccess = Object.fromEntries(ALL_PAGES.map(p => [p, { read: true, write: true,  actions: ALL_ACTIONS }]));
    const readOnly   = Object.fromEntries(ALL_PAGES.map(p => [p, { read: true, write: false, actions: [] }]));
    const financePerms = Object.fromEntries(ALL_PAGES.map(p => {
      if (['commissions','subscriptions'].includes(p)) return [p, { read: true, write: true,  actions: ['edit'] }];
      if (p === 'admins' || p === 'roles')             return [p, { read: false,write: false, actions: [] }];
      return [p, { read: true, write: false, actions: [] }];
    }));

    const roles = await prisma.adminRole.findMany({ select: { id: true, name: true } });
    for (const role of roles) {
      const name = role.name.toLowerCase().replace(/\s+/g, '-');
      let perms: unknown;
      if (name === 'super-admin' || name === 'super_admin')  perms = fullAccess;
      else if (name === 'finance')                           perms = financePerms;
      else                                                   perms = readOnly;
      await prisma.adminRole.update({ where: { id: role.id }, data: { permissions: perms as any } });
    }
    res.json({ message: `${roles.length} rôle(s) mis à jour`, roles: roles.map(r => r.name) });
  } catch (err) { next(err); return; }
});

// ──────────────────────────────────────────────────────────────────────────────
// PASSWORD RESET
// ──────────────────────────────────────────────────────────────────────────────

adminRouter.patch('/sponsors/:id/reset-password',
  authenticate(['ADMIN']), requirePermission('sponsors', 'write'),
  async (req, res, next) => {
    try {
      const id = req.params['id'] as string;
      const { newPassword } = req.body as { newPassword: string };
      if (!newPassword || newPassword.length < 6)
        return res.status(400).json({ error: 'Mot de passe trop court (min. 6 caractères)' });
      const sponsor = await prisma.sponsor.findUnique({ where: { id }, include: { user: true } });
      if (!sponsor) return res.status(404).json({ error: 'Non trouvé' });
      const hashed = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({ where: { id: sponsor.userId }, data: { password: hashed } });
      await prisma.auditLog.create({ data: {
        action: 'PASSWORD_RESET', entityType: 'Sponsor', entityId: id,
        actorId: (req as any).user?.userId ?? (req as any).user?.id,
        metadata: { target: sponsor.user.email, phone: sponsor.user.phone } as any,
      }});
      return res.json({ success: true });
    } catch (err) { next(err); return; }
  }
);

adminRouter.patch('/beneficiaries/:id/reset-password',
  authenticate(['ADMIN']), requirePermission('beneficiaries', 'write'),
  async (req, res, next) => {
    try {
      const id = req.params['id'] as string;
      const { newPassword } = req.body as { newPassword: string };
      if (!newPassword || newPassword.length < 6)
        return res.status(400).json({ error: 'Mot de passe trop court (min. 6 caractères)' });
      const ben = await prisma.beneficiary.findUnique({ where: { id }, include: { user: true } });
      if (!ben) return res.status(404).json({ error: 'Non trouvé' });
      const hashed = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({ where: { id: ben.userId }, data: { password: hashed } });
      await prisma.auditLog.create({ data: {
        action: 'PASSWORD_RESET', entityType: 'Beneficiary', entityId: id,
        actorId: (req as any).user?.userId ?? (req as any).user?.id,
        metadata: { target: ben.user.email, phone: ben.user.phone } as any,
      }});
      return res.json({ success: true });
    } catch (err) { next(err); return; }
  }
);

adminRouter.patch('/merchants/:id/reset-password',
  authenticate(['ADMIN']), requirePermission('merchants', 'write'),
  async (req, res, next) => {
    try {
      const id = req.params['id'] as string;
      const { newPassword } = req.body as { newPassword: string };
      if (!newPassword || newPassword.length < 6)
        return res.status(400).json({ error: 'Mot de passe trop court (min. 6 caractères)' });
      const merchant = await prisma.merchant.findUnique({ where: { id }, include: { user: true } });
      if (!merchant) return res.status(404).json({ error: 'Non trouvé' });
      const hashed = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({ where: { id: merchant.userId }, data: { password: hashed } });
      await prisma.auditLog.create({ data: {
        action: 'PASSWORD_RESET', entityType: 'Merchant', entityId: id,
        actorId: (req as any).user?.userId ?? (req as any).user?.id,
        metadata: { target: merchant.user.email, merchantName: merchant.businessName } as any,
      }});
      return res.json({ success: true });
    } catch (err) { next(err); return; }
  }
);

adminRouter.patch('/admins/:id/reset-password',
  authenticate(['ADMIN']), requirePermission('admins', 'write'),
  async (req, res, next) => {
    try {
      const id = req.params['id'] as string;
      const { newPassword } = req.body as { newPassword: string };
      if (!newPassword || newPassword.length < 6)
        return res.status(400).json({ error: 'Mot de passe trop court (min. 6 caractères)' });
      const admin = await prisma.user.findUnique({ where: { id } });
      if (!admin) return res.status(404).json({ error: 'Non trouvé' });
      const hashed = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({ where: { id }, data: { password: hashed } });
      await prisma.auditLog.create({ data: {
        action: 'PASSWORD_RESET', entityType: 'Admin', entityId: id,
        actorId: (req as any).user?.userId ?? (req as any).user?.id,
        metadata: { target: admin.email } as any,
      }});
      return res.json({ success: true });
    } catch (err) { next(err); return; }
  }
);
