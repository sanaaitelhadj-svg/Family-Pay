import { Router, Request, Response, NextFunction } from 'express';
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

  // Vérifier si l'utilisateur existe déjà
  let user = await prisma.user.findUnique({ where: { phone } });

  if (user) {
    // Déjà bénéficiaire de ce sponsor ?
    const existing = await prisma.beneficiary.findFirst({
      where: { userId: user.id, sponsorId: req.user!.profileId },
    });
    if (existing) { res.status(409).json({ error: 'Ce bénéficiaire est déjà lié à votre compte.' }); return; }
  } else {
    // Créer l'utilisateur
    const bcrypt = await import('bcryptjs');
    const tempPwd = Math.random().toString(36).slice(-8);
    user = await prisma.user.create({
      data: {
        phone,
        firstName,
        lastName,
        email,
        role: 'BENEFICIARY',
        password: await bcrypt.hash(tempPwd, 10),
        cndpConsentAt: new Date(),
      },
    });
  }

  // Créer le profil bénéficiaire lié au sponsor
  const beneficiary = await prisma.beneficiary.create({
    data: { userId: user.id, sponsorId: req.user!.profileId },
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
    id:       a.id,
    category: a.category,
    amount:   Number(a.limitAmount),
    spent:    Number(a.limitAmount) - Number(a.remainingAmount),
    status:   a.status,
    expiresAt: a.expiresAt,
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
      authorization: { include: { allocation: true } },
      sponsor: { include: { user: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  // Récupérer le bénéficiaire via authorization → allocation
  const result = await Promise.all(transactions.map(async t => {
    const beneficiary = await prisma.beneficiary.findUnique({
      where: { id: t.authorization.allocation.beneficiaryId },
      include: { user: true },
    });
    return {
      id:        t.id,
      amount:    Number(t.amount),
      category:  t.authorization.allocation.category,
      status:    t.status,
      createdAt: t.createdAt,
      beneficiary: {
        user: {
          firstName: beneficiary?.user.firstName ?? '',
          lastName:  beneficiary?.user.lastName  ?? '',
        },
      },
    };
  }));

  res.json(result);
}));

// GET /mobile/merchant/profile
mobileRouter.get('/merchant/profile', authenticate(['MERCHANT']), wrap(async (req, res) => {
  const merchant = await prisma.merchant.findUnique({
    where: { id: req.user!.profileId },
    include: {
      user: true,
      _count: { select: { transactions: true } },
    },
  });
  if (!merchant) { res.status(404).json({ error: 'Marchand introuvable' }); return; }

  const totalRevenue = await prisma.transaction.aggregate({
    where: { merchantId: merchant.id, status: 'COMPLETED' },
    _sum: { amount: true },
  });

  res.json({
    ...merchant,
    acceptedCategories: [merchant.category],
    totalRevenue: Number(totalRevenue._sum?.amount ?? 0),
  });
}));
