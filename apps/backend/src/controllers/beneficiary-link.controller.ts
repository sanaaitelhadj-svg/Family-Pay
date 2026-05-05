import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/authenticate.js';
import { FamilyPayError } from '../lib/errors.js';
import * as service from '../services/beneficiary-link.service.js';

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new FamilyPayError('UNAUTHORIZED', 401, 'Not authenticated');
    const { beneficiaryId, relationship } = req.body;
    if (!beneficiaryId || !relationship)
      throw new FamilyPayError('VALIDATION_ERROR', 400, 'beneficiaryId et relationship requis');
    res.status(201).json(await service.createLink(req.user.id, req.user.tenantId, beneficiaryId, relationship));
  } catch (err) { next(err); }
}

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new FamilyPayError('UNAUTHORIZED', 401, 'Not authenticated');
    res.json(await service.listLinks(req.user.id));
  } catch (err) { next(err); }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new FamilyPayError('UNAUTHORIZED', 401, 'Not authenticated');
    res.json(await service.removeLink(req.user.id, req.params.beneficiaryId as string));
  } catch (err) { next(err); }
}
