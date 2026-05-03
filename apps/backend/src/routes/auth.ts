import { Router, RequestHandler } from 'express';
import * as ctrl from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authRateLimiter } from '../middleware/rate-limit.js';

// Rate limiting désactivé en test pour ne pas bloquer les tests E2E
const limiter: RequestHandler =
  process.env.NODE_ENV === 'test'
    ? (_req, _res, next) => next()
    : authRateLimiter;

export const authRouter = Router();

authRouter.post('/register', limiter, ctrl.register);
authRouter.post('/login',    limiter, ctrl.login);
authRouter.post('/refresh',  limiter, ctrl.refresh);
authRouter.post('/logout',   authenticate, ctrl.logout);
authRouter.get('/me',        authenticate, ctrl.me);
