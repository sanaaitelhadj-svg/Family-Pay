import { Request, Response, NextFunction } from 'express';
import { TokenService, JwtPayload } from '../modules/auth/token.service.js';
import { AppError } from '../lib/errors.js';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authenticate(allowedRoles?: JwtPayload['role'][]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return next(new AppError('Token manquant', 401, 'TOKEN_MISSING'));
    }

    const token = authHeader.slice(7);

    try {
      const payload = TokenService.verifyAccessToken(token);

      if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(payload.role)) {
        return next(new AppError('Accès non autorisé', 403, 'FORBIDDEN'));
      }

      req.user = payload;
      next();
    } catch (err) {
      next(err);
    }
  };
}
