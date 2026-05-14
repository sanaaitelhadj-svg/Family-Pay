import { Router } from 'express';
import { z } from 'zod';
import { AuthorizationEngine } from './authorization.engine.js';
import { authenticate } from '../../middleware/authenticate.js';

export const authorizationRouter = Router();

const AuthorizeRequestSchema = z.object({
  merchantId: z.string().uuid(),
  amount: z.number().positive().max(50000),
  category: z.enum(['PHARMACY', 'FOOD', 'CLOTHING', 'EDUCATION', 'LEISURE', 'GENERAL']),
});

authorizationRouter.post(
  '/request',
  authenticate(['BENEFICIARY']),
  async (req, res, next) => {
    try {
      const { merchantId, amount, category } = AuthorizeRequestSchema.parse(req.body);
      const result = await AuthorizationEngine.authorize({
        beneficiaryId: (req.user as { profileId: string }).profileId,
        merchantId,
        amount,
        category,
      });
      const httpStatus =
        result.status === 'APPROVED' ? 200 : result.status === 'PENDING_REVIEW' ? 202 : 422;
      res.status(httpStatus).json(result);
    } catch (err) {
      next(err);
    }
  },
);
