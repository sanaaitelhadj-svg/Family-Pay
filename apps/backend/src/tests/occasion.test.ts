import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createOccasion, listOccasions, getOccasion, deactivateOccasion } from '../services/occasion.service.js';

const dbAdmin = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_ADMIN_URL ?? 'postgresql://postgres:postgres@localhost:5432/familypay' } },
});

let tenantId: string;
let payerId: string;
let beneficiaryId: string;

const future = (days: number) => new Date(Date.now() + days * 86_400_000);

beforeAll(async () => { await dbAdmin.$connect(); });
afterAll(async () => { await dbAdmin.$disconnect(); });

beforeEach(async () => {
  const tenant = await dbAdmin.tenant.create({ data: { name: 'Occasion Test Tenant', plan: 'FREE' } });
  tenantId = tenant.id;
  const s = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const pUser = await dbAdmin.user.create({
    data: { tenantId, role: 'PAYER', email: `payer-${s()}@occ.test`, firstName: 'Karim', lastName: 'Test' },
  });
  payerId = pUser.id;

  const bUser = await dbAdmin.user.create({
    data: { tenantId, role: 'BENEFICIARY', email: `ben-${s()}@occ.test`, firstName: 'Adam', lastName: 'Test' },
  });
  beneficiaryId = bUser.id;
});

describe('Sprint 4 — Occasions', () => {
  test('créer une occasion', async () => {
    const occ = await createOccasion(payerId, tenantId, {
      beneficiaryId, title: 'Anniversaire Adam', targetAmount: 500,
      activatesAt: future(1), expiresAt: future(30),
    });
    expect(occ.id).toBeTruthy();
    expect(occ.title).toBe('Anniversaire Adam');
    expect(Number(occ.targetAmount)).toBe(500);
    expect(occ.isActive).toBe(true);
  });

  test('expiration dans le passé — VALIDATION_ERROR', async () => {
    await expect(
      createOccasion(payerId, tenantId, {
        beneficiaryId, title: 'Test', targetAmount: 100,
        activatesAt: new Date(Date.now() - 7200_000),
        expiresAt: new Date(Date.now() - 3600_000),
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  test('montant cible nul — VALIDATION_ERROR', async () => {
    await expect(
      createOccasion(payerId, tenantId, {
        beneficiaryId, title: 'Test', targetAmount: 0,
        activatesAt: future(1), expiresAt: future(30),
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  test('liste des occasions actives du tenant', async () => {
    await createOccasion(payerId, tenantId, { beneficiaryId, title: 'Aïd', targetAmount: 300, activatesAt: future(1), expiresAt: future(10) });
    await createOccasion(payerId, tenantId, { beneficiaryId, title: 'Rentrée', targetAmount: 200, activatesAt: future(2), expiresAt: future(20) });
    const list = await listOccasions(tenantId);
    expect(list.length).toBe(2);
  });

  test('filtrer par bénéficiaire', async () => {
    const bUser2 = await dbAdmin.user.create({
      data: { tenantId, role: 'BENEFICIARY', email: `ben2-${Date.now()}@occ.test`, firstName: 'Sara', lastName: 'Test' },
    });
    await createOccasion(payerId, tenantId, { beneficiaryId, title: 'Pour Adam', targetAmount: 100, activatesAt: future(1), expiresAt: future(10) });
    await createOccasion(payerId, tenantId, { beneficiaryId: bUser2.id, title: 'Pour Sara', targetAmount: 100, activatesAt: future(1), expiresAt: future(10) });
    const list = await listOccasions(tenantId, beneficiaryId);
    expect(list.every((o) => o.beneficiaryId === beneficiaryId)).toBe(true);
    expect(list.length).toBe(1);
  });

  test('récupérer une occasion par id', async () => {
    const occ = await createOccasion(payerId, tenantId, { beneficiaryId, title: 'Test', targetAmount: 100, activatesAt: future(1), expiresAt: future(10) });
    const found = await getOccasion(occ.id, tenantId);
    expect(found.id).toBe(occ.id);
  });

  test('occasion introuvable — OCCASION_NOT_FOUND', async () => {
    await expect(getOccasion('00000000-0000-0000-0000-000000000000', tenantId)).rejects.toMatchObject({ code: 'OCCASION_NOT_FOUND' });
  });

  test('désactiver une occasion', async () => {
    const occ = await createOccasion(payerId, tenantId, { beneficiaryId, title: 'Test', targetAmount: 100, activatesAt: future(1), expiresAt: future(10) });
    const result = await deactivateOccasion(occ.id, payerId, tenantId);
    expect(result.isActive).toBe(false);
    const list = await listOccasions(tenantId);
    expect(list.find((o) => o.id === occ.id)).toBeUndefined();
  });
});
