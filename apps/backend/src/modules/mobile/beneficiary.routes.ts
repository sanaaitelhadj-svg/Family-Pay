import { Router, Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/authenticate.js';
import { AuthService } from '../auth/auth.service.js';
import { z } from 'zod';
import { sendExpoPush } from '../../lib/push.js';

const wrap = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

export function registerBeneficiaryRoutes(mobileRouter: Router) {
mobileRouter.get('/beneficiary/allocations', authenticate(['BENEFICIARY']), wrap(async (req, res) => {
  const allocations = await prisma.allocation.findMany({
    where: { beneficiaryId: req.user!.profileId },
    include: { sponsor: { include: { user: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const result = allocations.map(a => ({
    id:              a.id,
    category:        a.category,
    limitAmount:     Number(a.limitAmount),
    remainingAmount: Number(a.remainingAmount),
    status:          a.status,
    requiresApproval: a.requiresApproval,
    expiresAt:       a.expiresAt,
    sponsor: {
      user: {
        firstName: a.sponsor.user.firstName,
        lastName:  a.sponsor.user.lastName ?? '',
      },
    },
  }));

  res.json(result);
}));

// GET /mobile/beneficiary/transactions
mobileRouter.get('/beneficiary/transactions', authenticate(['BENEFICIARY']), wrap(async (req, res) => {
  const transactions = await prisma.transaction.findMany({
    where: {
      authorization: { allocation: { beneficiaryId: req.user!.profileId } },
    },
    include: {
      merchant: { include: { user: true } },
      authorization: { include: { allocation: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const result = transactions.map(t => ({
    id:       t.id,
    amount:   Number(t.amount),
    category: t.authorization.allocation.category,
    status:   t.status,
    createdAt: t.createdAt,
    merchant: {
      businessName: t.merchant.businessName,
      user: { firstName: t.merchant.user.firstName, lastName: t.merchant.user.lastName ?? '' },
    },
  }));

  res.json(result);
}));

// GET /mobile/beneficiary/profile
mobileRouter.get('/beneficiary/profile', authenticate(['BENEFICIARY']), wrap(async (req, res) => {
  const beneficiary = await prisma.beneficiary.findUnique({
    where: { id: req.user!.profileId },
    include: {
      user: true,
      allocations: true,
      _count: { select: { allocations: true, authorizations: true } },
    },
  });
  if (!beneficiary) { res.status(404).json({ error: 'Bénéficiaire introuvable' }); return; }

  const totalReceived = beneficiary.allocations.reduce((s, a) => s + Number(a.limitAmount), 0);
  const totalSpent    = beneficiary.allocations.reduce((s, a) => s + (Number(a.limitAmount) - Number(a.remainingAmount)), 0);

  res.json({
    ...beneficiary,
    totalReceived,
    totalSpent,
    _count: { allocations: beneficiary._count.allocations, transactions: beneficiary._count.authorizations },
  });
}));

/* ═══════════════════════════════════════════════
   MERCHANT
══════════════════════════════════════════════════ */

// GET /mobile/merchant/stats
mobileRouter.post('/beneficiary/complete-onboarding', authenticate(['BENEFICIARY']), wrap(async (req, res) => {
  const { prisma } = await import('../../lib/prisma.js');
  const benef = await prisma.beneficiary.findUnique({ where: { id: req.user!.profileId } });
  if (!benef) { res.status(404).json({ message: 'Bénéficiaire introuvable' }); return; }
  await prisma.user.update({
    where: { id: benef.userId },
    data:  { isFirstLogin: false },
  });
  res.json({ message: 'Onboarding complété' });
}));

// ── Sponsor: allocations d'un bénéficiaire ─────────────────────────────────
// ── Sponsor: créer une allocation ────────────────────────────────────────

// GET /mobile/sponsor/merchants — liste marchands actifs par catégorie
mobileRouter.get('/beneficiary/merchants', authenticate(['BENEFICIARY']), wrap(async (req, res) => {
  const { category } = req.query as { category?: string };
  const where: any = { kycStatus: 'APPROVED', activationStatus: 'ACTIVE' };
  if (category) where.category = category;
  const merchants = await prisma.merchant.findMany({
    where,
    select: { id: true, businessName: true, category: true, city: true, address: true },
    orderBy: { businessName: 'asc' },
  });
  res.json(merchants);
}));

mobileRouter.post('/beneficiary/pay/preview', authenticate(['BENEFICIARY']), wrap(async (req, res) => {
  const { token } = req.body;
  const beneficiaryId = req.user!.profileId;

  const qr = await prisma.qrCode.findUnique({
    where: { token },
    include: { merchant: { include: { user: true } } },
  });
  if (!qr)          { res.status(404).json({ error: 'QR_NOT_FOUND',  message: 'QR code invalide' }); return; }
  if (qr.usedAt)    { res.status(400).json({ error: 'QR_USED',       message: 'QR code déjà utilisé' }); return; }
  if (new Date() > qr.expiresAt) { res.status(400).json({ error: 'QR_EXPIRED', message: 'QR code expiré' }); return; }

  const allocation = await prisma.allocation.findFirst({
    where: { beneficiaryId, category: qr.category, status: 'ACTIVE', remainingAmount: { gte: qr.amount } },
  });
  if (!allocation) {
    // Logger la tentative échouée dès la preview
    const anyAlloc = await prisma.allocation.findFirst({
      where: { beneficiaryId, category: qr.category },
      orderBy: { createdAt: 'desc' },
    });
    if (anyAlloc) {
      try {
        const { randomUUID } = await import('crypto');
        const failedAuth = await prisma.authorization.create({
          data: { allocationId: anyAlloc.id, beneficiaryId, merchantId: qr.merchantId, amount: qr.amount, status: 'REJECTED', rejectionReason: 'INSUFFICIENT_FUNDS' },
        });
        await prisma.transaction.create({
          data: { authorizationId: failedAuth.id, sponsorId: anyAlloc.sponsorId, merchantId: qr.merchantId, amount: qr.amount, pspTransactionId: randomUUID(), status: 'FAILED' },
        });
      } catch (err: any) { console.error('[preview:logFailed]', err?.message ?? err); }
    }
    res.status(403).json({ error: 'NO_ALLOCATION', message: `Aucune allocation active en ${qr.category} avec fonds suffisants` }); return;
  }

  // Vérifier si l'allocation est limitée à certains marchands
  const allowedIds = allocation.allowedMerchantIds as string[] | null;
  if (allowedIds && allowedIds.length > 0 && !allowedIds.includes(qr.merchantId)) {
    try {
      const { randomUUID } = await import('crypto');
      const failedAuth = await prisma.authorization.create({
        data: { allocationId: allocation.id, beneficiaryId, merchantId: qr.merchantId, amount: qr.amount, status: 'REJECTED', rejectionReason: 'MERCHANT_NOT_ALLOWED' },
      });
      await prisma.transaction.create({
        data: { authorizationId: failedAuth.id, sponsorId: allocation.sponsorId, merchantId: qr.merchantId, amount: qr.amount, pspTransactionId: randomUUID(), status: 'FAILED' },
      });
    } catch (err: any) { console.error('[preview:logFailed:merchant]', err?.message ?? err); }
    res.status(403).json({ error: 'MERCHANT_NOT_ALLOWED', message: `Ce marchand n'est pas autorisé par cette allocation.` }); return;
  }

  const merchantName = (qr.merchant as any).businessName
    ?? `${qr.merchant.user.firstName} ${qr.merchant.user.lastName ?? ''}`.trim();

  res.json({
    merchantName,
    category:         qr.category,
    amount:           Number(qr.amount),
    remainingAfter:   Number(allocation.remainingAmount) - Number(qr.amount),
    requiresApproval: allocation.requiresApproval,
    allocationId:     allocation.id,
  });
}));

// ── Bénéficiaire: confirmer le paiement ──────────────────────────────────
mobileRouter.post('/beneficiary/pay/confirm', authenticate(['BENEFICIARY']), wrap(async (req, res) => {
  const { token } = req.body;
  const beneficiaryId = req.user!.profileId;

  const qr = await prisma.qrCode.findUnique({ where: { token } });
  if (!qr)          { res.status(404).json({ error: 'QR_NOT_FOUND' }); return; }
  if (qr.usedAt)    { res.status(400).json({ error: 'QR_USED',     message: 'QR code déjà utilisé' }); return; }
  if (new Date() > qr.expiresAt) { res.status(400).json({ error: 'QR_EXPIRED', message: 'QR code expiré' }); return; }

  const { randomUUID } = await import('crypto');

  // Helper: créer authorization REJECTED + transaction FAILED (best-effort)
  const logFailed = async (allocationId: string, sponsorId: string, reason: string) => {
    try {
      const failedAuth = await prisma.authorization.create({
        data: { allocationId, beneficiaryId, merchantId: qr.merchantId, amount: qr.amount, status: 'REJECTED', rejectionReason: reason },
      });
      await prisma.transaction.create({
        data: { authorizationId: failedAuth.id, sponsorId, merchantId: qr.merchantId, amount: qr.amount, pspTransactionId: randomUUID(), status: 'FAILED' },
      });
    } catch (err: any) { console.error('[logFailed]', err?.message ?? err); }
  };

  const allocation = await prisma.allocation.findFirst({
    where: { beneficiaryId, category: qr.category, status: 'ACTIVE', remainingAmount: { gte: qr.amount } },
  });

  if (!allocation) {
    // Chercher n'importe quelle allocation de cette catégorie pour logger la tentative
    const anyAlloc = await prisma.allocation.findFirst({
      where: { beneficiaryId, category: qr.category },
      orderBy: { createdAt: 'desc' },
    });
    if (anyAlloc) await logFailed(anyAlloc.id, anyAlloc.sponsorId, 'INSUFFICIENT_FUNDS');
    res.status(403).json({ error: 'NO_ALLOCATION', message: 'Aucune allocation disponible' }); return;
  }

  // Vérifier marchands autorisés + logger si refus
  const allowedIds = allocation.allowedMerchantIds as string[] | null;
  if (allowedIds && allowedIds.length > 0 && !allowedIds.includes(qr.merchantId)) {
    await logFailed(allocation.id, allocation.sponsorId, 'MERCHANT_NOT_ALLOWED');
    res.status(403).json({ error: 'MERCHANT_NOT_ALLOWED', message: "Ce marchand n'est pas autorisé par cette allocation." }); return;
  }

  // Forcer approbation pour les mineurs même si l'allocation dit false
  const benefForMinorCheck = await prisma.beneficiary.findUnique({
    where: { id: beneficiaryId },
    select: { isMinor: true, dateOfBirth: true },
  });
  const calcIsMinorNow = (dob: Date | null): boolean => {
    if (!dob) return false;
    const today = new Date(); let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age < 18;
  };
  const isMinorBenef = benefForMinorCheck?.isMinor || calcIsMinorNow(benefForMinorCheck?.dateOfBirth ?? null);
  const needsApproval = allocation.requiresApproval || isMinorBenef;

  if (needsApproval) {
    const authorization = await prisma.authorization.create({
      data: { allocationId: allocation.id, beneficiaryId, merchantId: qr.merchantId, amount: qr.amount, status: 'PENDING_REVIEW' },
    });
    await prisma.qrCode.update({ where: { token }, data: { usedAt: new Date(), authorizationId: authorization.id } });

    // Notifier le sponsor
    try {
      const sponsorUser = await prisma.sponsor.findUnique({
        where: { id: allocation.sponsorId },
        include: { user: { select: { expoPushToken: true, firstName: true } } },
      });
      const benefUser = await prisma.beneficiary.findUnique({
        where: { id: beneficiaryId },
        include: { user: { select: { firstName: true } } },
      });
      if (sponsorUser?.user?.expoPushToken) {
        const merchant = await prisma.merchant.findUnique({ where: { id: qr.merchantId }, select: { businessName: true } });
        const benefName = benefUser?.user?.firstName ?? 'Un bénéficiaire';
        const merchantName = merchant?.businessName ?? 'un marchand';
        await sendExpoPush(
          sponsorUser.user.expoPushToken,
          "⏳ Paiement en attente d'approbation",
          `${benefName} souhaite payer ${Number(qr.amount).toLocaleString('fr-MA')} MAD chez ${merchantName}`,
          { type: 'PENDING_REVIEW', authorizationId: authorization.id }
        );
      }
    } catch (err: any) { console.error('[notif:pending]', err?.message); }

    res.json({ status: 'PENDING_REVIEW', message: "Paiement en attente d'approbation du sponsor", authorizationId: authorization.id });
    return;
  }

  // Auto-approve
  const authorization = await prisma.authorization.create({
    data: { allocationId: allocation.id, beneficiaryId, merchantId: qr.merchantId, amount: qr.amount, status: 'APPROVED' },
  });
  await prisma.transaction.create({
    data: {
      authorizationId:  authorization.id,
      sponsorId:        allocation.sponsorId,
      merchantId:       qr.merchantId,
      amount:           qr.amount,
      pspTransactionId: randomUUID(),
      status:           'COMPLETED',
    },
  });
  await prisma.allocation.update({
    where: { id: allocation.id },
    data:  { remainingAmount: { decrement: qr.amount } },
  });
  await prisma.qrCode.update({ where: { token }, data: { usedAt: new Date(), authorizationId: authorization.id } });

  // ── Vérification du seuil d'alerte ───────────────────────────────────────
  const updatedAlloc = await prisma.allocation.findUnique({ where: { id: allocation.id } });
  if (updatedAlloc?.thresholdValue && updatedAlloc.thresholdType) {
    const getPeriodStart = (period: string | null): Date | null => {
      if (!period || period === 'TOTAL') return null;
      const now = new Date();
      if (period === 'DAILY')      { return new Date(now.getFullYear(), now.getMonth(), now.getDate()); }
      if (period === 'MONTHLY')    { return new Date(now.getFullYear(), now.getMonth(), 1); }
      if (period === 'SEMIANNUAL') { const m = now.getMonth() < 6 ? 0 : 6; return new Date(now.getFullYear(), m, 1); }
      if (period === 'ANNUAL')     { return new Date(now.getFullYear(), 0, 1); }
      return null;
    };
    const periodStart = getPeriodStart(updatedAlloc.thresholdPeriod);
    const txWhere: any = { authorization: { allocationId: allocation.id }, status: 'COMPLETED' };
    if (periodStart) txWhere.createdAt = { gte: periodStart };
    const txs = await prisma.transaction.findMany({ where: txWhere });
    const spentInPeriod = txs.reduce((s: number, t: any) => s + Number(t.amount), 0);
    const thresholdAmount = updatedAlloc.thresholdType === 'PERCENT'
      ? (Number(updatedAlloc.limitAmount) * Number(updatedAlloc.thresholdValue)) / 100
      : Number(updatedAlloc.thresholdValue);
    if (spentInPeriod >= thresholdAmount) {
      const benef = await prisma.beneficiary.findUnique({ where: { id: allocation.beneficiaryId }, include: { user: true } });
      const periodLabel: Record<string, string> = { DAILY: 'journalier', MONTHLY: 'mensuel', SEMIANNUAL: 'semestriel', ANNUAL: 'annuel', TOTAL: 'global' };
      const pLabel = periodLabel[updatedAlloc.thresholdPeriod ?? 'TOTAL'] ?? 'global';
      const threshLabel = updatedAlloc.thresholdType === 'PERCENT' ? `${updatedAlloc.thresholdValue}%` : `${thresholdAmount} MAD`;
      const notifBody = `Seuil ${pLabel} de ${threshLabel} atteint pour ${benef?.user?.firstName ?? 'bénéficiaire'}`;
      await prisma.adminNotification.create({ data: { type: 'THRESHOLD_REACHED', title: '⚠️ Seuil atteint', body: notifBody, entityId: allocation.id } });
      if (updatedAlloc.thresholdAutoSuspend) {
        await prisma.allocation.update({ where: { id: allocation.id }, data: { status: 'PAUSED' } });
      }
    }
  }

  res.json({ status: 'COMPLETED', amount: Number(qr.amount), message: 'Paiement effectué avec succès ✅' });
}));


// ── Renouvellement manuel d'une allocation ────────────────────────────────
}
