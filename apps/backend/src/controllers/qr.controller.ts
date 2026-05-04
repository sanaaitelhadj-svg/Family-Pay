import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/authenticate.js';
import { generateQrCode } from '../services/qr.service.js';

export async function generate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { envelopeId } = req.body as { envelopeId?: string };
    const result = await generateQrCode(req.user!.id, req.user!.tenantId, envelopeId);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}
