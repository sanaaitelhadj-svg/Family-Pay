import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/authenticate.js';
import { prismaAdmin } from '../lib/prisma.js';
import { FamilyPayError } from '../lib/errors.js';

// ── GET /api/admin/stats ─────────────────────────────────────────────────────
export async function adminStats(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const [
      totalUsers,
      totalPartners,
      pendingPartners,
      totalTransactions,
      volumeResult,
    ] = await Promise.all([
      prismaAdmin.user.count(),
      prismaAdmin.partner.count(),
      prismaAdmin.partner.count({ where: { isVerified: false, isActive: true } }),
      prismaAdmin.transaction.count({ where: { status: 'COMPLETED' } }),
      prismaAdmin.transaction.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amount: true },
      }),
    ]);

    const usersByRole = await prismaAdmin.user.groupBy({
      by: ['role'],
      _count: { id: true },
    });

    res.json({
      totalUsers,
      totalPartners,
      pendingPartners,
      totalTransactions,
      totalVolume: Number(volumeResult._sum.amount ?? 0),
      usersByRole: usersByRole.map(r => ({ role: r.role, count: r._count.id })),
    });
  } catch (err) { next(err); }
}

// ── GET /api/admin/users ─────────────────────────────────────────────────────
export async function adminUsers(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const page  = Math.max(1, Number(req.query.page)  || 1);
    const limit = Math.min(50, Number(req.query.limit) || 20);
    const role  = req.query.role as string | undefined;
    const search = req.query.search as string | undefined;

    const where: any = {};
    if (role) where.role = role;
    if (search) where.OR = [
      { email:     { contains: search, mode: 'insensitive' } },
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName:  { contains: search, mode: 'insensitive' } },
    ];

    const [users, total] = await Promise.all([
      prismaAdmin.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, email: true, firstName: true, lastName: true,
          role: true, isActive: true, createdAt: true, lastLoginAt: true,
          wallet: { select: { balance: true, currency: true } },
        },
      }),
      prismaAdmin.user.count({ where }),
    ]);

    res.json({ users, total, page, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
}

// ── GET /api/admin/partners ──────────────────────────────────────────────────
export async function adminPartners(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const status = req.query.status as string | undefined; // 'pending' | 'verified' | 'all'
    const page  = Math.max(1, Number(req.query.page)  || 1);
    const limit = Math.min(50, Number(req.query.limit) || 20);

    const where: any = {};
    if (status === 'pending')  { where.isVerified = false; where.isActive = true; }
    if (status === 'verified') { where.isVerified = true; }

    const [partners, total] = await Promise.all([
      prismaAdmin.partner.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { email: true, firstName: true, lastName: true, createdAt: true } },
          wallet: { select: { balance: true, currency: true } },
          _count: { select: { transactions: true } },
        },
      }),
      prismaAdmin.partner.count({ where }),
    ]);

    res.json({ partners, total, page, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
}

// ── PATCH /api/admin/partners/:id/approve ───────────────────────────────────
export async function approvePartner(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const partner = await prismaAdmin.partner.findUnique({ where: { id } });
    if (!partner) throw new FamilyPayError('NOT_FOUND', 404, 'Partner not found');

    const updated = await prismaAdmin.partner.update({
      where: { id },
      data: { isVerified: true, isActive: true },
    });
    res.json({ message: 'Partner approved', partner: updated });
  } catch (err) { next(err); }
}

// ── PATCH /api/admin/partners/:id/reject ────────────────────────────────────
export async function rejectPartner(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const partner = await prismaAdmin.partner.findUnique({ where: { id } });
    if (!partner) throw new FamilyPayError('NOT_FOUND', 404, 'Partner not found');

    const updated = await prismaAdmin.partner.update({
      where: { id },
      data: { isVerified: false, isActive: false },
    });
    res.json({ message: 'Partner rejected', partner: updated });
  } catch (err) { next(err); }
}

// ── GET /api/admin/transactions ──────────────────────────────────────────────
export async function adminTransactions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const page  = Math.max(1, Number(req.query.page)  || 1);
    const limit = Math.min(100, Number(req.query.limit) || 30);

    const [transactions, total] = await Promise.all([
      prismaAdmin.transaction.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          senderWallet:   { include: { user: { select: { firstName: true, lastName: true, email: true, role: true } } } },
          receiverWallet: { include: { user: { select: { firstName: true, lastName: true, email: true, role: true } } } },
        },
      }),
      prismaAdmin.transaction.count(),
    ]);

    res.json({ transactions, total, page, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
}

// ── PATCH /api/admin/users/:id/toggle ───────────────────────────────────────
export async function toggleUser(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const user = await prismaAdmin.user.findUnique({ where: { id } });
    if (!user) throw new FamilyPayError('NOT_FOUND', 404, 'User not found');

    const updated = await prismaAdmin.user.update({
      where: { id },
      data: { isActive: !user.isActive },
      select: { id: true, email: true, isActive: true },
    });
    res.json({ message: `User ${updated.isActive ? 'activated' : 'deactivated'}`, user: updated });
  } catch (err) { next(err); }
}
