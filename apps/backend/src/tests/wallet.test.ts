import { describe, test, expect, beforeEach } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../app.js';
import { prismaAdmin } from '../lib/prisma.js';

const api = supertest(createApp());
const TENANT_ID = '00000000-0000-0000-0000-000000000098';

beforeEach(async () => {
  await prismaAdmin.tenant.create({
    data: { id: TENANT_ID, name: 'Wallet Test Tenant', plan: 'FREE' },
  });
});

function makeEmail() {
  return `w-${Date.now()}-${Math.random().toString(36).slice(2, 5)}@test.familypay`;
}

async function registerPayer() {
  const res = await api.post('/api/auth/register').send({
    email: makeEmail(), password: 'Test1234!', role: 'PAYER',
    firstName: 'Test', lastName: 'Payer', tenantId: TENANT_ID,
  });
  return { token: res.body.accessToken, userId: res.body.user.id };
}

async function registerBeneficiary() {
  const res = await api.post('/api/auth/register').send({
    email: makeEmail(), password: 'Test1234!', role: 'BENEFICIARY',
    firstName: 'Test', lastName: 'Ben', tenantId: TENANT_ID,
  });
  return { token: res.body.accessToken, userId: res.body.user.id };
}

describe('GET /api/wallets/me', () => {
  test('200 — retourne wallet + enveloppes vides', async () => {
    const { token } = await registerPayer();
    const res = await api.get('/api/wallets/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('balance');
    expect(res.body).toHaveProperty('currency', 'MAD');
    expect(Array.isArray(res.body.envelopes)).toBe(true);
  });

  test('401 — sans token', async () => {
    expect((await api.get('/api/wallets/me')).status).toBe(401);
  });
});

describe('POST /api/wallets/reload', () => {
  test('200 — recharge wallet et crée transaction RELOAD', async () => {
    const { token, userId } = await registerPayer();
    const res = await api.post('/api/wallets/reload')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 500 });
    expect(res.status).toBe(200);
    expect(Number(res.body.balance)).toBe(500);

    const wallet = await prismaAdmin.wallet.findUnique({ where: { userId } });
    const tx = await prismaAdmin.transaction.findFirst({
      where: { toWalletId: wallet!.id, type: 'RELOAD' },
    });
    expect(tx).not.toBeNull();
    expect(Number(tx!.amount)).toBe(500);
  });

  test('200 — rechargements cumulatifs corrects', async () => {
    const { token } = await registerPayer();
    await api.post('/api/wallets/reload').set('Authorization', `Bearer ${token}`).send({ amount: 300 });
    const res = await api.post('/api/wallets/reload').set('Authorization', `Bearer ${token}`).send({ amount: 200 });
    expect(Number(res.body.balance)).toBe(500);
  });

  test('400 — montant négatif refusé', async () => {
    const { token } = await registerPayer();
    const res = await api.post('/api/wallets/reload')
      .set('Authorization', `Bearer ${token}`).send({ amount: -100 });
    expect(res.status).toBe(400);
  });

  test('400 — montant zéro refusé', async () => {
    const { token } = await registerPayer();
    const res = await api.post('/api/wallets/reload')
      .set('Authorization', `Bearer ${token}`).send({ amount: 0 });
    expect(res.status).toBe(400);
  });

  test('403 — BENEFICIARY ne peut pas recharger', async () => {
    const { token } = await registerBeneficiary();
    const res = await api.post('/api/wallets/reload')
      .set('Authorization', `Bearer ${token}`).send({ amount: 100 });
    expect(res.status).toBe(403);
  });
});
