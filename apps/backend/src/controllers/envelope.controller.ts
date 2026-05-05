import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/authenticate.js';
import { FamilyPayError } from '../lib/errors.js';
import * as envelopeService from '../services/envelope.service.js';

export async function list(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new FamilyPayError('UNAUTHORIZED', 401, 'Not authenticated');
    const beneficiaryId = req.query.beneficiaryId as string | undefined;
    res.json(await envelopeService.listEnvelopes(req.user.id, req.user.tenantId, beneficiaryId));
  } catch (err) { next(err); }
}

export async function getOne(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new FamilyPayError('UNAUTHORIZED', 401, 'Not authenticated');
    res.json(await envelopeService.getEnvelope(req.params.id as string, req.user.tenantId));
  } catch (err) { next(err); }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new FamilyPayError('UNAUTHORIZED', 401, 'Not authenticated');
    const { beneficiaryId, category, label, maxPerTransaction } = req.body;
    if (!beneficiaryId || !category || !label)
      throw new FamilyPayError('VALIDATION_ERROR', 400, 'Missing required fields');
    res.status(201).json(await envelopeService.createEnvelope(req.user.id, req.user.tenantId, {
      beneficiaryId, category, label,
      maxPerTransaction: maxPerTransaction !== undefined ? Number(maxPerTransaction) : undefined,
    }));
  } catch (err) { next(err); }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new FamilyPayError('UNAUTHORIZED', 401, 'Not authenticated');
    res.json(await envelopeService.updateEnvelope(req.params.id as string, req.user.tenantId, req.body));
  } catch (err) { next(err); }
}

export async function deactivate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new FamilyPayError('UNAUTHORIZED', 401, 'Not authenticated');
    res.json(await envelopeService.deactivateEnvelope(req.params.id as string, req.user.tenantId));
  } catch (err) { next(err); }
}

export async function transfer(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new FamilyPayError('UNAUTHORIZED', 401, 'Not authenticated');
    const { fromEnvelopeId, toEnvelopeId, amount } = req.body;
    if (!fromEnvelopeId || !toEnvelopeId || amount === undefined)
      throw new FamilyPayError('VALIDATION_ERROR', 400, 'Missing required fields');
    res.json(await envelopeService.transfer(
      fromEnvelopeId, toEnvelopeId, Number(amount), req.user.tenantId,
    ));
  } catch (err) { next(err); }
}

export async function fund(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new FamilyPayError('UNAUTHORIZED', 401, 'Not authenticated');
    const { amount } = req.body;
    if (amount === undefined) throw new FamilyPayError('VALIDATION_ERROR', 400, 'Missing amount');
    res.json(await envelopeService.fundEnvelope(req.user.id, req.user.tenantId, req.params.id as string, Number(amount)));
  } catch (err) { next(err); }
}
