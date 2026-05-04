import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/authenticate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { monthlyReportHandler } from '../controllers/report.controller.js';

const router = Router();

router.get('/monthly', authenticate, requireRole('PAYER'), asyncHandler(monthlyReportHandler));

export default router;
