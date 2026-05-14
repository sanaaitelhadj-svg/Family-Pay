import { Router } from 'express';
import { z } from 'zod';
import { AdminService } from './admin.service.js';
import { authenticate } from '../../middleware/authenticate.js';

export const adminRouter = Router();

adminRouter.get('/fraud-review', authenticate(['ADMIN']), async (_req, res, next) => {
  try {
    const list = await AdminService.listPendingReview();
    res.json(list);
  } catch (err) {
    next(err);
  }
});

adminRouter.patch('/:id/approve', authenticate(['ADMIN']), async (req, res, next) => {
  try {
    await AdminService.approve(req.params['id'] as string);
    res.json({ message: 'Autorisation approuvée et transaction créée.' });
  } catch (err) {
    next(err);
  }
});

adminRouter.patch('/:id/reject', authenticate(['ADMIN']), async (req, res, next) => {
  try {
    const { reason } = z.object({ reason: z.string().min(5) }).parse(req.body);
    await AdminService.reject(req.params['id'] as string, reason);
    res.json({ message: 'Autorisation refusée.' });
  } catch (err) {
    next(err);
  }
});
