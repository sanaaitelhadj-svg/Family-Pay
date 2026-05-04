import { describe, it, expect, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { getMonthlyReport } from '../services/report.service.js';

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_ADMIN_URL ?? 'postgresql://postgres:postgres@localhost:5432/familypay' } },
});

let tenantId: string, payerId: string, benefId: string;
let payerWalletId: string, benefWalletId: string;
const s = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

beforeEach(async () => {
  const tenant = await db.tenant.create({ data: { name: `Rep-${s()}`, plan: 'FREE' } });
  tenantId = tenant.id;

  const payer = await db.user.create({ data: { tenantId, role: 'PAYER', email: `payer-${s()}@r.test`, firstName: 'P', lastName: 'Y' } });
  payerId = payer.id;
  const pw = await db.wallet.create({ data: { tenantId, userId: payer.id, balance: 2000, currency: 'MAD' } });
  payerWalletId = pw.id;

  const benef = await db.user.create({ data: { tenantId, role: 'BENEFICIARY', email: `benef-${s()}@r.test`, firstName: 'B', lastName: 'N' } });
  benefId = benef.id;
  const bw = await db.wallet.create({ data: { tenantId, userId: benef.id, balance: 500, currency: 'MAD' } });
  benefWalletId = bw.id;

  await db.beneficiaryLink.create({ data: { payerId, beneficiaryId: benefId, relationship: 'parent' } });

  const env = await db.envelope.create({ data: { tenantId, walletId: benefWalletId, category: 'HEALTH', label: 'Santé', balance: 300 } });

  await db.transaction.createMany({
    data: [
      { tenantId, fromWalletId: benefWalletId, toWalletId: payerWalletId, amount: 100, type: 'PAYMENT', status: 'COMPLETED', envelopeId: env.id, createdAt: new Date('2026-04-05T10:00:00Z') },
      { tenantId, fromWalletId: benefWalletId, toWalletId: payerWalletId, amount: 200, type: 'PAYMENT', status: 'COMPLETED', envelopeId: env.id, createdAt: new Date('2026-04-20T15:00:00Z') },
      { tenantId, fromWalletId: payerWalletId, toWalletId: payerWalletId, amount: 500, type: 'RELOAD',  status: 'COMPLETED',                      createdAt: new Date('2026-04-01T09:00:00Z') },
    ],
  });
});

describe('getMonthlyReport', () => {
  it('calculates totalSpent for the month', async () => {
    const report = await getMonthlyReport(payerId, tenantId, 2026, 4);
    expect(report.totalSpent).toBe(300);
  });

  it('calculates totalReloaded for the month', async () => {
    const report = await getMonthlyReport(payerId, tenantId, 2026, 4);
    expect(report.totalReloaded).toBe(500);
  });

  it('returns correct transaction count', async () => {
    const report = await getMonthlyReport(payerId, tenantId, 2026, 4);
    expect(report.transactionCount).toBe(2);
  });

  it('groups spending by beneficiary', async () => {
    const report = await getMonthlyReport(payerId, tenantId, 2026, 4);
    expect(report.byBeneficiary).toHaveLength(1);
    expect(report.byBeneficiary[0].beneficiaryId).toBe(benefId);
    expect(report.byBeneficiary[0].spent).toBe(300);
  });

  it('returns empty report for month with no transactions', async () => {
    const report = await getMonthlyReport(payerId, tenantId, 2026, 1);
    expect(report.totalSpent).toBe(0);
    expect(report.transactionCount).toBe(0);
  });
});
