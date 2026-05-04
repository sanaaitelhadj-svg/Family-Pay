import { Decimal } from '@prisma/client/runtime/library';
import { withTenant } from '../lib/prisma.js';
import { FamilyPayError } from '../lib/errors.js';
import { decodeQrToken } from './qr.service.js';
import { canProcess } from './rules.service.js';

export async function processPayment(
  token: string,
  amount: number,
  partnerUserId: string,
  tenantId: string,
) {
  if (amount <= 0) throw new FamilyPayError('VALIDATION_ERROR', 400, 'Le montant doit être positif');

  const payload = decodeQrToken(token);
  if (payload.tenantId !== tenantId) {
    throw new FamilyPayError('QR_INVALID_OR_EXPIRED', 400, 'QR code invalide');
  }

  const beneficiaryId = payload.sub;
  const envelopeId = payload.envelopeId ?? undefined;

  return withTenant(tenantId, async (tx) => {
    // Re-check QR (protection race condition)
    const qr = await tx.qrCode.findUnique({ where: { token } });
    if (!qr) throw new FamilyPayError('QR_INVALID_OR_EXPIRED', 400, 'QR code introuvable');
    if (qr.usedAt) throw new FamilyPayError('QR_ALREADY_USED', 409, 'QR code déjà utilisé');
    if (qr.expiresAt < new Date()) throw new FamilyPayError('QR_INVALID_OR_EXPIRED', 400, 'QR code expiré');

    // Wallet bénéficiaire
    const benWallet = await tx.wallet.findUnique({ where: { userId: beneficiaryId } });
    if (!benWallet) throw new FamilyPayError('WALLET_NOT_FOUND', 404, 'Wallet bénéficiaire introuvable');
    if (benWallet.frozen) throw new FamilyPayError('WALLET_FROZEN', 400, 'Wallet gelé');
    if (Number(benWallet.balance) < amount) {
      throw new FamilyPayError('INSUFFICIENT_BALANCE', 400, 'Solde insuffisant');
    }

    // Partenaire (lookup par userId du JWT)
    const partner = await tx.partner.findUnique({
      where: { userId: partnerUserId },
      include: { wallet: true },
    });
    if (!partner || !partner.isActive) {
      throw new FamilyPayError('PARTNER_NOT_FOUND', 404, 'Partenaire introuvable');
    }
    if (!partner.wallet) {
      throw new FamilyPayError('WALLET_NOT_FOUND', 404, 'Wallet partenaire introuvable');
    }

    // Règles métier (si enveloppe spécifiée dans le QR)
    if (envelopeId) {
      await canProcess(tx, envelopeId, amount, partner.id);
    }

    const dec = new Decimal(amount);

    // Débit bénéficiaire
    await tx.wallet.update({ where: { id: benWallet.id }, data: { balance: { decrement: dec } } });

    // Crédit partenaire
    await tx.wallet.update({ where: { id: partner.wallet.id }, data: { balance: { increment: dec } } });

    // Marquer QR utilisé — updateMany = protection concurrence (WHERE usedAt IS NULL)
    const updated = await tx.qrCode.updateMany({
      where: { id: qr.id, usedAt: null },
      data: { usedAt: new Date(), amountUsed: dec },
    });
    if (updated.count === 0) {
      throw new FamilyPayError('QR_ALREADY_USED', 409, 'QR code déjà utilisé');
    }

    // Transaction immuable (INSERT only)
    const transaction = await tx.transaction.create({
      data: {
        tenantId,
        fromWalletId: benWallet.id,
        toWalletId: partner.wallet.id,
        envelopeId: envelopeId ?? null,
        partnerId: partner.id,
        qrCodeId: qr.id,
        amount: dec,
        type: 'PAYMENT',
        status: 'COMPLETED',
        metadata: { processedAt: new Date().toISOString() },
      },
    });

    return {
      transactionId: transaction.id,
      amount,
      newBalance: Number(benWallet.balance) - amount,
      partnerName: partner.businessName,
    };
  });
}
