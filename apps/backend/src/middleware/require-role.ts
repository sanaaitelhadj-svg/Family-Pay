import { Response, NextFunction } from 'express';
import { AuthRequest } from './authenticate.js';
import { FamilyPayError } from '../lib/errors.js';

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new FamilyPayError('UNAUTHORIZED', 401, 'Not authenticated'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new FamilyPayError('FORBIDDEN', 403, 'Insufficient permissions'));
      return;
    }
    next();
  };
}
