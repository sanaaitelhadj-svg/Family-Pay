import { describe, it, expect, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { getTransactions } from '../services/transaction.service.js';

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_ADMIN_URL ?? 'postgresql://postgres:postgres@localhost:5432/familypay' } },
});

let tenantId: string, payerId: string, benefId: string;
let payerWalletId: string, benefWalletId: string, envelopeId: string;
const s = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

beforeEach(async () => {
  const tenant = await db.tenant.create({ data: { name: `Tx-${s()}`, plan: 'FREE' } });
  tenantId = tenant.id;

  const payer = await db.user.create({ data: { tenantId, role: 'PAYER', email: `payer-${s()}@t.test`, firstName: 'P', lastName: 'Y' } });
  payerId = payer.id;
  const pw = await db.wallet.create({ data: { tenantId, userId: payer.id, balance: 1000, currency: 'MAD' } });
  payerWalletId = pw.id;

  const benef = await db.user.create({ data: { tenantId, role: 'BENEFICIARY', email: `benef-${s()}@t.test`, firstName: 'B', lastName: 'N' } });
  benefId = benef.id;
  const bw = await db.wallet.create({ data: { tenantId, userId: benef.id, balance: 500, currency: 'MAD' } });
  benefWalletId = bw.id;

  const env = await db.envelope.create({ data: { tenantId, walletId: benefWalletId, category: 'FOOD', label: 'Nourriture', balance: 200 } });
  envelopeId = env.id;

  await db.transaction.createMany({
    data: [
      { tenantId, fromWalletId: benefWalletId, toWalletId: payerWalletId, amount: 50,  type: 'PAYMENT', status: 'COMPLETED', envelopeId, createdAt: new Date('2026-03-15T10:00:00Z') },
      { tenantId, fromWalletId: benefWalletId, toWalletId: payerWalletId, amount: 75,  type: 'PAYMENT', status: 'COMPLETED', envelopeId, createdAt: new Date('2026-04-20T14:00:00Z') },
      { tenantId, fromWalletId: payerWalletId, toWalletId: benefWalletId, amount: 200, type: 'RELOAD',  status: 'COMPLETED',             createdAt: new Date('2026-04-20T14:00:00Z') },
    ],
  });
});

describe('getTransactions', () => {
  it('returns all transactions for user', async () => {
    const result = await getTransactions(benefId, tenantId, {});
    expect(result.total).toBeGreaterThanOrEqual(2);
  });

  it('paginates results correctly', async () => {
    const result = await getTransactions(benefId, tenantId, { limit: 1, page: 1 });
    expect(result.transactions).toHaveLength(1);
    expect(result.totalPages).toBeGreaterThanOrEqual(2);
    expect(result.page).toBe(1);
  });

  it('filters by startDate', async () => {
    const result = await getTransactions(benefId, tenantId, { startDate: new Date('2026-04-01T00:00:00Z') });
    expect(result.transactions.every(t => t.createdAt >= new Date('2026-04-01T00:00:00Z'))).toBe(true);
  });

  it('filters by endDate', async () => {
    const result = await getTransactions(benefId, tenantId, { endDate: new Date('2026-03-31T23:59:59Z') });
    expect(result.transactions.every(t => t.createdAt <= new Date('2026-03-31T23:59:59Z'))).toBe(true);
  });

  it('filters by envelopeId', async () => {
    const result = await getTransactions(benefId, tenantId, { envelopeId });
    expect(result.transactions.every(t => t.envelopeId === envelopeId)).toBe(true);
  });

  it('filters by type RELOAD', async () => {
    const result = await getTransactions(payerId, tenantId, { type: 'RELOAD' });
    expect(result.transactions.every(t => t.type === 'RELOAD')).toBe(true);
  });

  it('returns empty for page beyond total', async () => {
    const result = await getTransactions(benefId, tenantId, { page: 999, limit: 10 });
    expect(result.transactions).toHaveLength(0);
  });

  it('returns correct totalPages', async () => {
    const result = await getTransactions(benefId, tenantId, { limit: 1 });
    expect(result.totalPages).toBe(result.total);
  });
});
