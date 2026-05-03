/**
 * TESTS AUTH — Sprint 1
 * Couvrent register, login, me, refresh, logout sur une vraie DB + Redis.
 */
import { describe, test, expect, beforeEach } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../app.js';
import { prismaAdmin } from '../lib/prisma.js';

const api = supertest(createApp());
const TEST_TENANT_ID = '00000000-0000-0000-0000-000000000099';

// Recréer le tenant avant chaque test (setup.ts le truncate après)
beforeEach(async () => {
  await prismaAdmin.tenant.create({
    data: { id: TEST_TENANT_ID, name: 'Auth Test Tenant', plan: 'FREE' },
  });
});

function makeEmail() {
  return `auth-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.familypay`;
}

async function registerUser(overrides: Record<string, string> = {}) {
  return api.post('/api/auth/register').send({
    email: makeEmail(),
    password: 'Test1234!',
    role: 'PAYER',
    firstName: 'Test',
    lastName: 'User',
    tenantId: TEST_TENANT_ID,
    ...overrides,
  });
}

// ═══════════════════════════════════════════════════════════════
describe('POST /api/auth/register', () => {

  test('201 — crée un user + wallet, retourne les tokens', async () => {
    const res = await registerUser();
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body.user).toHaveProperty('id');
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  test('409 — email déjà utilisé', async () => {
    const email = makeEmail();
    await registerUser({ email });           // premier
    const res = await registerUser({ email }); // doublon
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('EMAIL_ALREADY_EXISTS');
  });

  test('400 — champs manquants', async () => {
    const res = await api.post('/api/auth/register').send({ email: 'x@test.com' });
    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════
describe('POST /api/auth/login', () => {

  test('200 — credentials valides retournent les tokens', async () => {
    const email = makeEmail();
    await registerUser({ email });
    const res = await api.post('/api/auth/login').send({ email, password: 'Test1234!' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  test('401 — mauvais mot de passe', async () => {
    const email = makeEmail();
    await registerUser({ email });
    const res = await api.post('/api/auth/login').send({ email, password: 'WrongPass!' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('INVALID_CREDENTIALS');
  });

  test('401 — email inexistant', async () => {
    const res = await api.post('/api/auth/login').send({
      email: 'nobody@test.familypay',
      password: 'Test1234!',
    });
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════
describe('GET /api/auth/me', () => {

  test('200 — retourne profil + wallet avec token valide', async () => {
    const email = makeEmail();
    const reg = await registerUser({ email });
    const res = await api
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${reg.body.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(email);
    expect(res.body).toHaveProperty('wallet');
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  test('401 — sans token', async () => {
    expect((await api.get('/api/auth/me')).status).toBe(401);
  });

  test('401 — token invalide', async () => {
    const res = await api.get('/api/auth/me').set('Authorization', 'Bearer bad.token.here');
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════
describe('POST /api/auth/refresh', () => {

  test('200 — retourne nouveaux tokens avec rotation', async () => {
    const reg = await registerUser();
    const { refreshToken } = reg.body;
    const res = await api.post('/api/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body.refreshToken).not.toBe(refreshToken);
  });

  test('401 — refresh token déjà consommé (rotation)', async () => {
    const { refreshToken } = (await registerUser()).body;
    await api.post('/api/auth/refresh').send({ refreshToken }); // consomme
    const res = await api.post('/api/auth/refresh').send({ refreshToken }); // rejeu
    expect(res.status).toBe(401);
  });

  test('401 — token invalide', async () => {
    const res = await api.post('/api/auth/refresh').send({ refreshToken: 'fake.token' });
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════
describe('POST /api/auth/logout', () => {

  test('200 — révoque le refresh token', async () => {
    const { accessToken, refreshToken } = (await registerUser()).body;
    const out = await api
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken });
    expect(out.status).toBe(200);

    // Le token révoqué ne doit plus fonctionner
    expect((await api.post('/api/auth/refresh').send({ refreshToken })).status).toBe(401);
  });

  test('401 — logout sans token Bearer', async () => {
    expect((await api.post('/api/auth/logout').send({ refreshToken: 'x' })).status).toBe(401);
  });
});
