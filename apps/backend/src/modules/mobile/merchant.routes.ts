import { Router, Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/authenticate.js';
import { AuthService } from '../auth/auth.service.js';
import { z } from 'zod';
import { sendExpoPush } from '../../lib/push.js';

const wrap = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

export function registerMerchantRoutes(mobileRouter: Router) {
mobileRouter.get('/merchant/stats', authenticate(['MERCHANT']), wrap(async (req, res) => {
  const merchantId = req.user!.profileId;
  const now  = new Date();
  const todayStart = new Date(now); todayStart.setHours(0,0,0,0);
  const weekStart  = new Date(now); weekStart.setDate(now.getDate() - 7);
  const monthStart = new Date(now); monthStart.setDate(1); monthStart.setHours(0,0,0,0);

  const [todayTx, weekTx, monthTx, merchant] = await Promise.all([
    prisma.transaction.findMany({ where: { merchantId, createdAt: { gte: todayStart }, status: 'COMPLETED' } }),
    prisma.transaction.findMany({ where: { merchantId, createdAt: { gte: weekStart },  status: 'COMPLETED' } }),
    prisma.transaction.findMany({ where: { merchantId, createdAt: { gte: monthStart }, status: 'COMPLETED' } }),
    prisma.merchant.findUnique({ where: { id: merchantId }, include: { user: true } }),
  ]);

  res.json({
    todayRevenue:  todayTx.reduce((s, t) => s + Number(t.amount), 0),
    todayCount:    todayTx.length,
    weekRevenue:   weekTx.reduce((s, t) => s + Number(t.amount), 0),
    monthRevenue:  monthTx.reduce((s, t) => s + Number(t.amount), 0),
    merchant,
  });
}));

// GET /mobile/merchant/transactions
mobileRouter.get('/merchant/transactions', authenticate(['MERCHANT']), wrap(async (req, res) => {
  const transactions = await prisma.transaction.findMany({
    where: { merchantId: req.user!.profileId },
    include: {
      authorization: {
        include: {
          allocation: true,
          beneficiary: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
      },
      sponsor: {
        include: {
          user:  { select: { firstName: true, lastName: true } },
          cards: { where: { isDefault: true }, take: 1 },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  res.json(transactions.map(t => {
    const card = t.sponsor?.cards?.[0];
    return {
      id:           t.id,
      amount:       Number(t.amount),
      category:     t.authorization?.allocation?.category ?? 'GENERAL',
      status:       t.status,
      createdAt:    t.createdAt,
      beneficiary:  `${t.authorization?.beneficiary?.user?.firstName ?? ''} ${t.authorization?.beneficiary?.user?.lastName ?? ''}`.trim(),
      sponsorName:  `${t.sponsor?.user?.firstName ?? ''} ${t.sponsor?.user?.lastName ?? ''}`.trim(),
      card:         card ? { brand: card.brand, maskedNumber: card.maskedNumber, cardHolder: card.cardHolder } : null,
    };
  }));
}));

// GET /mobile/sponsor/transactions
mobileRouter.get('/merchant/profile', authenticate(['MERCHANT']), wrap(async (req, res) => {
  const merchant = await prisma.merchant.findUnique({
    where: { id: req.user!.profileId },
    include: {
      user: { select: { firstName: true, lastName: true, phone: true, email: true, createdAt: true } },
      _count: { select: { transactions: true } },
    },
  });
  if (!merchant) { res.status(404).json({ error: 'Marchand introuvable' }); return; }

  const totalRevenue = await prisma.transaction.aggregate({
    where: { merchantId: merchant.id, status: 'COMPLETED' },
    _sum: { amount: true },
  });

  const lastRequest = await prisma.merchantChangeRequest.findFirst({
    where: { merchantId: merchant.id },
    orderBy: { createdAt: 'desc' },
  });

  res.json({
    ...merchant,
    acceptedCategories: [merchant.category],
    totalRevenue: Number(totalRevenue._sum?.amount ?? 0),
    pendingChangeRequest: lastRequest?.status === 'PENDING' ? lastRequest : null,
    lastChangeRequest: lastRequest ?? null,
  });
}));

// POST /mobile/merchant/change-request — soumettre une demande de modification
mobileRouter.post('/merchant/change-request', authenticate(['MERCHANT']), wrap(async (req, res) => {
  const merchantId = req.user!.profileId;
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant) { res.status(404).json({ error: 'Marchand introuvable' }); return;  }

  const existing = await prisma.merchantChangeRequest.findFirst({
    where: { merchantId, status: 'PENDING' },
  });
  if (existing) {
    res.status(409).json({ error: 'PENDING_REQUEST', message: "Une demande de modification est déjà en attente d'approbation." });
    return;
  }

  const allowed = ['businessName','address','city','phone','email','registrationNumber','iceNumber','taxId','fiscalId','cinRepresentant','rib','iban','contactAdmin','contactFinance','contactOps','contactLegal'];
  const changes: Record<string, any> = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) changes[key] = req.body[key];
  }
  if (Object.keys(changes).length === 0) {
    res.status(400).json({ error: 'NO_CHANGES', message: 'Aucune modification détectée.' });
    return;
  }

  const request = await prisma.merchantChangeRequest.create({
    data: { merchantId, changes, status: 'PENDING' },
  });

  await prisma.adminNotification.create({
    data: {
      type: 'CHANGE_REQUEST',
      title: 'Demande de modification',
      body: `Le marchand "${merchant.businessName}" a soumis une demande de modification.`,
      entityId: merchantId,
    },
  });

  res.status(201).json({ message: "Demande envoyée. En attente de validation par l'administrateur.", request });
}));

// Sponsor crée directement un compte bénéficiaire
mobileRouter.post('/merchant/qr/generate', authenticate(['MERCHANT']), wrap(async (req, res) => {
  const merchantId = req.user!.profileId;
  const { amount } = req.body;

  if (!amount || Number(amount) <= 0) {
    res.status(400).json({ error: 'INVALID_AMOUNT', message: 'Montant invalide' }); return;
  }

  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant) { res.status(404).json({ error: 'MERCHANT_NOT_FOUND' }); return; }

  const { randomUUID } = await import('crypto');
  const token     = randomUUID();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min

  await prisma.qrCode.create({
    data: { merchantId, category: merchant.category, amount: Number(amount), token, expiresAt },
  });

  res.json({ token, expiresAt, category: merchant.category, amount: Number(amount) });
}));

// ── Bénéficiaire: aperçu paiement (avant confirmation) ───────────────────
// GET /mobile/beneficiary/merchants — tous les marchands actifs/approuvés
}
