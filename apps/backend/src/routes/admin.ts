import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/authenticate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import {
  adminStats,
  adminUsers,
  adminPartners,
  approvePartner,
  rejectPartner,
  adminTransactions,
  toggleUser,
  generateContract,
  partnerNotifications,
} from '../controllers/admin.controller.js';
import {
  listConditions,
  createCondition,
  updateCondition,
  deleteCondition,
} from '../controllers/admin-settings.controller.js';
import { prismaAdmin } from '../lib/prisma.js';
import bcrypt from 'bcryptjs';

const router = Router();

// ── SETUP (public, protégé par token secret) ─────────────────────────────────
// POST /api/admin/setup  { setupToken, email, password }
router.post('/setup', asyncHandler(async (req: Request, res: Response) => {
  const { setupToken, email, password } = req.body;
  const expected = process.env.ADMIN_SETUP_TOKEN;

  if (!expected || setupToken !== expected) {
    res.status(403).json({ error: 'FORBIDDEN', message: 'Invalid setup token' });
    return;
  }

  const TENANT_ID = '00000000-0000-0000-0000-000000000001';
  const adminEmail = email ?? 'admin@altivax.com';
  const adminPass  = password ?? 'Altivax2026!';

  const existing = await prismaAdmin.user.findFirst({ where: { email: adminEmail } });
  if (existing) {
    // Met à jour le rôle et le mot de passe si l'utilisateur existe déjà
    await prismaAdmin.user.update({
      where: { id: existing.id },
      data: { role: 'ADMIN', isActive: true, passwordHash: await bcrypt.hash(adminPass, 12) },
    });
    res.json({ message: 'Admin account updated', email: adminEmail });
    return;
  }

  const hash = await bcrypt.hash(adminPass, 12);
  const user = await prismaAdmin.user.create({
    data: {
      tenantId: TENANT_ID,
      email: adminEmail,
      passwordHash: hash,
      role: 'ADMIN',
      firstName: 'Super',
      lastName: 'Admin',
      kycStatus: 'VERIFIED',
      isActive: true,
    },
  });
  await prismaAdmin.wallet.create({
    data: { tenantId: TENANT_ID, userId: user.id, balance: 0, currency: 'MAD' },
  });

  res.status(201).json({ message: 'Admin account created', email: adminEmail });
}));

// ── Routes protégées (JWT + rôle ADMIN) ──────────────────────────────────────
router.use(authenticate, requireRole('ADMIN'));

router.get('/stats',                              asyncHandler(adminStats));
router.get('/users',                              asyncHandler(adminUsers));
router.patch('/users/:id/toggle',                 asyncHandler(toggleUser));
router.get('/partners',                           asyncHandler(adminPartners));
router.patch('/partners/:id/approve',             asyncHandler(approvePartner));
router.patch('/partners/:id/reject',              asyncHandler(rejectPartner));
router.get('/partners/:id/contract',              asyncHandler(generateContract));
router.get('/partners/:id/notifications',         asyncHandler(partnerNotifications));
router.get('/transactions',                       asyncHandler(adminTransactions));

// ── Settings: Partnership Conditions ─────────────────────────────────────────
router.get('/settings/conditions',                asyncHandler(listConditions));
router.post('/settings/conditions',               asyncHandler(createCondition));
router.patch('/settings/conditions/:id',          asyncHandler(updateCondition));
router.delete('/settings/conditions/:id',         asyncHandler(deleteCondition));

export default router;
