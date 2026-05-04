import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/authenticate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { payerDashboardHandler, partnerDashboardHandler } from '../controllers/dashboard.controller.js';

const router = Router();

router.get('/payer', authenticate, requireRole('PAYER'), asyncHandler(payerDashboardHandler));
router.get('/partner', authenticate, requireRole('PARTNER'), asyncHandler(partnerDashboardHandler));

export default router;
