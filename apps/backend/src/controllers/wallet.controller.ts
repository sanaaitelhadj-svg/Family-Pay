import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/authenticate.js';
import { FamilyPayError } from '../lib/errors.js';
import * as walletService from '../services/wallet.service.js';

export async function me(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new FamilyPayError('UNAUTHORIZED', 401, 'Not authenticated');
    res.json(await walletService.getMyWallet(req.user.id, req.user.tenantId));
  } catch (err) { next(err); }
}

export async function reload(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new FamilyPayError('UNAUTHORIZED', 401, 'Not authenticated');
    const { amount } = req.body;
    if (amount === undefined) throw new FamilyPayError('VALIDATION_ERROR', 400, 'Missing amount');
    res.json(await walletService.reload(req.user.id, req.user.tenantId, Number(amount)));
  } catch (err) { next(err); }
}
