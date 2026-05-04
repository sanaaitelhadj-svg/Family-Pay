import { describe, it, expect, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { getPayerDashboard, getPartnerStats } from '../services/dashboard.service.js';

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_ADMIN_URL ?? 'postgresql://postgres:postgres@localhost:5432/familypay' } },
});

let tenantId: string, payerId: string, benefId: string, partnerId: string;
let benefWalletId: string, partnerWalletId: string;
const s = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

beforeEach(async () => {
  const tenant = await db.tenant.create({ data: { name: `Dash-${s()}`, plan: 'FREE' } });
  tenantId = tenant.id;

  const payer = await db.user.create({ data: { tenantId, role: 'PAYER', email: `payer-${s()}@d.test`, firstName: 'Pay', lastName: 'Er' } });
  payerId = payer.id;
  await db.wallet.create({ data: { tenantId, userId: payer.id, balance: 5000, currency: 'MAD' } });

  const benef = await db.user.create({ data: { tenantId, role: 'BENEFICIARY', email: `benef-${s()}@d.test`, firstName: 'Ben', lastName: 'Ef' } });
  benefId = benef.id;
  const bw = await db.wallet.create({ data: { tenantId, userId: benef.id, balance: 200, currency: 'MAD' } });
  benefWalletId = bw.id;

  const partner = await db.user.create({ data: { tenantId, role: 'PARTNER', email: `partner-${s()}@d.test`, firstName: 'Part', lastName: 'Ner' } });
  partnerId = partner.id;
  const pw = await db.wallet.create({ data: { tenantId, userId: partner.id, balance: 0, currency: 'MAD' } });
  partnerWalletId = pw.id;

  await db.beneficiaryLink.create({ data: { payerId, beneficiaryId: benefId, relationship: 'parent' } });
  await db.envelope.create({ data: { tenantId, walletId: benefWalletId, category: 'FOOD', label: 'Nourriture', balance: 150 } });

  await db.transaction.createMany({
    data: [
      { tenantId, fromWalletId: benefWalletId, toWalletId: partnerWalletId, amount: 80,  type: 'PAYMENT', status: 'COMPLETED' },
      { tenantId, fromWalletId: benefWalletId, toWalletId: partnerWalletId, amount: 120, type: 'PAYMENT', status: 'COMPLETED' },
      { tenantId, fromWalletId: benefWalletId, toWalletId: partnerWalletId, amount: 50,  type: 'PAYMENT', status: 'FAILED'    },
    ],
  });
});

describe('getPayerDashboard', () => {
  it('returns the list of beneficiaries', async () => {
    const dash = await getPayerDashboard(payerId, tenantId);
    expect(dash.totalBeneficiaries).toBe(1);
    expect(dash.beneficiaries[0].userId).toBe(benefId);
  });

  it('returns wallet balance for each beneficiary', async () => {
    const dash = await getPayerDashboard(payerId, tenantId);
    expect(dash.beneficiaries[0].walletBalance).toBe(200);
  });

  it('returns envelopes for each beneficiary', async () => {
    const dash = await getPayerDashboard(payerId, tenantId);
    const envs = dash.beneficiaries[0].envelopes;
    expect(envs.length).toBeGreaterThanOrEqual(1);
    expect(envs[0].category).toBe('FOOD');
    expect(Number(envs[0].balance)).toBe(150);
  });

  it('calculates totalAllocated from envelope balances', async () => {
    const dash = await getPayerDashboard(payerId, tenantId);
    expect(dash.totalAllocated).toBeGreaterThanOrEqual(150);
  });

  it('returns recent transactions', async () => {
    const dash = await getPayerDashboard(payerId, tenantId);
    expect(Array.isArray(dash.recentTransactions)).toBe(true);
    expect(dash.recentTransactions.length).toBeGreaterThan(0);
  });

  it('returns empty dashboard for user with no beneficiaries', async () => {
    const dash = await getPayerDashboard(partnerId, tenantId);
    expect(dash.totalBeneficiaries).toBe(0);
    expect(dash.beneficiaries).toHaveLength(0);
  });
});

describe('getPartnerStats', () => {
  it('returns correct total revenue', async () => {
    const stats = await getPartnerStats(partnerId, tenantId);
    expect(stats.totalRevenue).toBe(200);
  });

  it('returns correct transaction count', async () => {
    const stats = await getPartnerStats(partnerId, tenantId);
    expect(stats.transactionCount).toBe(2);
  });

  it('calculates average basket correctly', async () => {
    const stats = await getPartnerStats(partnerId, tenantId);
    expect(stats.averageBasket).toBe(100);
  });

  it('calculates rejection rate correctly', async () => {
    const stats = await getPartnerStats(partnerId, tenantId);
    expect(stats.rejectionRate).toBeCloseTo(33.33, 1);
  });

  it('returns 24-slot hourly heatmap', async () => {
    const stats = await getPartnerStats(partnerId, tenantId);
    expect(stats.hourlyHeatmap).toHaveLength(24);
  });

  it('returns empty stats for user with no transactions', async () => {
    const stats = await getPartnerStats(payerId, tenantId);
    expect(stats.totalRevenue).toBe(0);
    expect(stats.transactionCount).toBe(0);
  });
});
