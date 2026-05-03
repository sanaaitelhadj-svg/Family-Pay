import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../services/token.service.js';
import { FamilyPayError } from '../lib/errors.js';

export interface AuthRequest extends Request {
  user?: { id: string; tenantId: string; role: string };
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(new FamilyPayError('UNAUTHORIZED', 401, 'Missing Authorization header'));
    return;
  }
  try {
    const payload = verifyAccessToken(header.slice(7));
    req.user = { id: payload.sub, tenantId: payload.tenantId, role: payload.role };
    next();
  } catch {
    next(new FamilyPayError('UNAUTHORIZED', 401, 'Invalid or expired token'));
  }
}
