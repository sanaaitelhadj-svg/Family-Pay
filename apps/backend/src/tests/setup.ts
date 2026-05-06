import { PrismaClient } from '@prisma/client';

// Superuser pour les opérations de maintenance (TRUNCATE, DROP, etc.)
const dbAdmin = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres:postgres@localhost:5432/familypay' } },
});

// TRUNCATE bypass les triggers ROW-level (deleteMany serait bloqué sur transactions)
afterEach(async () => {
  await dbAdmin.$executeRawUnsafe(`
    TRUNCATE TABLE
      occasions, fund_requests, transactions, qr_codes,
      rules, envelopes, partners, wallets,
      beneficiary_links, users, tenants
    RESTART IDENTITY CASCADE
  `);
});

afterAll(async () => {
  await dbAdmin.$disconnect();
});
