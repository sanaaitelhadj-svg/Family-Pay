import { Router } from 'express';
import { z } from 'zod';
import { QrService } from './qr.service.js';
import { authenticate } from '../../middleware/authenticate.js';

export const qrRouter = Router();

const GenerateQrSchema = z.object({
  category: z.enum(['PHARMACY', 'FOOD', 'CLOTHING', 'EDUCATION', 'LEISURE', 'GENERAL']),
  amount: z.number().positive().max(50000),
});

qrRouter.post('/generate', authenticate(['MERCHANT']), async (req, res, next) => {
  try {
    const { category, amount } = GenerateQrSchema.parse(req.body);
    const merchantId = (req.user as { profileId: string }).profileId;
    const result = await QrService.generate(merchantId, category, amount);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});
