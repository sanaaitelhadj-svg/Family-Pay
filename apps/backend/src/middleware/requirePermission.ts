import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';

export function requirePermission(page: string, action: 'read' | 'write' | string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!user?.userId) return next(new AppError('Non autorisé', 401, 'UNAUTHORIZED'));

      // Fetch admin with role from DB
      const admin = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { adminRoleId: true, adminRole: { select: { isActive: true, permissions: true } } },
      });

      if (!admin) return next(new AppError('Utilisateur introuvable', 404, 'NOT_FOUND'));

      // No role assigned = full access (super admin)
      if (!admin.adminRoleId || !admin.adminRole) return next();

      if (!admin.adminRole.isActive) return next(new AppError('Rôle inactif', 403, 'FORBIDDEN'));

      const perms = admin.adminRole.permissions as Record<string, { read: boolean; write: boolean; actions: string[] }>;
      const pagePerm = perms[page];

      if (!pagePerm) return next(new AppError('Accès refusé à cette page', 403, 'FORBIDDEN'));

      if (action === 'read' && !pagePerm.read) {
        return next(new AppError('Lecture non autorisée', 403, 'FORBIDDEN'));
      }
      if (action === 'write' && !pagePerm.write) {
        return next(new AppError('Écriture non autorisée', 403, 'FORBIDDEN'));
      }
      if (!['read', 'write'].includes(action) && !pagePerm.actions?.includes(action)) {
        return next(new AppError(`Action "${action}" non autorisée`, 403, 'FORBIDDEN'));
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
