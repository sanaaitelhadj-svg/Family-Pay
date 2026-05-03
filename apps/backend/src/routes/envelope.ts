import { Router } from 'express';
import * as ctrl from '../controllers/envelope.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/require-role.js';

export const envelopeRouter = Router();

envelopeRouter.post('/transfer', authenticate, requireRole('PAYER'), ctrl.transfer);
envelopeRouter.get('/',          authenticate, ctrl.list);
envelopeRouter.post('/',         authenticate, requireRole('PAYER'), ctrl.create);
envelopeRouter.get('/:id',       authenticate, ctrl.getOne);
envelopeRouter.patch('/:id',     authenticate, ctrl.update);
envelopeRouter.delete('/:id',    authenticate, requireRole('PAYER'), ctrl.deactivate);
