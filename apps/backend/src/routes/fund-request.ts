import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/authenticate.js';
import * as ctrl from '../controllers/fund-request.controller.js';

export const fundRequestRouter = Router();

// Bénéficiaire envoie une demande
fundRequestRouter.post('/', authenticate, requireRole('BENEFICIARY'), ctrl.send);
// Liste des demandes (BENEFICIARY = envoyées, PAYER = reçues)
fundRequestRouter.get('/', authenticate, requireRole('BENEFICIARY', 'PAYER'), ctrl.list);
// Payeur approuve ou refuse
fundRequestRouter.patch('/:id/approve', authenticate, requireRole('PAYER'), ctrl.approve);
fundRequestRouter.patch('/:id/reject', authenticate, requireRole('PAYER'), ctrl.reject);
