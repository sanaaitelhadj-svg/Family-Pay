import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/authenticate.js';
import * as svc from '../services/occasion.service.js';

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { beneficiaryId, title, message, targetAmount, activatesAt, expiresAt, restrictPartnerId } = req.body;
    const result = await svc.createOccasion(req.user!.id, req.user!.tenantId, {
      beneficiaryId, title, message, targetAmount,
      activatesAt: new Date(activatesAt),
      expiresAt: new Date(expiresAt),
      restrictPartnerId,
    });
    res.status(201).json(result);
  } catch (err) { next(err); }
}

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { beneficiaryId } = req.query;
    const result = await svc.listOccasions(req.user!.tenantId, beneficiaryId as string | undefined);
    res.json(result);
  } catch (err) { next(err); }
}

export async function getOne(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await svc.getOccasion(req.params.id, req.user!.tenantId);
    res.json(result);
  } catch (err) { next(err); }
}

export async function deactivate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await svc.deactivateOccasion(req.params.id, req.user!.id, req.user!.tenantId);
    res.json(result);
  } catch (err) { next(err); }
}
