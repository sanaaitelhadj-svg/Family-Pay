import 'dotenv/config';
import { createApp } from './app.js';
import { createServer } from 'http';
import { initSocket } from './socket.js';
import { logger } from './lib/logger.js';
import { redis } from './lib/redis.js';
import { prisma, prismaAdmin } from './lib/prisma.js';
import bcrypt from 'bcryptjs';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 4000;

async function ensureAdminExists() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;

  try {
    const TENANT_ID = '00000000-0000-0000-0000-000000000001';
    const existing = await prismaAdmin.user.findFirst({ where: { email } });
    if (existing) {
      if (existing.role !== 'ADMIN') {
        await prismaAdmin.user.update({ where: { id: existing.id }, data: { role: 'ADMIN' } });
        logger.info(`Admin role assigned to ${email}`);
      } else {
        logger.info(`Admin already exists: ${email}`);
      }
      return;
    }
    const hash = await bcrypt.hash(password, 12);
    const user = await prismaAdmin.user.create({
      data: { tenantId: TENANT_ID, email, passwordHash: hash, role: 'ADMIN', firstName: 'Super', lastName: 'Admin', kycStatus: 'VERIFIED', isActive: true },
    });
    // Wallet creation is optional — don't crash if it fails
    await prismaAdmin.wallet.create({ data: { tenantId: TENANT_ID, userId: user.id, balance: 0, currency: 'MAD' } }).catch(() => {});
    logger.info(`Admin account created: ${email}`);
  } catch (err: any) {
    // Ne pas crasher le serveur si la création admin échoue
    logger.warn(`ensureAdminExists skipped: ${err.message}`);
  }
}

async function bootstrap() {
  await prisma.$connect();
  logger.info('PostgreSQL connected');

  await redis.ping();
  logger.info('Redis connected');

  await ensureAdminExists();

  const app = createApp();
  const httpServer = createServer(app);
  initSocket(httpServer);

  httpServer.listen(PORT, () => {
    logger.info(`FamilyPay API running on http://localhost:${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV ?? 'development'}`);
  });
}

bootstrap().catch((err) => {
  logger.error('Fatal startup error', err);
  process.exit(1);
});
