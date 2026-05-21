import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';

interface AuditOptions {
  action: string;
  entityType: string;
  getEntityId?: (req: Request) => string;
  getPreviousData?: (req: Request) => Promise<unknown>;
  getNewData?: (req: Request, body: unknown) => unknown;
}

export function auditLog(opts: AuditOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user   = (req as any).user;
    const actorId  = user?.userId ?? user?.id ?? user?.sub ?? null;
    const sessionId = (req as any).adminSessionId ?? null;

    let previousData: unknown = null;
    if (opts.getPreviousData) {
      try { previousData = await opts.getPreviousData(req); } catch { /* ignore */ }
    }

    const originalJson = res.json.bind(res);
    (res as any).json = function (body: unknown) {
      const result    = res.statusCode < 400 ? 'SUCCESS' : 'FAILURE';
      const entityId  = opts.getEntityId ? opts.getEntityId(req) : (req.params['id'] ?? '');
      const newData   = opts.getNewData ? opts.getNewData(req, body) : req.body;
      const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
                        ?? req.socket?.remoteAddress ?? null;

      prisma.auditLog.create({
        data: {
          actorId,
          actorRole: user?.role ?? null,
          action:    opts.action,
          result,
          entityType: opts.entityType,
          entityId:   String(entityId),
          previousData: previousData as any ?? undefined,
          newData:    newData as any ?? undefined,
          ipAddress,
          sessionId,
          deviceInfo: req.headers['user-agent'] ?? null,
        },
      }).catch(() => {});

      return originalJson(body);
    };

    next();
  };
}
