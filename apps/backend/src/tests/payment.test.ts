import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { generateQrCode } from '../services/qr.service.js';
import { processPayment } from '../services/payment.service.js';

const dbAdmin = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_ADMIN_URL ?? 'postgresql://postgres:postgres@localhost:5432/familypay' } },
});

let tenantId: string;
let beneficiaryId: string;
let beneficiaryWalletId: string;
let partnerUserId: string;
let partnerWalletId: string;

beforeAll(async () => { await dbAdmin.$connect(); });
afterAll(async () => { await dbAdmin.$disconnect(); });

beforeEach(async () => {
  const tenant = await dbAdmin.tenant.create({ data: { name: 'Payment Test Tenant', plan: 'FREE' } });
  tenantId = tenant.id;
  const s = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const benUser = await dbAdmin.user.create({
    data: { tenantId, role: 'BENEFICIARY', email: `ben-${s()}@pay.test`, firstName: 'Adam', lastName: 'Test' },
  });
  beneficiaryId = benUser.id;
  const benWallet = await dbAdmin.wallet.create({ data: { tenantId, userId: benUser.id, balance: 500, currency: 'MAD' } });
  beneficiaryWalletId = benWallet.id;

  const partUser = await dbAdmin.user.create({
    data: { tenantId, role: 'PARTNER', email: `part-${s()}@pay.test`, firstName: 'Shop', lastName: 'Owner' },
  });
  partnerUserId = partUser.id;
  const partWallet = await dbAdmin.wallet.create({ data: { tenantId, userId: partUser.id, balance: 0, currency: 'MAD' } });
  partnerWalletId = partWallet.id;
  await dbAdmin.partner.create({
    data: {
      tenantId, userId: partUser.id, walletId: partWallet.id,
      businessName: 'Test Shop', category: 'restaurant', isVerified: true, isActive: true,
    },
  });
});

describe('Sprint 3 — QR Payment', () => {
  test('paiement réussi — retourne transactionId et newBalance', async () => {
    const { token } = await generateQrCode(beneficiaryId, tenantId);
    const result = await processPayment(token, 100, partnerUserId, tenantId);
    expect(result.transactionId).toBeTruthy();
    expect(result.amount).toBe(100);
    expect(result.newBalance).toBe(400);
    expect(result.partnerName).toBe('Test Shop');
  });

  test('wallet bénéficiaire débité', async () => {
    const { token } = await generateQrCode(beneficiaryId, tenantId);
    await processPayment(token, 150, partnerUserId, tenantId);
    const wallet = await dbAdmin.wallet.findUnique({ where: { id: beneficiaryWalletId } });
    expect(Number(wallet?.balance)).toBe(350);
  });

  test('wallet partenaire crédité', async () => {
    const { token } = await generateQrCode(beneficiaryId, tenantId);
    await processPayment(token, 75, partnerUserId, tenantId);
    const wallet = await dbAdmin.wallet.findUnique({ where: { id: partnerWalletId } });
    expect(Number(wallet?.balance)).toBe(75);
  });

  test('QR marqué usedAt après paiement', async () => {
    const { token } = await generateQrCode(beneficiaryId, tenantId);
    await processPayment(token, 50, partnerUserId, tenantId);
    const qr = await dbAdmin.qrCode.findUnique({ where: { token } });
    expect(qr?.usedAt).not.toBeNull();
    expect(Number(qr?.amountUsed)).toBe(50);
  });

  test('replay attack — QR utilisé deux fois rejeté (QR_ALREADY_USED)', async () => {
    const { token } = await generateQrCode(beneficiaryId, tenantId);
    await processPayment(token, 50, partnerUserId, tenantId);
    await expect(processPayment(token, 50, partnerUserId, tenantId)).rejects.toMatchObject({ code: 'QR_ALREADY_USED' });
  });

  test('QR expiré (niveau DB) rejeté (QR_INVALID_OR_EXPIRED)', async () => {
    const { token } = await generateQrCode(beneficiaryId, tenantId);
    await dbAdmin.qrCode.updateMany({ where: { token }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(processPayment(token, 50, partnerUserId, tenantId)).rejects.toMatchObject({ code: 'QR_INVALID_OR_EXPIRED' });
  });

  test('JWT invalide rejeté (QR_INVALID_OR_EXPIRED)', async () => {
    await expect(processPayment('invalid.jwt.token', 50, partnerUserId, tenantId)).rejects.toMatchObject({ code: 'QR_INVALID_OR_EXPIRED' });
  });

  test('solde insuffisant rejeté (INSUFFICIENT_BALANCE)', async () => {
    const { token } = await generateQrCode(beneficiaryId, tenantId);
    await expect(processPayment(token, 600, partnerUserId, tenantId)).rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE' });
  });

  test('wallet gelé rejeté (WALLET_FROZEN)', async () => {
    await dbAdmin.wallet.update({ where: { id: beneficiaryWalletId }, data: { frozen: true } });
    const { token } = await generateQrCode(beneficiaryId, tenantId);
    await expect(processPayment(token, 50, partnerUserId, tenantId)).rejects.toMatchObject({ code: 'WALLET_FROZEN' });
  });

  test('partenaire inconnu rejeté (PARTNER_NOT_FOUND)', async () => {
    const { token } = await generateQrCode(beneficiaryId, tenantId);
    await expect(processPayment(token, 50, '00000000-0000-0000-0000-000000000000', tenantId)).rejects.toMatchObject({ code: 'PARTNER_NOT_FOUND' });
  });

  test('atomicité — solde inchangé si paiement échoue', async () => {
    const { token } = await generateQrCode(beneficiaryId, tenantId);
    await expect(processPayment(token, 50, '00000000-0000-0000-0000-000000000000', tenantId)).rejects.toThrow();
    const wallet = await dbAdmin.wallet.findUnique({ where: { id: beneficiaryWalletId } });
    expect(Number(wallet?.balance)).toBe(500); // inchangé — rollback PostgreSQL
  });
});
