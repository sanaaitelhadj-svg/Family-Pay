import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/authenticate.js';
import * as ctrl from '../controllers/qr.controller.js';

export const qrRouter = Router();

// POST /api/qrcodes — bénéficiaire génère un QR dynamique (60s, usage unique)
qrRouter.post('/', authenticate, requireRole('BENEFICIARY'), ctrl.generate);
