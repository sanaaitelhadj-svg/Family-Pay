import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { generateQrCode, decodeQrToken } from '../services/qr.service.js';

const dbAdmin = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_ADMIN_URL ?? 'postgresql://postgres:postgres@localhost:5432/familypay' } },
});

let tenantId: string;
let beneficiaryId: string;

beforeAll(async () => { await dbAdmin.$connect(); });
afterAll(async () => { await dbAdmin.$disconnect(); });

beforeEach(async () => {
  const tenant = await dbAdmin.tenant.create({ data: { name: 'QR Test Tenant', plan: 'FREE' } });
  tenantId = tenant.id;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const user = await dbAdmin.user.create({
    data: { tenantId, role: 'BENEFICIARY', email: `ben-${suffix}@qr.test`, firstName: 'Ben', lastName: 'Test' },
  });
  beneficiaryId = user.id;
  await dbAdmin.wallet.create({ data: { tenantId, userId: user.id, balance: 500, currency: 'MAD' } });
});

describe('Sprint 3 — QR Code Generation', () => {
  test('generate returns id, token et expiresAt', async () => {
    const result = await generateQrCode(beneficiaryId, tenantId);
    expect(result.id).toBeTruthy();
    expect(result.token).toBeTruthy();
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  test('token est un JWT valide avec les bons claims', async () => {
    const { token } = await generateQrCode(beneficiaryId, tenantId);
    const payload = decodeQrToken(token);
    expect(payload.sub).toBe(beneficiaryId);
    expect(payload.tenantId).toBe(tenantId);
    expect(payload.jti).toBeTruthy();
  });

  test('token contient envelopeId quand spécifié', async () => {
    const wallet = await dbAdmin.wallet.findUnique({ where: { userId: beneficiaryId } });
    const envelope = await dbAdmin.envelope.create({
      data: { tenantId, walletId: wallet!.id, category: 'FOOD', label: 'Test', balance: 200 },
    });
    const { token } = await generateQrCode(beneficiaryId, tenantId, envelope.id);
    const payload = decodeQrToken(token);
    expect(payload.envelopeId).toBe(envelope.id);
  });

  test('token JWT expiré après 60s (fake Date)', async () => {
    const { token } = await generateQrCode(beneficiaryId, tenantId);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(Date.now() + 61_000));
    expect(() => decodeQrToken(token)).toThrow();
    vi.useRealTimers();
  });

  test('10 générations simultanées — tokens tous uniques', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => generateQrCode(beneficiaryId, tenantId)),
    );
    expect(results).toHaveLength(10);
    expect(new Set(results.map((r) => r.token)).size).toBe(10);
  });
});
