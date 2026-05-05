import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/require-role.js';
import * as ctrl from '../controllers/beneficiary-link.controller.js';

export const beneficiaryLinkRouter = Router();

beneficiaryLinkRouter.post('/',                     authenticate, requireRole('PAYER'), ctrl.create);
beneficiaryLinkRouter.get('/',                      authenticate, requireRole('PAYER'), ctrl.list);
beneficiaryLinkRouter.delete('/:beneficiaryId',     authenticate, requireRole('PAYER'), ctrl.remove);
