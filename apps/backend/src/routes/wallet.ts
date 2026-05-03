import { Router } from 'express';
import * as ctrl from '../controllers/wallet.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/require-role.js';

export const walletRouter = Router();

walletRouter.get('/me',     authenticate, ctrl.me);
walletRouter.post('/reload', authenticate, requireRole('PAYER'), ctrl.reload);
