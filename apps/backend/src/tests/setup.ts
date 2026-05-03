import { PrismaClient } from '@prisma/client';

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

// TRUNCATE bypass les triggers ROW-level (deleteMany serait bloqué sur transactions)
afterEach(async () => {
  await db.$executeRawUnsafe(`
    TRUNCATE TABLE
      occasions, fund_requests, transactions, qr_codes,
      rules, envelopes, partners, wallets,
      beneficiary_links, users, tenants
    RESTART IDENTITY CASCADE
  `);
});

afterAll(async () => {
  await db.$disconnect();
});
