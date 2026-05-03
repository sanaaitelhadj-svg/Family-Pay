import { EnvelopeCategory } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma, withTenant } from '../lib/prisma.js';
import { FamilyPayError } from '../lib/errors.js';

export async function listEnvelopes(userId: string, tenantId: string, beneficiaryId?: string) {
  const targetUserId = beneficiaryId ?? userId;

  return withTenant(tenantId, async (tx) => {
    if (beneficiaryId) {
      const link = await prisma.beneficiaryLink.findFirst({
        where: { payerId: userId, beneficiaryId, isActive: true },
      });
      if (!link) throw new FamilyPayError('FORBIDDEN', 403, 'Beneficiary not linked to this payer');
    }

    const wallet = await tx.wallet.findUnique({ where: { userId: targetUserId } });
    if (!wallet) throw new FamilyPayError('WALLET_NOT_FOUND', 404, 'Wallet not found');

    return tx.envelope.findMany({
      where: { walletId: wallet.id, isActive: true },
      select: {
        id: true, label: true, category: true, balance: true,
        maxPerTransaction: true, autoReloadEnabled: true, createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  });
}

export async function getEnvelope(envelopeId: string, tenantId: string) {
  return withTenant(tenantId, (tx) =>
    tx.envelope.findUniqueOrThrow({ where: { id: envelopeId } }),
  );
}

export async function createEnvelope(
  payerId: string,
  tenantId: string,
  data: {
    beneficiaryId: string;
    category: EnvelopeCategory;
    label: string;
    maxPerTransaction?: number;
  },
) {
  return withTenant(tenantId, async (tx) => {
    const link = await prisma.beneficiaryLink.findFirst({
      where: { payerId, beneficiaryId: data.beneficiaryId, isActive: true },
    });
    if (!link) throw new FamilyPayError('FORBIDDEN', 403, 'Beneficiary not linked to this payer');

    const wallet = await tx.wallet.findUnique({ where: { userId: data.beneficiaryId } });
    if (!wallet) throw new FamilyPayError('WALLET_NOT_FOUND', 404, 'Beneficiary wallet not found');

    return tx.envelope.create({
      data: {
        tenantId,
        walletId: wallet.id,
        category: data.category,
        label: data.label,
        balance: 0,
        maxPerTransaction: data.maxPerTransaction ? new Decimal(data.maxPerTransaction) : undefined,
      },
    });
  });
}

export async function updateEnvelope(
  envelopeId: string,
  tenantId: string,
  data: { label?: string; maxPerTransaction?: number; autoReloadEnabled?: boolean },
) {
  return withTenant(tenantId, async (tx) => {
    const envelope = await tx.envelope.findUnique({ where: { id: envelopeId } });
    if (!envelope) throw new FamilyPayError('ENVELOPE_NOT_FOUND', 404, 'Envelope not found');
    if (!envelope.isActive) throw new FamilyPayError('ENVELOPE_INACTIVE', 400, 'Envelope is inactive');

    return tx.envelope.update({
      where: { id: envelopeId },
      data: {
        ...(data.label !== undefined && { label: data.label }),
        ...(data.maxPerTransaction !== undefined && {
          maxPerTransaction: new Decimal(data.maxPerTransaction),
        }),
        ...(data.autoReloadEnabled !== undefined && {
          autoReloadEnabled: data.autoReloadEnabled,
        }),
      },
    });
  });
}

export async function deactivateEnvelope(envelopeId: string, tenantId: string) {
  return withTenant(tenantId, async (tx) => {
    const envelope = await tx.envelope.findUnique({ where: { id: envelopeId } });
    if (!envelope) throw new FamilyPayError('ENVELOPE_NOT_FOUND', 404, 'Envelope not found');

    return tx.envelope.update({
      where: { id: envelopeId },
      data: { isActive: false },
      select: { id: true, isActive: true },
    });
  });
}

export async function transfer(
  fromEnvelopeId: string,
  toEnvelopeId: string,
  amount: number,
  tenantId: string,
) {
  if (fromEnvelopeId === toEnvelopeId)
    throw new FamilyPayError('SAME_ENVELOPE_TRANSFER', 400, 'Source and target envelopes must be different');
  if (amount <= 0)
    throw new FamilyPayError('VALIDATION_ERROR', 400, 'Amount must be strictly positive');

  return withTenant(tenantId, async (tx) => {
    const [from, to] = await Promise.all([
      tx.envelope.findUnique({ where: { id: fromEnvelopeId } }),
      tx.envelope.findUnique({ where: { id: toEnvelopeId } }),
    ]);

    if (!from) throw new FamilyPayError('ENVELOPE_NOT_FOUND', 404, 'Source envelope not found');
    if (!to)   throw new FamilyPayError('ENVELOPE_NOT_FOUND', 404, 'Target envelope not found');
    if (!from.isActive) throw new FamilyPayError('ENVELOPE_INACTIVE', 400, 'Source envelope is inactive');
    if (!to.isActive)   throw new FamilyPayError('ENVELOPE_INACTIVE', 400, 'Target envelope is inactive');
    if (from.walletId !== to.walletId)
      throw new FamilyPayError('ENVELOPE_WALLET_MISMATCH', 400, 'Envelopes must belong to the same wallet');
    if (Number(from.balance) < amount)
      throw new FamilyPayError('INSUFFICIENT_BALANCE', 400, 'Insufficient balance in source envelope');

    await tx.envelope.update({
      where: { id: fromEnvelopeId },
      data: { balance: { decrement: new Decimal(amount) } },
    });
    await tx.envelope.update({
      where: { id: toEnvelopeId },
      data: { balance: { increment: new Decimal(amount) } },
    });

    const txRecord = await tx.transaction.create({
      data: {
        tenantId,
        fromWalletId: from.walletId,
        toWalletId: to.walletId,
        envelopeId: fromEnvelopeId,
        amount: new Decimal(amount),
        type: 'TRANSFER',
        status: 'COMPLETED',
        metadata: { fromEnvelopeId, toEnvelopeId },
      },
    });

    return {
      transaction: { id: txRecord.id, type: txRecord.type, amount: txRecord.amount },
      from: { id: fromEnvelopeId, newBalance: Number(from.balance) - amount },
      to:   { id: toEnvelopeId,   newBalance: Number(to.balance)   + amount },
    };
  });
}
