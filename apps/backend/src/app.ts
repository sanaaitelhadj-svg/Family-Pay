import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { globalRateLimiter } from './middleware/rate-limit.js';
import { errorHandler } from './middleware/error-handler.js';
import { requestLogger } from './middleware/request-logger.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { walletRouter } from './routes/wallet.js';
import { envelopeRouter } from './routes/envelope.js';
import { qrRouter } from './routes/qr.js';
import { paymentRouter } from './routes/payment.js';
import { fundRequestRouter } from './routes/fund-request.js';
import { occasionRouter } from './routes/occasion.js';

import dashboardRouter from './routes/dashboard.js';
import transactionRouter from './routes/transaction.js';
import reportRouter from './routes/report.js';
import { beneficiaryLinkRouter } from './routes/beneficiary-link.js';
import adminRouter from './routes/admin.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({
    origin: process.env.CORS_ORIGINS?.split(',') ?? [
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
    ],
    credentials: true,
  }));
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(requestLogger);
  app.use(globalRateLimiter);

  app.use('/health',         healthRouter);
  app.use('/api/auth',       authRouter);
  app.use('/api/wallets',    walletRouter);
  app.use('/api/envelopes',  envelopeRouter);
  app.use('/api/qrcodes',   qrRouter);
  app.use('/api/payments',      paymentRouter);
  app.use('/api/fund-requests', fundRequestRouter);
  app.use('/api/occasions',     occasionRouter);
  app.use('/api/dashboard',     dashboardRouter);
  app.use('/api/transactions',  transactionRouter);
  app.use('/api/reports',       reportRouter);
  app.use('/api/beneficiary-links', beneficiaryLinkRouter);
  app.use('/api/admin',             adminRouter);

  app.use(errorHandler);
  return app;
}
