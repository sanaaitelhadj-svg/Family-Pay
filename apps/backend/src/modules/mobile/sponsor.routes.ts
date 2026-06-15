import { Router, Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/authenticate.js';
import { AuthService } from '../auth/auth.service.js';
import { z } from 'zod';
import { sendExpoPush } from '../../lib/push.js';

const wrap = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

export function registerSponsorRoutes(mobileRouter: Router) {
mobileRouter.get('/sponsor/beneficiaries', authenticate(['SPONSOR']), wrap(async (req, res) => {
  const sponsorId = req.user!.profileId;
  const beneficiaries = await prisma.beneficiary.findMany({
    where: { sponsorId },
    include: {
      user: true,
      allocations: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const result = beneficiaries.map(b => {
    const totalAllocated = b.allocations.reduce((s, a) => s + Number(a.limitAmount), 0);
    const totalSpent     = b.allocations.reduce((s, a) => s + (Number(a.limitAmount) - Number(a.remainingAmount)), 0);
    const activeAllocations = b.allocations.filter(a => a.status === 'ACTIVE').length;
    return {
      id: b.id,
      user: {
        firstName: b.user.firstName,
        lastName:  b.user.lastName ?? '',
        phone:     b.user.phone,
      },
      totalAllocated,
      totalSpent,
      activeAllocations,
      isActive:     b.isActive,
      isMinor:      b.dateOfBirth ? (() => { const d = new Date(b.dateOfBirth!); const today = new Date(); let age = today.getFullYear() - d.getFullYear(); const m = today.getMonth() - d.getMonth(); if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--; return age < 18; })() : false,
      relationship: b.relationship ?? null,
      dateOfBirth:  b.dateOfBirth ?? null,
      createdAt: b.createdAt,
    };
  });

  res.json(result);
}));

// GET /mobile/sponsor/profile
mobileRouter.get('/sponsor/profile', authenticate(['SPONSOR']), wrap(async (req, res) => {
  const sponsor = await prisma.sponsor.findUnique({
    where: { id: req.user!.profileId },
    include: {
      user: true,
      _count: { select: { allocations: true, beneficiaries: true } },
    },
  });
  if (!sponsor) { res.status(404).json({ error: 'Sponsor introuvable' }); return; }
  res.json(sponsor);
}));

// GET /mobile/sponsor/dashboard
mobileRouter.get('/sponsor/dashboard', authenticate(['SPONSOR']), wrap(async (req, res) => {
  const sponsorId = req.user!.profileId;
  const allocations = await prisma.allocation.findMany({
    where: { sponsorId },
    include: { beneficiary: { include: { user: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const active = allocations.filter(a => a.status === 'ACTIVE');
  const totalBudget    = active.reduce((s, a) => s + Number(a.limitAmount), 0);
  const totalRemaining = active.reduce((s, a) => s + Number(a.remainingAmount), 0);
  const totalSpent     = totalBudget - totalRemaining;

  const recent = allocations.slice(0, 5).map(a => ({
    id:          a.id,
    category:    a.category,
    limitAmount: Number(a.limitAmount),
    spent:       Number(a.limitAmount) - Number(a.remainingAmount),
    status:      a.status,
    expiresAt:   a.expiresAt,
    beneficiary: {
      id: a.beneficiary.id,
      user: {
        firstName: a.beneficiary.user.firstName,
        lastName:  a.beneficiary.user.lastName ?? '',
      },
    },
  }));

  res.json({
    activeCount:     active.length,
    totalAllocations: allocations.length,
    totalBudget,
    totalRemaining,
    totalSpent,
    recentAllocations: recent,
  });
}));

// POST /mobile/sponsor/invite-beneficiary
const InviteSchema = z.object({
  firstName: z.string().min(1),
  lastName:  z.string().min(1),
  phone:     z.string().regex(/^(\+212|00212|0)[5-7]\d{8}$/),
  email:     z.string().email().optional(),
});

mobileRouter.post('/sponsor/invite-beneficiary', authenticate(['SPONSOR']), wrap(async (req, res) => {
  const { firstName, lastName, phone, email } = InviteSchema.parse(req.body);

  let user = await prisma.user.findUnique({
    where: { phone },
    include: { beneficiary: true },
  });

  if (user) {
    if (user.role !== 'BENEFICIARY') {
      res.status(409).json({ error: 'Ce numéro est déjà utilisé par un autre rôle (sponsor ou marchand).' }); return;
    }
    const bene = user.beneficiary;
    if (bene) {
      if (bene.sponsorId === req.user!.profileId) {
        res.status(409).json({ error: 'Ce bénéficiaire est déjà dans votre liste.' }); return;
      }
      if (bene.sponsorId !== null) {
        res.status(409).json({ error: 'Ce bénéficiaire est déjà lié à un autre sponsor.' }); return;
      }
      // Bénéficiaire sans sponsor → le rattacher
      await prisma.beneficiary.update({
        where: { id: bene.id },
        data: { sponsorId: req.user!.profileId },
      });
      try {
        const { OtpService } = await import('../auth/otp.service.js');
        await OtpService.requestOtp(phone, 'LOGIN');
      } catch { /* Twilio non configuré */ }
      res.status(200).json({ message: 'Bénéficiaire existant rattaché à votre compte.', beneficiaryId: bene.id });
      return;
    }
  } else {
    // Créer le compte utilisateur
    const bcryptModule = await import('bcryptjs');
  const bcrypt = (bcryptModule as any).default ?? bcryptModule;
    const tempPwd = Math.random().toString(36).slice(-8);
    user = await prisma.user.create({
      data: {
        phone, firstName, lastName, email,
        role: 'BENEFICIARY',
        password: await bcrypt.hash(tempPwd, 10),
        cndpConsentAt: new Date(),
      },
      include: { beneficiary: true },
    }) as any;
  }

  // Créer le profil bénéficiaire lié au sponsor
  const beneficiary = await prisma.beneficiary.create({
    data: { userId: user!.id, sponsorId: req.user!.profileId },
  });

  // Envoyer SMS (OTP d'activation)
  try {
    const { OtpService } = await import('../auth/otp.service.js');
    await OtpService.requestOtp(phone, 'LOGIN');
  } catch { /* Twilio non configuré */ }

  res.status(201).json({ message: 'Bénéficiaire invité avec succès.', beneficiaryId: beneficiary.id });
}));

/* ═══════════════════════════════════════════════
   BENEFICIARY
══════════════════════════════════════════════════ */

// GET /mobile/beneficiary/allocations
mobileRouter.get('/sponsor/transactions', authenticate(['SPONSOR']), wrap(async (req, res) => {
  const sponsorId = req.user!.profileId;

  const sponsor = await prisma.sponsor.findUnique({
    where: { id: sponsorId },
    include: { cards: { where: { isDefault: true }, take: 1 } },
  });
  if (!sponsor) { res.status(404).json({ error: 'Sponsor introuvable' }); return; }

  const transactions = await prisma.transaction.findMany({
    where: { sponsorId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      merchant: { include: { user: { select: { firstName: true, lastName: true } } } },
      authorization: {
        include: {
          allocation:  { select: { category: true, limitAmount: true } },
          beneficiary: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
      },
    },
  });

  const card = sponsor.cards?.[0];

  res.json(transactions.map(t => ({
    id:              t.id,
    amount:          Number(t.amount),
    status:          t.status,
    createdAt:       t.createdAt,
    category:        t.authorization?.allocation?.category ?? 'GENERAL',
    allocationLimit: Number(t.authorization?.allocation?.limitAmount ?? 0),
    merchantName:    (t.merchant as any)?.businessName ?? `${t.merchant?.user?.firstName ?? ''} ${t.merchant?.user?.lastName ?? ''}`.trim(),
    beneficiary:     `${(t.authorization?.beneficiary as any)?.user?.firstName ?? ''} ${(t.authorization?.beneficiary as any)?.user?.lastName ?? ''}`.trim(),
    isMinor:         (t.authorization?.beneficiary as any)?.isMinor ?? false,
    card:            card ? { brand: card.brand, maskedNumber: card.maskedNumber, cardHolder: card.cardHolder } : null,
  })));
}));

// GET /mobile/sponsor/pending-authorizations
mobileRouter.get('/sponsor/pending-authorizations', authenticate(['SPONSOR']), wrap(async (req, res) => {
  const sponsorId = req.user!.profileId;

  const pending = await prisma.authorization.findMany({
    where: { allocation: { sponsorId }, status: 'PENDING_REVIEW', transaction: null },
    include: {
      allocation:  { select: { category: true, limitAmount: true, remainingAmount: true } },
      beneficiary: { include: { user: { select: { firstName: true, lastName: true } } } },
      merchant:    { include: { user: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  res.json(pending.map(a => ({
    id:           a.id,
    amount:       Number(a.amount),
    createdAt:    a.createdAt,
    category:     a.allocation?.category ?? 'GENERAL',
    merchantName: (a.merchant as any)?.businessName ?? `${a.merchant?.user?.firstName ?? ''} ${a.merchant?.user?.lastName ?? ''}`.trim(),
    beneficiary:  `${a.beneficiary?.user?.firstName ?? ''} ${a.beneficiary?.user?.lastName ?? ''}`.trim(),
  })));
}));

// PATCH /mobile/sponsor/authorizations/:authorizationId — approuver ou rejeter un paiement en attente
mobileRouter.patch('/sponsor/authorizations/:authorizationId', authenticate(['SPONSOR']), wrap(async (req, res) => {
  const sponsorId        = req.user!.profileId;
  const authorizationId  = req.params['authorizationId'] as string;
  const { action, rejectionReason } = req.body as { action: 'approve' | 'reject'; rejectionReason?: string };

  if (!['approve', 'reject'].includes(action)) {
    res.status(400).json({ error: 'Action doit être "approve" ou "reject"' }); return;
  }

  const auth = await prisma.authorization.findFirst({
    where: { id: authorizationId, allocation: { sponsorId }, status: 'PENDING_REVIEW' },
    include: { allocation: true },
  });
  if (!auth) { res.status(404).json({ error: 'Autorisation introuvable ou déjà traitée' }); return; }

  // Authorization est INSERT ONLY (trigger DB) → on ne fait PAS .update()
  // On crée juste la transaction avec le bon statut
  const { randomUUID } = await import('crypto');

  if (action === 'approve') {
    await prisma.transaction.create({
      data: { authorizationId, sponsorId, merchantId: auth.merchantId, amount: auth.amount, pspTransactionId: randomUUID(), status: 'COMPLETED' },
    });
    await prisma.allocation.update({ where: { id: auth.allocationId }, data: { remainingAmount: { decrement: auth.amount } } });
    res.json({ status: 'APPROVED', message: 'Paiement approuvé ✅' });
  } else {
    await prisma.transaction.create({
      data: { authorizationId, sponsorId, merchantId: auth.merchantId, amount: auth.amount, pspTransactionId: randomUUID(), status: 'FAILED' },
    });
    res.json({ status: 'REJECTED', message: 'Paiement refusé ❌' });
  }
}));

// GET /mobile/sponsor/transactions
mobileRouter.post('/sponsor/beneficiaries/create', authenticate(['SPONSOR']), wrap(async (req, res) => {
  const { prisma } = await import('../../lib/prisma.js');
  const { smsProvider } = await import('../../lib/sms.js');
  const { phone, firstName, lastName, dateOfBirth, relationship } = req.body;

  if (!phone || !firstName) {
    res.status(400).json({ error: 'MISSING_FIELDS', message: 'Téléphone et prénom requis' }); return;
  }

  const sponsorId = req.user!.profileId;
  const sponsor   = await prisma.sponsor.findUnique({ where: { id: sponsorId }, include: { user: true } });
  if (!sponsor) { res.status(404).json({ error: 'SPONSOR_NOT_FOUND' }); return; }

  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) { res.status(409).json({ error: 'PHONE_EXISTS', message: 'Ce numéro a déjà un compte' }); return; }

  const bcryptModule = await import('bcryptjs');
  const bcrypt = (bcryptModule as any).default ?? bcryptModule;
  const tempPassword = Math.random().toString(36).slice(-8);
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  const newUser = await prisma.user.create({
    data: {
      phone,
      firstName,
      lastName:      lastName ?? null,
      password: passwordHash,
      role:          'BENEFICIARY',
      isFirstLogin:  true,
      cndpConsentAt: new Date(),
      beneficiary:   {
        create: {
          sponsorId,
          dateOfBirth:  dateOfBirth ? new Date(dateOfBirth) : null,
          relationship: relationship ?? null,
          isMinor: dateOfBirth ? (() => { const d = new Date(dateOfBirth); const today = new Date(); let age = today.getFullYear() - d.getFullYear(); const m = today.getMonth() - d.getMonth(); if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--; return age < 18; })() : false,
        },
      },
    },
  });
  const beneficiary = await prisma.beneficiary.findUnique({ where: { userId: newUser.id } });

  await smsProvider.send(phone,
    `Bonjour ${firstName} ! Votre compte FamilyPay a été créé par ${sponsor.user.firstName}. Téléchargez l'app et connectez-vous avec votre numéro.`
  );

  res.status(201).json({
    message: 'Compte bénéficiaire créé avec succès',
    beneficiaryId: beneficiary?.id,
    phone,
  });
}));

// Bénéficiaire confirme sa première connexion
mobileRouter.get('/sponsor/merchants', authenticate(['SPONSOR']), wrap(async (req, res) => {
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


mobileRouter.post('/sponsor/allocations', authenticate(['SPONSOR']), wrap(async (req, res) => {
  const sponsorId = req.user!.profileId;
  const { beneficiaryId, category, limitAmount, expiresAt, requiresApproval, allowedMerchantIds, thresholdValue, thresholdType, thresholdPeriod, thresholdAutoSuspend } = req.body;

  if (!beneficiaryId || !limitAmount || Number(limitAmount) <= 0) {
    res.status(400).json({ error: 'MISSING_FIELDS', message: 'Bénéficiaire et montant requis' }); return;
  }

  const benef = await prisma.beneficiary.findFirst({ where: { id: beneficiaryId, sponsorId } });
  if (!benef) { res.status(404).json({ error: 'NOT_FOUND', message: 'Bénéficiaire introuvable' }); return; }

  const allocation = await prisma.allocation.create({
    data: {
      beneficiaryId,
      sponsorId,
      category:         category ?? 'GENERAL',
      limitAmount:      Number(limitAmount),
      remainingAmount:  Number(limitAmount),
      status:            'ACTIVE',
      expiresAt:         expiresAt ? new Date(expiresAt) : null,
      requiresApproval:  (() => { const dob = benef.dateOfBirth; if (!dob) return requiresApproval ?? false; const d = new Date(dob); const today = new Date(); let age = today.getFullYear() - d.getFullYear(); const m = today.getMonth() - d.getMonth(); if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--; return age < 18 ? true : (requiresApproval ?? false); })(),
      allowedMerchantIds:   (Array.isArray(allowedMerchantIds) && allowedMerchantIds.length > 0) ? allowedMerchantIds : Prisma.JsonNull,
      thresholdValue:       thresholdValue   ? Number(thresholdValue) : null,
      thresholdType:        thresholdType    ?? null,
      thresholdPeriod:      thresholdPeriod  ?? null,
      thresholdAutoSuspend: thresholdAutoSuspend === true,
    },
  });

  res.status(201).json({
    id: allocation.id,
    category: allocation.category,
    limitAmount: Number(allocation.limitAmount),
    remainingAmount: Number(allocation.remainingAmount),
    status: allocation.status,
    requiresApproval: allocation.requiresApproval,
    allowedMerchantIds: allocation.allowedMerchantIds,
    expiresAt: allocation.expiresAt,
    createdAt: allocation.createdAt,
  });
}));

// ── Sponsor: toutes les allocations avec données bénéficiaire ────────────
mobileRouter.get('/sponsor/allocations', authenticate(['SPONSOR']), wrap(async (req, res) => {
  const sponsorId = req.user!.profileId;
  const allocations = await prisma.allocation.findMany({
    where: { sponsorId },
    include: {
      beneficiary: {
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  const calcIsMinor = (dob: Date | null) => {
    if (!dob) return false;
    const d = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - d.getFullYear();
    const m = today.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
    return age < 18;
  };
  res.json({
    allocations: allocations.map((a: any) => {
      const isMinor = a.beneficiary?.isMinor === true || calcIsMinor(a.beneficiary?.dateOfBirth ?? null);
      return {
        id: a.id,
        category: a.category,
        limitAmount: Number(a.limitAmount),
        remainingAmount: Number(a.remainingAmount),
        status: a.status,
        requiresApproval: a.requiresApproval,
        expiresAt: a.expiresAt,
        renewalPeriod: a.renewalPeriod,
        createdAt: a.createdAt,
        allowedMerchantIds:   a.allowedMerchantIds,
        thresholdValue:       a.thresholdValue   ? Number(a.thresholdValue)   : null,
        thresholdType:        a.thresholdType    ?? null,
        thresholdPeriod:      a.thresholdPeriod  ?? null,
        thresholdAutoSuspend: a.thresholdAutoSuspend,
        beneficiary: {
          id: a.beneficiary?.id,
          isMinor,
          user: a.beneficiary?.user,
        },
      };
    }),
  });
}));

mobileRouter.get('/sponsor/beneficiaries/:beneficiaryId/allocations', authenticate(['SPONSOR']), wrap(async (req, res) => {
  const sponsorId = req.user!.profileId;

  const benef = await prisma.beneficiary.findFirst({
    where: { id: (req.params.beneficiaryId as string), sponsorId },
  });
  if (!benef) { res.status(404).json({ message: 'Bénéficiaire introuvable' }); return; }

  const allocations = await prisma.allocation.findMany({
    where: { beneficiaryId: benef.id, sponsorId },
    orderBy: { createdAt: 'desc' },
  });

  res.json(allocations.map((a: any) => ({
    id: a.id,
    category: a.category,
    limitAmount: Number(a.limitAmount),
    remainingAmount: Number(a.remainingAmount),
    status: a.status,
    requiresApproval: a.requiresApproval,
    expiresAt: a.expiresAt,
    renewalPeriod: a.renewalPeriod,
    createdAt: a.createdAt,
  })));
}));

// ── Sponsor: modifier un bénéficiaire ───────────────────────────────────
mobileRouter.patch('/sponsor/beneficiaries/:id', authenticate(['SPONSOR']), wrap(async (req, res) => {
  const sponsorId = req.user!.profileId;
  const { firstName, lastName, phone, dateOfBirth, relationship } = req.body;

  const benef = await prisma.beneficiary.findFirst({
    where: { id: (req.params.id as string), sponsorId },
    include: { user: true },
  });
  if (!benef) { res.status(404).json({ message: 'Bénéficiaire introuvable' }); return; }

  if (firstName || lastName || phone) {
    await prisma.user.update({
      where: { id: benef.userId },
      data: {
        ...(firstName   ? { firstName }   : {}),
        ...(lastName    ? { lastName }    : {}),
        ...(phone       ? { phone }       : {}),
      },
    });
  }

  let isMinor = benef.isMinor;
  if (dateOfBirth) {
    const d = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - d.getFullYear();
    const m = today.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
    isMinor = age < 18;
  }

  await prisma.beneficiary.update({
    where: { id: benef.id },
    data: {
      ...(dateOfBirth  ? { dateOfBirth: new Date(dateOfBirth), isMinor } : {}),
      ...(relationship ? { relationship } : {}),
    },
  });

  if (isMinor) {
    await prisma.allocation.updateMany({
      where: { beneficiaryId: benef.id },
      data: { requiresApproval: true },
    });
  }

  res.json({ message: 'Bénéficiaire mis à jour' });
}));

// ── Sponsor: modifier une allocation ─────────────────────────────────────
mobileRouter.patch('/sponsor/allocations/:allocationId', authenticate(['SPONSOR']), wrap(async (req, res) => {
  const sponsorId = req.user!.profileId;
  const { limitAmount, expiresAt, requiresApproval, thresholdValue, thresholdType, thresholdPeriod, thresholdAutoSuspend, allowedMerchantIds, renewalPeriod } = req.body;

  const alloc = await prisma.allocation.findFirst({
    where: { id: (req.params.allocationId as string), sponsorId },
    include: { beneficiary: true },
  });
  if (!alloc) { res.status(404).json({ message: 'Allocation introuvable' }); return; }

  const isMinor = alloc.beneficiary.isMinor || (() => {
    const dob = alloc.beneficiary.dateOfBirth;
    if (!dob) return false;
    const d = new Date(dob); const today = new Date();
    let age = today.getFullYear() - d.getFullYear();
    const m = today.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
    return age < 18;
  })();

  const data: any = {};
  if (limitAmount !== undefined) {
    const newLimit = Number(limitAmount);
    const diff = newLimit - Number(alloc.limitAmount);
    data.limitAmount = newLimit;
    data.remainingAmount = Math.max(0, Number(alloc.remainingAmount) + diff);
  }
  if (expiresAt !== undefined)          data.expiresAt          = expiresAt ? new Date(expiresAt) : null;
  if (requiresApproval !== undefined)   data.requiresApproval   = isMinor ? true : requiresApproval;
  if (thresholdValue !== undefined)     data.thresholdValue     = thresholdValue ? Number(thresholdValue) : null;
  if (thresholdType !== undefined)      data.thresholdType      = thresholdType  ?? null;
  if (thresholdPeriod !== undefined)    data.thresholdPeriod    = thresholdPeriod ?? null;
  if (thresholdAutoSuspend !== undefined) data.thresholdAutoSuspend = thresholdAutoSuspend === true;
  if (allowedMerchantIds !== undefined) data.allowedMerchantIds = (Array.isArray(allowedMerchantIds) && allowedMerchantIds.length > 0) ? allowedMerchantIds : Prisma.JsonNull;
  if (renewalPeriod !== undefined)      data.renewalPeriod      = renewalPeriod ?? null;

  const updated = await prisma.allocation.update({ where: { id: alloc.id }, data });
  res.json({ message: 'Allocation mise à jour', allocation: updated });
}));

// ── Sponsor: suspendre / réactiver un bénéficiaire ────────────────────────
mobileRouter.patch('/sponsor/beneficiaries/:beneficiaryId/suspend', authenticate(['SPONSOR']), wrap(async (req, res) => {
  const sponsorId = req.user!.profileId;

  const benef = await prisma.beneficiary.findFirst({
    where: { id: (req.params.beneficiaryId as string), sponsorId },
  });
  if (!benef) { res.status(404).json({ message: 'Beneficiary introuvable' }); return; }

  const newActive = !benef.isActive;
  await prisma.beneficiary.update({ where: { id: benef.id }, data: { isActive: newActive } });
  await prisma.user.update({ where: { id: benef.userId }, data: { isActive: newActive } });

  res.json({ isActive: newActive });
}));

// ── Sponsor: supprimer un bénéficiaire ────────────────────────────────────
mobileRouter.delete('/sponsor/beneficiaries/:beneficiaryId', authenticate(['SPONSOR']), wrap(async (req, res) => {
  const sponsorId = req.user!.profileId;

  const benef = await prisma.beneficiary.findFirst({
    where: { id: (req.params.beneficiaryId as string), sponsorId: sponsorId },
    include: { allocations: true },
  });
  if (!benef) { res.status(404).json({ message: 'Bénéficiaire introuvable' }); return; }

  // Supprimer allocations puis bénéficiaire puis user
  await prisma.allocation.deleteMany({ where: { beneficiaryId: benef.id } });
  await prisma.beneficiary.delete({ where: { id: benef.id } });
  await prisma.user.delete({ where: { id: benef.userId } });

  res.json({ success: true });
}));

// ── Sponsor: pauser / réactiver une allocation ────────────────────────────
mobileRouter.patch('/sponsor/allocations/:allocationId/pause', authenticate(['SPONSOR']), wrap(async (req, res) => {
  const sponsorId = req.user!.profileId;

  const alloc = await prisma.allocation.findFirst({
    where: { id: (req.params.allocationId as string), sponsorId },
  });
  if (!alloc) { res.status(404).json({ message: 'Allocation introuvable' }); return; }

  const newStatus = alloc.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
  await prisma.allocation.update({ where: { id: alloc.id }, data: { status: newStatus } });

  res.json({ status: newStatus });
}));

// ── Sponsor: supprimer une allocation ─────────────────────────────────────
mobileRouter.delete('/sponsor/allocations/:allocationId', authenticate(['SPONSOR']), wrap(async (req, res) => {
  const sponsorId = req.user!.profileId;

  const alloc = await prisma.allocation.findFirst({
    where: { id: (req.params.allocationId as string), sponsorId },
  });
  if (!alloc) { res.status(404).json({ message: 'Allocation introuvable' }); return; }

  await prisma.allocation.delete({ where: { id: alloc.id } });

  res.json({ success: true });
}));

// ── Sponsor: liste des cartes ─────────────────────────────────────────────
mobileRouter.get('/sponsor/cards', authenticate(['SPONSOR']), wrap(async (req, res) => {
  const sponsorId = req.user!.profileId;
  const cards = await prisma.sponsorCard.findMany({
    where: { sponsorId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });
  res.json(cards);
}));

// ── Sponsor: ajouter une carte ────────────────────────────────────────────
mobileRouter.post('/sponsor/cards', authenticate(['SPONSOR']), wrap(async (req, res) => {
  const sponsorId = req.user!.profileId;
  const { cardNumber, cardHolder, expiryMonth, expiryYear, brand } = req.body;
  if (!cardNumber || !cardHolder || !expiryMonth || !expiryYear) {
    res.status(400).json({ message: 'Champs requis manquants' }); return;
  }
  const last4 = String(cardNumber).replace(/\s/g, '').slice(-4);
  const maskedNumber = `**** **** **** ${last4}`;
  const existingCount = await prisma.sponsorCard.count({ where: { sponsorId } });
  const card = await prisma.sponsorCard.create({
    data: { sponsorId, maskedNumber, cardHolder: String(cardHolder).toUpperCase(), expiryMonth: Number(expiryMonth), expiryYear: Number(expiryYear), brand: brand ?? 'VISA', isDefault: existingCount === 0 },
  });
  res.status(201).json(card);
}));

// ── Sponsor: supprimer une carte ──────────────────────────────────────────
mobileRouter.delete('/sponsor/cards/:cardId', authenticate(['SPONSOR']), wrap(async (req, res) => {
  const sponsorId = req.user!.profileId;
  const card = await prisma.sponsorCard.findFirst({ where: { id: req.params.cardId as string, sponsorId } });
  if (!card) { res.status(404).json({ message: 'Carte introuvable' }); return; }
  await prisma.sponsorCard.delete({ where: { id: card.id } });
  if (card.isDefault) {
    const next = await prisma.sponsorCard.findFirst({ where: { sponsorId }, orderBy: { createdAt: 'asc' } });
    if (next) await prisma.sponsorCard.update({ where: { id: next.id }, data: { isDefault: true } });
  }
  res.json({ success: true });
}));

// ── Sponsor: définir carte par défaut ─────────────────────────────────────
mobileRouter.patch('/sponsor/cards/:cardId/default', authenticate(['SPONSOR']), wrap(async (req, res) => {
  const sponsorId = req.user!.profileId;
  const card = await prisma.sponsorCard.findFirst({ where: { id: req.params.cardId as string, sponsorId } });
  if (!card) { res.status(404).json({ message: 'Carte introuvable' }); return; }
  await prisma.sponsorCard.updateMany({ where: { sponsorId }, data: { isDefault: false } });
  await prisma.sponsorCard.update({ where: { id: card.id }, data: { isDefault: true } });
  res.json({ success: true });
}));

// ── Sponsor: demander changement téléphone ────────────────────────────────
// POST /mobile/sponsor/push-token — enregistrer le token Expo
mobileRouter.post('/sponsor/push-token', authenticate(['SPONSOR']), wrap(async (req, res) => {
  const userId = (req as any).user?.userId;
  const { token } = req.body as { token: string };
  if (!token) { res.status(400).json({ error: 'Token requis' }); return; }
  await prisma.user.update({ where: { id: userId }, data: { expoPushToken: token } });
  res.json({ ok: true });
}));

mobileRouter.post('/sponsor/phone/change-request', authenticate(['SPONSOR']), wrap(async (req, res) => {
  const { newPhone } = req.body;
  if (!newPhone) { res.status(400).json({ message: 'Numéro requis' }); return; }
  const existing = await prisma.user.findUnique({ where: { phone: newPhone } });
  if (existing) { res.status(409).json({ message: 'Ce numéro est déjà utilisé par un autre compte' }); return; }
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const bcryptModule = await import('bcryptjs');
  const bcrypt = (bcryptModule as any).default ?? bcryptModule;
  const codeHash = await bcrypt.hash(otp, 10);
  await prisma.otpCode.create({ data: { phone: newPhone, codeHash, purpose: 'PHONE_CHANGE', expiresAt } });
  const { smsProvider } = await import('../../lib/sms.js');
  await smsProvider.send(newPhone, `FamilyPay : votre code de vérification est ${otp}`);
  res.json({ message: 'OTP envoyé' });
}));

// ── Sponsor: confirmer changement téléphone ───────────────────────────────
mobileRouter.post('/sponsor/phone/change-confirm', authenticate(['SPONSOR']), wrap(async (req, res) => {
  const { newPhone, code } = req.body;
  if (!newPhone || !code) { res.status(400).json({ message: 'Numéro et code requis' }); return; }
  const otpRecords = await prisma.otpCode.findMany({
    where: { phone: newPhone, purpose: 'PHONE_CHANGE', usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  const bcryptModule2 = await import('bcryptjs');
  const bcrypt2 = (bcryptModule2 as any).default ?? bcryptModule2;
  const otp = await (async () => { for (const r of otpRecords) { if (await bcrypt2.compare(code, r.codeHash)) return r; } return null; })();
  if (!otp) { res.status(400).json({ message: 'Code invalide ou expiré' }); return; }
  await prisma.otpCode.update({ where: { id: otp.id }, data: { usedAt: new Date() } });
  const sponsor = await prisma.sponsor.findUnique({ where: { id: req.user!.profileId } });
  if (!sponsor) { res.status(404).json({ message: 'Sponsor introuvable' }); return; }
  await prisma.user.update({ where: { id: sponsor.userId }, data: { phone: newPhone } });
  res.json({ message: 'Numéro mis à jour', phone: newPhone });
}));

// ── Sponsor: toggle requiresApproval sur une allocation ───────────────────
mobileRouter.patch('/sponsor/allocations/:allocationId/approval', authenticate(['SPONSOR']), wrap(async (req, res) => {
  const sponsorId = req.user!.profileId;
  const alloc = await prisma.allocation.findFirst({
    where: { id: (req.params.allocationId as string), sponsorId },
  });
  if (!alloc) { res.status(404).json({ message: 'Allocation introuvable' }); return; }
  const benefForAlloc = await prisma.beneficiary.findFirst({ where: { id: alloc.beneficiaryId } });
  const isMinorBenef = benefForAlloc?.dateOfBirth ? (() => { const d = new Date(benefForAlloc.dateOfBirth!); const today = new Date(); let age = today.getFullYear() - d.getFullYear(); const m = today.getMonth() - d.getMonth(); if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--; return age < 18; })() : false;
  if (isMinorBenef) { res.status(400).json({ error: 'MINOR_LOCKED', message: 'Les allocations des mineurs nécessitent toujours une approbation' }); return; }
  const newValue = !alloc.requiresApproval;
  await prisma.allocation.update({ where: { id: alloc.id }, data: { requiresApproval: newValue } });
  res.json({ requiresApproval: newValue });
}));

// ── Marchand: générer un QR de paiement ──────────────────────────────────
mobileRouter.post('/sponsor/allocations/:allocationId/renew', authenticate, wrap(async (req, res) => {
  const userId       = (req as any).user?.userId;
  const allocationId = req.params['allocationId'] as string;

  const sponsor = await prisma.sponsor.findUnique({ where: { userId } });
  if (!sponsor) { res.status(403).json({ message: 'Sponsor introuvable' }); return; }

  const allocation = await prisma.allocation.findFirst({
    where: { id: allocationId, sponsorId: sponsor.id },
  });
  if (!allocation) { res.status(404).json({ message: 'Allocation introuvable' }); return; }
  if (!allocation.renewalPeriod) {
    res.status(400).json({ message: 'Cette allocation n\'a pas de période de renouvellement' }); return;
  }

  const addPeriod = (date: Date, period: string): Date => {
    const d = new Date(date);
    switch (period) {
      case 'DAILY':     d.setDate(d.getDate() + 1); break;
      case 'WEEKLY':    d.setDate(d.getDate() + 7); break;
      case 'MONTHLY':   d.setMonth(d.getMonth() + 1); break;
      case 'QUARTERLY': d.setMonth(d.getMonth() + 3); break;
      case 'ANNUAL':    d.setFullYear(d.getFullYear() + 1); break;
    }
    return d;
  };

  const newExpiresAt = allocation.expiresAt
    ? addPeriod(allocation.expiresAt, allocation.renewalPeriod)
    : addPeriod(new Date(), allocation.renewalPeriod);

  const updated = await prisma.allocation.update({
    where: { id: allocationId },
    data: {
      remainingAmount: allocation.limitAmount,
      expiresAt:       newExpiresAt,
      status:          'ACTIVE',
    },
  });

  await prisma.adminNotification.create({
    data: {
      type:    'ALLOCATION_RENEWED',
      title:   'Allocation renouvelée manuellement',
      body: `Allocation ${allocationId} renouvelée manuellement par le sponsor`,
      entityId: allocationId,
    },
  });

  res.json({ message: 'Allocation renouvelée ✅', allocation: updated });
}));




}
