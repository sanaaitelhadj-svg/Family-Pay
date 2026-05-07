import { Router } from 'express';
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
} from '../controllers/admin.controller.js';

const router = Router();

// Toutes les routes admin nécessitent un JWT valide + rôle ADMIN
router.use(authenticate, requireRole('ADMIN'));

router.get('/stats',                    asyncHandler(adminStats));
router.get('/users',                    asyncHandler(adminUsers));
router.get('/partners',                 asyncHandler(adminPartners));
router.patch('/partners/:id/approve',   asyncHandler(approvePartner));
router.patch('/partners/:id/reject',    asyncHandler(rejectPartner));
router.get('/transactions',             asyncHandler(adminTransactions));
router.patch('/users/:id/toggle',       asyncHandler(toggleUser));

export default router;
