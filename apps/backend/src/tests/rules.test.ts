import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { withTenant } from '../lib/prisma.js';
import { canProcess } from '../services/rules.service.js';

const dbAdmin = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_ADMIN_URL ?? 'postgresql://postgres:postgres@localhost:5432/familypay' } },
});

let tenantId: string;
let envelopeId: string;
let walletId: string;

beforeAll(async () => { await dbAdmin.$connect(); });
afterAll(async () => { await dbAdmin.$disconnect(); });

beforeEach(async () => {
  const tenant = await dbAdmin.tenant.create({ data: { name: 'Rules Test Tenant', plan: 'FREE' } });
  tenantId = tenant.id;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const user = await dbAdmin.user.create({
    data: { tenantId, role: 'BENEFICIARY', email: `rules-${suffix}@rules.test`, firstName: 'Rules', lastName: 'Test' },
  });
  const wallet = await dbAdmin.wallet.create({ data: { tenantId, userId: user.id, balance: 1000, currency: 'MAD' } });
  walletId = wallet.id;
  const envelope = await dbAdmin.envelope.create({
    data: { tenantId, walletId: wallet.id, category: 'FOOD', label: 'Test Envelope', balance: 500 },
  });
  envelopeId = envelope.id;
});

async function createRule(type: 'TIME' | 'DAY' | 'DAILY_LIMIT', conditions: Record<string, unknown>) {
  return dbAdmin.rule.create({ data: { tenantId, envelopeId, type, conditions, isActive: true } });
}

describe('Sprint 3 — Rules Engine', () => {
  test('sans règle — paiement toujours autorisé', async () => {
    await expect(withTenant(tenantId, (tx) => canProcess(tx, envelopeId, 100, null))).resolves.toBeUndefined();
  });

  test('enveloppe inactive — ENVELOPE_INACTIVE', async () => {
    await dbAdmin.envelope.update({ where: { id: envelopeId }, data: { isActive: false } });
    await expect(withTenant(tenantId, (tx) => canProcess(tx, envelopeId, 100, null))).rejects.toMatchObject({ code: 'ENVELOPE_INACTIVE' });
  });

  test('enveloppe introuvable — ENVELOPE_NOT_FOUND', async () => {
    await expect(
      withTenant(tenantId, (tx) => canProcess(tx, '00000000-0000-0000-0000-000000000000', 100, null)),
    ).rejects.toMatchObject({ code: 'ENVELOPE_NOT_FOUND' });
  });

  test('règle TIME — paiement dans les horaires autorisé', async () => {
    await createRule('TIME', { start_hour: 8, end_hour: 20 });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 0, 5, 12, 0, 0)); // lundi 12:00
    await expect(withTenant(tenantId, (tx) => canProcess(tx, envelopeId, 100, null))).resolves.toBeUndefined();
    vi.useRealTimers();
  });

  test('règle TIME — paiement hors horaires bloqué (OUT_OF_HOURS)', async () => {
    await createRule('TIME', { start_hour: 8, end_hour: 20 });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 0, 5, 22, 0, 0)); // lundi 22:00
    await expect(withTenant(tenantId, (tx) => canProcess(tx, envelopeId, 100, null))).rejects.toMatchObject({ code: 'OUT_OF_HOURS' });
    vi.useRealTimers();
  });

  test('règle DAY — jour autorisé passe', async () => {
    await createRule('DAY', { allowed_days: [1, 2, 3, 4, 5] }); // lundi-vendredi
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 0, 5, 12, 0, 0)); // 2026-01-05 = lundi (day 1)
    await expect(withTenant(tenantId, (tx) => canProcess(tx, envelopeId, 100, null))).resolves.toBeUndefined();
    vi.useRealTimers();
  });

  test('règle DAY — jour interdit bloqué (RULE_VIOLATED)', async () => {
    await createRule('DAY', { allowed_days: [1, 2, 3, 4, 5] });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 0, 4, 12, 0, 0)); // 2026-01-04 = dimanche (day 0)
    await expect(withTenant(tenantId, (tx) => canProcess(tx, envelopeId, 100, null))).rejects.toMatchObject({ code: 'RULE_VIOLATED' });
    vi.useRealTimers();
  });

  test('DAILY_LIMIT — sous le plafond, autorisé', async () => {
    await createRule('DAILY_LIMIT', { daily_max: 200 });
    await expect(withTenant(tenantId, (tx) => canProcess(tx, envelopeId, 100, null))).resolves.toBeUndefined();
  });

  test('DAILY_LIMIT — plafond exact atteint, bloqué', async () => {
    await createRule('DAILY_LIMIT', { daily_max: 200 });
    await dbAdmin.transaction.create({
      data: { tenantId, fromWalletId: walletId, envelopeId, amount: 200, type: 'PAYMENT', status: 'COMPLETED' },
    });
    await expect(withTenant(tenantId, (tx) => canProcess(tx, envelopeId, 1, null))).rejects.toMatchObject({ code: 'DAILY_LIMIT_REACHED' });
  });

  test('DAILY_LIMIT — cumulatif : 2 paiements dépassent le plafond', async () => {
    await createRule('DAILY_LIMIT', { daily_max: 200 });
    await dbAdmin.transaction.create({
      data: { tenantId, fromWalletId: walletId, envelopeId, amount: 150, type: 'PAYMENT', status: 'COMPLETED' },
    });
    await expect(withTenant(tenantId, (tx) => canProcess(tx, envelopeId, 60, null))).rejects.toMatchObject({ code: 'DAILY_LIMIT_REACHED' });
  });

  test('maxPerTransaction — sous le plafond, autorisé', async () => {
    await dbAdmin.envelope.update({ where: { id: envelopeId }, data: { maxPerTransaction: 200 } });
    await expect(withTenant(tenantId, (tx) => canProcess(tx, envelopeId, 150, null))).resolves.toBeUndefined();
  });

  test('maxPerTransaction — dépassement bloqué (AMOUNT_EXCEEDS_LIMIT)', async () => {
    await dbAdmin.envelope.update({ where: { id: envelopeId }, data: { maxPerTransaction: 100 } });
    await expect(withTenant(tenantId, (tx) => canProcess(tx, envelopeId, 101, null))).rejects.toMatchObject({ code: 'AMOUNT_EXCEEDS_LIMIT' });
  });

  test('allowedPartnerIds — partenaire autorisé passe', async () => {
    const pid = '00000000-0000-0000-0000-000000000001';
    await dbAdmin.envelope.update({ where: { id: envelopeId }, data: { allowedPartnerIds: [pid] } });
    await expect(withTenant(tenantId, (tx) => canProcess(tx, envelopeId, 100, pid))).resolves.toBeUndefined();
  });

  test('allowedPartnerIds — partenaire non listé bloqué (PARTNER_NOT_ALLOWED)', async () => {
    await dbAdmin.envelope.update({ where: { id: envelopeId }, data: { allowedPartnerIds: ['00000000-0000-0000-0000-000000000001'] } });
    await expect(withTenant(tenantId, (tx) => canProcess(tx, envelopeId, 100, '00000000-0000-0000-0000-000000000002'))).rejects.toMatchObject({ code: 'PARTNER_NOT_ALLOWED' });
  });

  test('règle inactive — non appliquée', async () => {
    const rule = await createRule('TIME', { start_hour: 23, end_hour: 24 });
    await dbAdmin.rule.update({ where: { id: rule.id }, data: { isActive: false } });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 0, 5, 12, 0, 0)); // heure hors de la fenêtre mais règle inactive
    await expect(withTenant(tenantId, (tx) => canProcess(tx, envelopeId, 100, null))).resolves.toBeUndefined();
    vi.useRealTimers();
  });

  test('règles multiples — toutes doivent passer', async () => {
    await createRule('TIME', { start_hour: 8, end_hour: 20 });
    await createRule('DAILY_LIMIT', { daily_max: 500 });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 0, 5, 10, 0, 0)); // 10:00, sous le plafond
    await expect(withTenant(tenantId, (tx) => canProcess(tx, envelopeId, 100, null))).resolves.toBeUndefined();
    vi.useRealTimers();
  });
});
