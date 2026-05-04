import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/authenticate.js';
import { processPayment } from '../services/payment.service.js';

export async function qrPayment(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { token, amount } = req.body as { token: string; amount: number };
    const result = await processPayment(token, amount, req.user!.id, req.user!.tenantId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
