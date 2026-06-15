import { Router, Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/authenticate.js';
import { AuthService } from '../auth/auth.service.js';
import { z } from 'zod';

const wrap = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

export const mobileRouter = Router();

/* ═══════════════════════════════════════════════
   SPONSOR
══════════════════════════════════════════════════ */

// GET /mobile/sponsor/beneficiaries
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
    where: { allocation: { sponsorId }, status: 'PENDING_REVIEW' },
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

  const { randomUUID } = await import('crypto');

  if (action === 'approve') {
    await prisma.authorization.update({ where: { id: authorizationId }, data: { status: 'APPROVED' } });
    await prisma.transaction.create({
      data: { authorizationId, sponsorId, merchantId: auth.merchantId, amount: auth.amount, pspTransactionId: randomUUID(), status: 'COMPLETED' },
    });
    await prisma.allocation.update({ where: { id: auth.allocationId }, data: { remainingAmount: { decrement: auth.amount } } });
    res.json({ status: 'APPROVED', message: 'Paiement approuvé ✅' });
  } else {
    await prisma.authorization.update({ where: { id: authorizationId }, data: { status: 'REJECTED', rejectionReason: rejectionReason ?? 'Refusé par le sponsor' } });
    await prisma.transaction.create({
      data: { authorizationId, sponsorId, merchantId: auth.merchantId, amount: auth.amount, pspTransactionId: randomUUID(), status: 'FAILED' },
    });
    res.json({ status: 'REJECTED', message: 'Paiement refusé ❌' });
  }
}));

// GET /mobile/merchant/profile
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
    res.status(403).json({ error: 'NO_ALLOCATION', message: `Aucune allocation active en ${qr.category} avec fonds suffisants` }); return;
  }

  // Vérifier si l'allocation est limitée à certains marchands
  const allowedIds = allocation.allowedMerchantIds as string[] | null;
  if (allowedIds && allowedIds.length > 0 && !allowedIds.includes(qr.merchantId)) {
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
    } catch (_) { /* best-effort, ne bloque pas */ }
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

  if (allocation.requiresApproval) {
    const authorization = await prisma.authorization.create({
      data: { allocationId: allocation.id, beneficiaryId, merchantId: qr.merchantId, amount: qr.amount, status: 'PENDING_REVIEW' },
    });
    await prisma.qrCode.update({ where: { token }, data: { usedAt: new Date(), authorizationId: authorization.id } });
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




