import { describe, test, expect, beforeEach } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../app.js';
import { prismaAdmin } from '../lib/prisma.js';

const api = supertest(createApp());
const TENANT_ID = '00000000-0000-0000-0000-000000000097';

let payerToken: string;
let payerId: string;
let benToken: string;
let benId: string;

function makeEmail() {
  return `e-${Date.now()}-${Math.random().toString(36).slice(2, 5)}@test.familypay`;
}

beforeEach(async () => {
  await prismaAdmin.tenant.create({
    data: { id: TENANT_ID, name: 'Envelope Test Tenant', plan: 'FREE' },
  });

  const payerRes = await api.post('/api/auth/register').send({
    email: makeEmail(), password: 'Test1234!', role: 'PAYER',
    firstName: 'Test', lastName: 'Payer', tenantId: TENANT_ID,
  });
  payerToken = payerRes.body.accessToken;
  payerId = payerRes.body.user.id;

  const benRes = await api.post('/api/auth/register').send({
    email: makeEmail(), password: 'Test1234!', role: 'BENEFICIARY',
    firstName: 'Test', lastName: 'Ben', tenantId: TENANT_ID,
  });
  benToken = benRes.body.accessToken;
  benId = benRes.body.user.id;

  await prismaAdmin.beneficiaryLink.create({
    data: { payerId, beneficiaryId: benId, relationship: 'enfant' },
  });
});

async function createEnvelope(category = 'FOOD', label = 'Test') {
  return api.post('/api/envelopes')
    .set('Authorization', `Bearer ${payerToken}`)
    .send({ beneficiaryId: benId, category, label });
}

describe('POST /api/envelopes', () => {
  test('201 — PAYER crée une enveloppe pour bénéficiaire lié', async () => {
    const res = await createEnvelope('FOOD', 'Nourriture');
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.label).toBe('Nourriture');
    expect(res.body.category).toBe('FOOD');
    expect(Number(res.body.balance)).toBe(0);
  });

  test('403 — BENEFICIARY ne peut pas créer une enveloppe', async () => {
    const res = await api.post('/api/envelopes')
      .set('Authorization', `Bearer ${benToken}`)
      .send({ beneficiaryId: benId, category: 'FOOD', label: 'Test' });
    expect(res.status).toBe(403);
  });

  test('403 — PAYER ne peut pas créer pour un non-lié', async () => {
    const other = await api.post('/api/auth/register').send({
      email: makeEmail(), password: 'Test1234!', role: 'BENEFICIARY',
      firstName: 'Other', lastName: 'Ben', tenantId: TENANT_ID,
    });
    const res = await api.post('/api/envelopes')
      .set('Authorization', `Bearer ${payerToken}`)
      .send({ beneficiaryId: other.body.user.id, category: 'FOOD', label: 'Test' });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/envelopes', () => {
  test('200 — BENEFICIARY voit ses enveloppes', async () => {
    await createEnvelope('FOOD', 'Nourriture');
    const res = await api.get('/api/envelopes').set('Authorization', `Bearer ${benToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].label).toBe('Nourriture');
  });

  test('200 — PAYER voit les enveloppes du bénéficiaire via ?beneficiaryId', async () => {
    await createEnvelope('HEALTH', 'Santé');
    const res = await api.get(`/api/envelopes?beneficiaryId=${benId}`)
      .set('Authorization', `Bearer ${payerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });
});

describe('PATCH /api/envelopes/:id', () => {
  test('200 — met à jour label et maxPerTransaction', async () => {
    const { body: env } = await createEnvelope('FOOD', 'Original');
    const res = await api.patch(`/api/envelopes/${env.id}`)
      .set('Authorization', `Bearer ${payerToken}`)
      .send({ label: 'Modifié', maxPerTransaction: 150 });
    expect(res.status).toBe(200);
    expect(res.body.label).toBe('Modifié');
    expect(Number(res.body.maxPerTransaction)).toBe(150);
  });
});

describe('POST /api/envelopes/transfer', () => {
  test('200 — transfère entre enveloppes et crée transaction TRANSFER', async () => {
    const { body: env1 } = await createEnvelope('FOOD', 'Nourriture');
    const { body: env2 } = await createEnvelope('HEALTH', 'Santé');

    await prismaAdmin.envelope.update({ where: { id: env1.id }, data: { balance: 300 } });

    const res = await api.post('/api/envelopes/transfer')
      .set('Authorization', `Bearer ${payerToken}`)
      .send({ fromEnvelopeId: env1.id, toEnvelopeId: env2.id, amount: 100 });

    expect(res.status).toBe(200);
    expect(res.body.from.newBalance).toBe(200);
    expect(res.body.to.newBalance).toBe(100);
    expect(res.body.transaction.type).toBe('TRANSFER');
  });

  test('400 — solde insuffisant', async () => {
    const { body: env1 } = await createEnvelope('FOOD', 'Nourriture');
    const { body: env2 } = await createEnvelope('HEALTH', 'Santé');
    const res = await api.post('/api/envelopes/transfer')
      .set('Authorization', `Bearer ${payerToken}`)
      .send({ fromEnvelopeId: env1.id, toEnvelopeId: env2.id, amount: 9999 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INSUFFICIENT_BALANCE');
  });

  test('400 — même enveloppe source et cible', async () => {
    const { body: env1 } = await createEnvelope('FOOD', 'Nourriture');
    const res = await api.post('/api/envelopes/transfer')
      .set('Authorization', `Bearer ${payerToken}`)
      .send({ fromEnvelopeId: env1.id, toEnvelopeId: env1.id, amount: 50 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('SAME_ENVELOPE_TRANSFER');
  });
});

describe('DELETE /api/envelopes/:id', () => {
  test('200 — désactive l\'enveloppe (soft delete)', async () => {
    const { body: env } = await createEnvelope('LEISURE', 'Loisirs');
    const res = await api.delete(`/api/envelopes/${env.id}`)
      .set('Authorization', `Bearer ${payerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);
  });
});
