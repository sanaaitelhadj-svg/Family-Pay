import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/authenticate.js';
import * as ctrl from '../controllers/occasion.controller.js';

export const occasionRouter = Router();

occasionRouter.post('/', authenticate, requireRole('PAYER'), ctrl.create);
occasionRouter.get('/', authenticate, ctrl.list);
occasionRouter.get('/:id', authenticate, ctrl.getOne);
occasionRouter.delete('/:id', authenticate, requireRole('PAYER'), ctrl.deactivate);
