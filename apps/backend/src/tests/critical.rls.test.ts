/**
 * TESTS CRITIQUES FINTECH — Sprint 0b
 * Ces tests DOIVENT passer à 100% avant tout déploiement.
 * Ils tournent sur une vraie base PostgreSQL (pas de mock).
 */
import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';

// Clients séparés pour simuler deux tenants indépendants
const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

// ── HELPERS ────────────────────────────────────────────────────────────────────
async function createTenant(name: string) {
  return db.tenant.create({ data: { name, plan: 'FREE' } });
}

async function createUser(tenantId: string, role: 'PAYER' | 'BENEFICIARY' | 'PARTNER') {
  const suffix = Math.random().toString(36).slice(2, 8);
  return db.user.create({
    data: {
      tenantId,
      role,
      email: `${role.toLowerCase()}-${suffix}@test.familypay`,
      firstName: 'Test',
      lastName: role,
    },
  });
}

async function createWallet(tenantId: string, userId: string, balance = 500) {
  return db.wallet.create({
    data: { tenantId, userId, balance, currency: 'MAD' },
  });
}

// Exécuter dans le contexte d'un tenant (active les politiques RLS)
async function withTenantCtx<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
  return db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT set_tenant_context($1)`, tenantId);
    return fn();
  }) as Promise<T>;
}

// ── SETUP / TEARDOWN ──────────────────────────────────────────────────────────
let tenantA: { id: string };
let tenantB: { id: string };

beforeAll(async () => {
  await db.$connect();
});

afterAll(async () => {
  await db.$disconnect();
});

beforeEach(async () => {
  // Créer deux tenants frais pour chaque test
  tenantA = await createTenant('Tenant A — Test');
  tenantB = await createTenant('Tenant B — Test');
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 1 — RLS : ISOLATION MULTI-TENANT
// ═══════════════════════════════════════════════════════════════════════════════
describe('CRITICAL — RLS Multi-tenant Isolation', () => {

  test('wallet created in tenant B is invisible from tenant A context', async () => {
    const userB = await createUser(tenantB.id, 'PAYER');
    const walletB = await createWallet(tenantB.id, userB.id, 1000);

    // Dans le contexte de tenant A, le wallet de tenant B ne doit PAS apparaître
    const walletsVisibleFromA = await withTenantCtx(tenantA.id, () =>
      db.wallet.findMany(),
    );

    const visibleIds = walletsVisibleFromA.map((w) => w.id);
    expect(visibleIds).not.toContain(walletB.id);
  });

  test('envelopes from tenant B are not visible from tenant A', async () => {
    const userB = await createUser(tenantB.id, 'BENEFICIARY');
    const walletB = await createWallet(tenantB.id, userB.id);

    // Créer une enveloppe pour tenant B (hors contexte RLS — admin)
    const envelopeB = await db.envelope.create({
      data: {
        tenantId: tenantB.id,
        walletId: walletB.id,
        category: 'FOOD',
        label: 'Nourriture Tenant B',
        balance: 300,
      },
    });

    const envelopesFromA = await withTenantCtx(tenantA.id, () =>
      db.envelope.findMany(),
    );

    expect(envelopesFromA.map((e) => e.id)).not.toContain(envelopeB.id);
  });

  test('transactions from tenant B are not visible from tenant A', async () => {
    const payerA  = await createUser(tenantA.id, 'PAYER');
    const payerB  = await createUser(tenantB.id, 'PAYER');
    const wA = await createWallet(tenantA.id, payerA.id, 500);
    const wB = await createWallet(tenantB.id, payerB.id, 500);

    // Transaction dans tenant B
    const txB = await db.transaction.create({
      data: {
        tenantId: tenantB.id,
        fromWalletId: wB.id,
        amount: 100,
        type: 'PAYMENT',
        status: 'COMPLETED',
      },
    });

    const txsFromA = await withTenantCtx(tenantA.id, () =>
      db.transaction.findMany(),
    );

    expect(txsFromA.map((t) => t.id)).not.toContain(txB.id);
  });

  test('tenant A can only see its own wallets — not tenant B wallets', async () => {
    const userA1 = await createUser(tenantA.id, 'PAYER');
    const userA2 = await createUser(tenantA.id, 'BENEFICIARY');
    const userB1 = await createUser(tenantB.id, 'PAYER');

    const wA1 = await createWallet(tenantA.id, userA1.id);
    const wA2 = await createWallet(tenantA.id, userA2.id);
    const wB1 = await createWallet(tenantB.id, userB1.id);

    const walletsFromA = await withTenantCtx(tenantA.id, () =>
      db.wallet.findMany(),
    );

    const ids = walletsFromA.map((w) => w.id);
    expect(ids).toContain(wA1.id);
    expect(ids).toContain(wA2.id);
    expect(ids).not.toContain(wB1.id);
  });

  test('qr_codes from tenant B are invisible from tenant A', async () => {
    const benB = await createUser(tenantB.id, 'BENEFICIARY');

    const qrB = await db.qrCode.create({
      data: {
        tenantId: tenantB.id,
        beneficiaryId: benB.id,
        token: `qr-test-token-${Date.now()}`,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const qrsFromA = await withTenantCtx(tenantA.id, () =>
      db.qrCode.findMany(),
    );

    expect(qrsFromA.map((q) => q.id)).not.toContain(qrB.id);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 2 — TRANSACTIONS IMMUABLES
// ═══════════════════════════════════════════════════════════════════════════════
describe('CRITICAL — Transactions Immutability', () => {

  test('UPDATE on transactions table must fail with trigger error', async () => {
    const payer = await createUser(tenantA.id, 'PAYER');
    const wallet = await createWallet(tenantA.id, payer.id, 1000);

    const tx = await db.transaction.create({
      data: {
        tenantId: tenantA.id,
        fromWalletId: wallet.id,
        amount: 150,
        type: 'PAYMENT',
        status: 'COMPLETED',
      },
    });

    // Toute tentative de modification DOIT échouer
    await expect(
      db.transaction.update({
        where: { id: tx.id },
        data: { amount: 999 },
      }),
    ).rejects.toThrow(/IMMUTABLE_TRANSACTION/);
  });

  test('UPDATE status on transaction must fail', async () => {
    const payer = await createUser(tenantA.id, 'PAYER');
    const wallet = await createWallet(tenantA.id, payer.id, 500);

    const tx = await db.transaction.create({
      data: {
        tenantId: tenantA.id,
        fromWalletId: wallet.id,
        amount: 50,
        type: 'PAYMENT',
        status: 'PENDING',
      },
    });

    await expect(
      db.transaction.update({
        where: { id: tx.id },
        data: { status: 'COMPLETED' },
      }),
    ).rejects.toThrow(/IMMUTABLE_TRANSACTION/);
  });

  test('DELETE on transactions table must fail', async () => {
    const payer = await createUser(tenantA.id, 'PAYER');
    const wallet = await createWallet(tenantA.id, payer.id, 500);

    const tx = await db.transaction.create({
      data: {
        tenantId: tenantA.id,
        fromWalletId: wallet.id,
        amount: 75,
        type: 'RELOAD',
        status: 'COMPLETED',
      },
    });

    await expect(
      db.transaction.delete({ where: { id: tx.id } }),
    ).rejects.toThrow(/IMMUTABLE_TRANSACTION/);
  });

  test('reversal is a NEW transaction, not an update', async () => {
    const payer = await createUser(tenantA.id, 'PAYER');
    const wallet = await createWallet(tenantA.id, payer.id, 500);

    const originalTx = await db.transaction.create({
      data: {
        tenantId: tenantA.id,
        fromWalletId: wallet.id,
        amount: 200,
        type: 'PAYMENT',
        status: 'COMPLETED',
      },
    });

    // Annulation = nouvelle transaction REVERSAL (pas d'UPDATE)
    const reversalTx = await db.transaction.create({
      data: {
        tenantId: tenantA.id,
        toWalletId: wallet.id,
        amount: 200,
        type: 'REVERSAL',
        status: 'COMPLETED',
        reversalOfId: originalTx.id,
      },
    });

    expect(reversalTx.id).not.toBe(originalTx.id);
    expect(reversalTx.reversalOfId).toBe(originalTx.id);

    // L'original est INCHANGÉ
    const original = await db.transaction.findUnique({ where: { id: originalTx.id } });
    expect(original?.status).toBe('COMPLETED');
    expect(original?.amount.toString()).toBe('200');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 3 — CONTRAINTES FINANCIÈRES (SOLDE JAMAIS NÉGATIF)
// ═══════════════════════════════════════════════════════════════════════════════
describe('CRITICAL — Financial Constraints', () => {

  test('wallet balance cannot go below zero (PostgreSQL CHECK constraint)', async () => {
    const payer = await createUser(tenantA.id, 'PAYER');
    const wallet = await createWallet(tenantA.id, payer.id, 100);

    await expect(
      db.wallet.update({
        where: { id: wallet.id },
        data: { balance: -1 },
      }),
    ).rejects.toThrow(/positive_wallet_balance|check.*constraint/i);
  });

  test('envelope balance cannot go below zero (PostgreSQL CHECK constraint)', async () => {
    const ben = await createUser(tenantA.id, 'BENEFICIARY');
    const wallet = await createWallet(tenantA.id, ben.id, 500);

    const envelope = await db.envelope.create({
      data: {
        tenantId: tenantA.id,
        walletId: wallet.id,
        category: 'FOOD',
        label: 'Nourriture',
        balance: 200,
      },
    });

    await expect(
      db.envelope.update({
        where: { id: envelope.id },
        data: { balance: -0.01 },
      }),
    ).rejects.toThrow(/positive_envelope_balance|check.*constraint/i);
  });

  test('transaction amount must be strictly positive', async () => {
    const payer = await createUser(tenantA.id, 'PAYER');
    const wallet = await createWallet(tenantA.id, payer.id, 500);

    await expect(
      db.transaction.create({
        data: {
          tenantId: tenantA.id,
          fromWalletId: wallet.id,
          amount: 0,
          type: 'PAYMENT',
          status: 'COMPLETED',
        },
      }),
    ).rejects.toThrow(/positive_transaction_amount|check.*constraint/i);

    await expect(
      db.transaction.create({
        data: {
          tenantId: tenantA.id,
          fromWalletId: wallet.id,
          amount: -50,
          type: 'PAYMENT',
          status: 'COMPLETED',
        },
      }),
    ).rejects.toThrow(/positive_transaction_amount|check.*constraint/i);
  });

  test('wallet balance set to exactly 0 is allowed (boundary)', async () => {
    const payer = await createUser(tenantA.id, 'PAYER');
    const wallet = await createWallet(tenantA.id, payer.id, 100);

    const updated = await db.wallet.update({
      where: { id: wallet.id },
      data: { balance: 0 },
    });

    expect(Number(updated.balance)).toBe(0);
  });

  test('payment atomicity — debit rollback if credit fails', async () => {
    const ben   = await createUser(tenantA.id, 'BENEFICIARY');
    const payer = await createUser(tenantA.id, 'PAYER');
    const benWallet   = await createWallet(tenantA.id, ben.id, 300);
    const payerWallet = await createWallet(tenantA.id, payer.id, 1000);

    const balanceBefore = Number(benWallet.balance);

    // Simuler une transaction atomique qui échoue en milieu de traitement
    await expect(
      db.$transaction(async (tx) => {
        // Débit bénéficiaire
        await tx.wallet.update({
          where: { id: benWallet.id },
          data: { balance: { decrement: 100 } },
        });
        // Simuler une erreur après le débit (ex: partenaire invalide)
        throw new Error('PARTNER_NOT_FOUND — simulated failure');
      }),
    ).rejects.toThrow('PARTNER_NOT_FOUND');

    // Le solde doit être INCHANGÉ (rollback automatique)
    const walletAfter = await db.wallet.findUnique({ where: { id: benWallet.id } });
    expect(Number(walletAfter?.balance)).toBe(balanceBefore);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 4 — CONTRAINTES D'INTÉGRITÉ
// ═══════════════════════════════════════════════════════════════════════════════
describe('CRITICAL — Data Integrity', () => {

  test('one wallet per user (unique constraint)', async () => {
    const payer = await createUser(tenantA.id, 'PAYER');
    await createWallet(tenantA.id, payer.id, 100);

    await expect(
      createWallet(tenantA.id, payer.id, 200),
    ).rejects.toThrow(/unique.*constraint|duplicate key/i);
  });

  test('beneficiary link payer+beneficiary pair is unique', async () => {
    const payer = await createUser(tenantA.id, 'PAYER');
    const ben   = await createUser(tenantA.id, 'BENEFICIARY');

    await db.beneficiaryLink.create({
      data: { payerId: payer.id, beneficiaryId: ben.id, relationship: 'enfant' },
    });

    await expect(
      db.beneficiaryLink.create({
        data: { payerId: payer.id, beneficiaryId: ben.id, relationship: 'ami' },
      }),
    ).rejects.toThrow(/unique.*constraint|duplicate key/i);
  });

  test('QR code token must be unique', async () => {
    const ben = await createUser(tenantA.id, 'BENEFICIARY');
    const token = `unique-token-${Date.now()}`;

    await db.qrCode.create({
      data: {
        tenantId: tenantA.id,
        beneficiaryId: ben.id,
        token,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    await expect(
      db.qrCode.create({
        data: {
          tenantId: tenantA.id,
          beneficiaryId: ben.id,
          token, // même token
          expiresAt: new Date(Date.now() + 60_000),
        },
      }),
    ).rejects.toThrow(/unique.*constraint|duplicate key/i);
  });
});
