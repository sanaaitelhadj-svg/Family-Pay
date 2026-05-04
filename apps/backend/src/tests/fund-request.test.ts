import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { sendFundRequest, listFundRequests, approveFundRequest, rejectFundRequest } from '../services/fund-request.service.js';

const dbAdmin = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_ADMIN_URL ?? 'postgresql://postgres:postgres@localhost:5432/familypay' } },
});

let tenantId: string;
let payerId: string;
let payerWalletId: string;
let beneficiaryId: string;
let beneficiaryWalletId: string;

beforeAll(async () => { await dbAdmin.$connect(); });
afterAll(async () => { await dbAdmin.$disconnect(); });

beforeEach(async () => {
  const tenant = await dbAdmin.tenant.create({ data: { name: 'FR Test Tenant', plan: 'FREE' } });
  tenantId = tenant.id;
  const s = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const pUser = await dbAdmin.user.create({
    data: { tenantId, role: 'PAYER', email: `payer-${s()}@fr.test`, firstName: 'Karim', lastName: 'Test' },
  });
  payerId = pUser.id;
  const pWallet = await dbAdmin.wallet.create({ data: { tenantId, userId: pUser.id, balance: 1000, currency: 'MAD' } });
  payerWalletId = pWallet.id;

  const bUser = await dbAdmin.user.create({
    data: { tenantId, role: 'BENEFICIARY', email: `ben-${s()}@fr.test`, firstName: 'Adam', lastName: 'Test' },
  });
  beneficiaryId = bUser.id;
  const bWallet = await dbAdmin.wallet.create({ data: { tenantId, userId: bUser.id, balance: 0, currency: 'MAD' } });
  beneficiaryWalletId = bWallet.id;

  await dbAdmin.beneficiaryLink.create({
    data: { payerId, beneficiaryId, relationship: 'enfant' },
  });
});

describe('Sprint 4 — Demandes de fonds', () => {
  test('envoyer une demande de fonds', async () => {
    const fr = await sendFundRequest(beneficiaryId, payerId, 100, tenantId, 'Pour mes fournitures');
    expect(fr.id).toBeTruthy();
    expect(fr.status).toBe('PENDING');
    expect(Number(fr.amount)).toBe(100);
    expect(fr.message).toBe('Pour mes fournitures');
  });

  test('montant nul rejeté (VALIDATION_ERROR)', async () => {
    await expect(sendFundRequest(beneficiaryId, payerId, 0, tenantId)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  test('destinataire inconnu rejeté (NOT_FOUND)', async () => {
    await expect(sendFundRequest(beneficiaryId, '00000000-0000-0000-0000-000000000000', 100, tenantId)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  test('liste bénéficiaire — voit ses demandes envoyées', async () => {
    await sendFundRequest(beneficiaryId, payerId, 50, tenantId);
    const list = await listFundRequests(beneficiaryId, 'BENEFICIARY');
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((fr) => fr.senderId === beneficiaryId)).toBe(true);
  });

  test('liste payeur — voit les demandes reçues', async () => {
    await sendFundRequest(beneficiaryId, payerId, 50, tenantId);
    const list = await listFundRequests(payerId, 'PAYER');
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((fr) => fr.receiverId === payerId)).toBe(true);
  });

  test('approbation — wallet payeur débité', async () => {
    const fr = await sendFundRequest(beneficiaryId, payerId, 200, tenantId);
    await approveFundRequest(fr.id, payerId, tenantId);
    const wallet = await dbAdmin.wallet.findUnique({ where: { id: payerWalletId } });
    expect(Number(wallet?.balance)).toBe(800);
  });

  test('approbation — wallet bénéficiaire crédité', async () => {
    const fr = await sendFundRequest(beneficiaryId, payerId, 200, tenantId);
    await approveFundRequest(fr.id, payerId, tenantId);
    const wallet = await dbAdmin.wallet.findUnique({ where: { id: beneficiaryWalletId } });
    expect(Number(wallet?.balance)).toBe(200);
  });

  test('approbation — statut APPROVED + transaction créée', async () => {
    const fr = await sendFundRequest(beneficiaryId, payerId, 150, tenantId);
    const result = await approveFundRequest(fr.id, payerId, tenantId);
    expect(result.status).toBe('APPROVED');
    expect(result.respondedAt).not.toBeNull();
    const tx = await dbAdmin.transaction.findFirst({
      where: { fromWalletId: payerWalletId, type: 'FUND_REQUEST_APPROVED' },
    });
    expect(tx).not.toBeNull();
    expect(Number(tx?.amount)).toBe(150);
  });

  test('approbation — solde insuffisant (INSUFFICIENT_BALANCE)', async () => {
    const fr = await sendFundRequest(beneficiaryId, payerId, 5000, tenantId);
    await expect(approveFundRequest(fr.id, payerId, tenantId)).rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE' });
  });

  test('approbation — mauvais payeur (FORBIDDEN)', async () => {
    const fr = await sendFundRequest(beneficiaryId, payerId, 100, tenantId);
    await expect(approveFundRequest(fr.id, '00000000-0000-0000-0000-000000000000', tenantId)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  test('approbation — déjà traitée (FUND_REQUEST_ALREADY_RESPONDED)', async () => {
    const fr = await sendFundRequest(beneficiaryId, payerId, 100, tenantId);
    await approveFundRequest(fr.id, payerId, tenantId);
    await expect(approveFundRequest(fr.id, payerId, tenantId)).rejects.toMatchObject({ code: 'FUND_REQUEST_ALREADY_RESPONDED' });
  });

  test('refus — statut REJECTED, wallets inchangés', async () => {
    const fr = await sendFundRequest(beneficiaryId, payerId, 100, tenantId);
    const result = await rejectFundRequest(fr.id, payerId);
    expect(result.status).toBe('REJECTED');
    const pWallet = await dbAdmin.wallet.findUnique({ where: { id: payerWalletId } });
    const bWallet = await dbAdmin.wallet.findUnique({ where: { id: beneficiaryWalletId } });
    expect(Number(pWallet?.balance)).toBe(1000);
    expect(Number(bWallet?.balance)).toBe(0);
  });

  test('refus — mauvais payeur (FORBIDDEN)', async () => {
    const fr = await sendFundRequest(beneficiaryId, payerId, 100, tenantId);
    await expect(rejectFundRequest(fr.id, '00000000-0000-0000-0000-000000000000')).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
