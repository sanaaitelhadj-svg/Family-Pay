import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';

export async function sessionMiddleware(req: Request, _res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user) return next();
  const actorId = user?.userId ?? user?.id ?? user?.sub;
  if (!actorId) return next();

  try {
    const session = await prisma.adminSession.findFirst({
      where: { adminId: actorId, status: 'ACTIVE' },
      orderBy: { lastActivityAt: 'desc' },
    });
    if (session) {
      (req as any).adminSessionId = session.id;
      prisma.adminSession.update({
        where: { id: session.id },
        data: { lastActivityAt: new Date() },
      }).catch(() => {});
    }
  } catch { /* ignore */ }

  next();
}
