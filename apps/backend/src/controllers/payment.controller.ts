import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/authenticate.js';
import { FamilyPayError } from '../lib/errors.js';
import { processPayment } from '../services/payment.service.js';

export async function qrPayment(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { token, qrToken, amount } = req.body as { token?: string; qrToken?: string; amount: number };
    const qrTokenValue = token ?? qrToken;
    if (!qrTokenValue) throw new FamilyPayError('VALIDATION_ERROR', 400, 'Token QR manquant (champ token ou qrToken requis)');
    const result = await processPayment(qrTokenValue, amount, req.user!.id, req.user!.tenantId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
