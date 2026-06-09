import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { globalRateLimiter } from './middleware/rate-limit.js';
import { errorHandler } from './middleware/error-handler.js';
import { requestLogger } from './middleware/request-logger.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { allocationRouter } from './modules/allocation/allocation.routes.js';
import { merchantRouter } from './modules/merchant/merchant.routes.js';
import { authorizationRouter } from './modules/authorization/authorization.routes.js';
import { qrRouter } from './modules/qr/qr.routes.js';
import { transactionRouter } from './modules/transaction/transaction.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { mobileRouter } from './modules/mobile/mobile.routes.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);

  app.use(helmet());
  const allowedOrigins = process.env.CORS_ORIGINS?.split(',') ?? [];
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl)
      if (!origin) return callback(null, true);
      // Allow Codespace domains
      if (origin.endsWith('.app.github.dev')) return callback(null, true);
      // Allow localhost
      if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) return callback(null, true);
      // Allow configured origins
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  }));
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(requestLogger);
  app.use(globalRateLimiter);

  app.use('/health', healthRouter);
  app.use('/auth', authRouter);
  app.use('/allocations', allocationRouter);
  app.use('/merchants', merchantRouter);
  app.use('/authorizations', authorizationRouter);
  app.use('/qr', qrRouter);
  app.use('/transactions', transactionRouter);
  app.use('/admin', adminRouter);
  app.use('/mobile', mobileRouter);

  app.use(errorHandler);

  return app;
}
