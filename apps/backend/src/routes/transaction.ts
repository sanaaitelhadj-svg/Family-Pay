import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/authenticate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { transactionHistoryHandler } from '../controllers/transaction.controller.js';

const router = Router();

router.get('/', authenticate, requireRole('PAYER', 'BENEFICIARY'), asyncHandler(transactionHistoryHandler));

export default router;
