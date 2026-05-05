import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/authenticate.js';
import * as svc from '../services/fund-request.service.js';

export async function send(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { receiverId, amount, message } = req.body;
    const result = await svc.sendFundRequest(req.user!.id, receiverId, amount, req.user!.tenantId, message);
    res.status(201).json(result);
  } catch (err) { next(err); }
}

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await svc.listFundRequests(req.user!.id, req.user!.role);
    res.json(result);
  } catch (err) { next(err); }
}

export async function approve(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await svc.approveFundRequest(req.params.id as string, req.user!.id, req.user!.tenantId);
    res.json(result);
  } catch (err) { next(err); }
}

export async function reject(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await svc.rejectFundRequest(req.params.id as string, req.user!.id);
    res.json(result);
  } catch (err) { next(err); }
}
