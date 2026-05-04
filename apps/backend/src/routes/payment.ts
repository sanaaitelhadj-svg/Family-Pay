import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/authenticate.js';
import * as ctrl from '../controllers/payment.controller.js';

export const paymentRouter = Router();

// POST /api/payments — partenaire traite un paiement QR
paymentRouter.post('/', authenticate, requireRole('PARTNER'), ctrl.qrPayment);
