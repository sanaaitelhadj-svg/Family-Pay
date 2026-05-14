import { Router } from 'express';
import { z } from 'zod';
import { TransactionService } from './transaction.service.js';
import { authenticate } from '../../middleware/authenticate.js';

export const transactionRouter = Router();

const PaySchema = z.object({
  token: z.string().min(1),
});

transactionRouter.post('/pay', authenticate(['BENEFICIARY']), async (req, res, next) => {
  try {
    const { token } = PaySchema.parse(req.body);
    const beneficiaryId = (req.user as { profileId: string }).profileId;
    const result = await TransactionService.processPayment(token, beneficiaryId);
    const httpStatus = result.success ? 200 : result.status === 'PENDING_REVIEW' ? 202 : 422;
    res.status(httpStatus).json(result);
  } catch (err) {
    next(err);
  }
});
