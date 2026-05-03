import { Decimal } from '@prisma/client/runtime/library';
import { withTenant } from '../lib/prisma.js';
import { FamilyPayError } from '../lib/errors.js';

export async function getMyWallet(userId: string, tenantId: string) {
  return withTenant(tenantId, (tx) =>
    tx.wallet.findUniqueOrThrow({
      where: { userId },
      select: {
        id: true, balance: true, currency: true, frozen: true, createdAt: true,
        envelopes: {
          where: { isActive: true },
          select: {
            id: true, label: true, category: true, balance: true,
            maxPerTransaction: true, autoReloadEnabled: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    }),
  );
}

export async function reload(userId: string, tenantId: string, amount: number) {
  if (amount <= 0)
    throw new FamilyPayError('VALIDATION_ERROR', 400, 'Amount must be strictly positive');
  if (amount > 50000)
    throw new FamilyPayError('AMOUNT_EXCEEDS_LIMIT', 400, 'Amount exceeds maximum (50 000 MAD)');

  return withTenant(tenantId, async (tx) => {
    const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } });
    if (wallet.frozen) throw new FamilyPayError('WALLET_FROZEN', 400, 'Wallet is frozen');

    const updated = await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: new Decimal(amount) } },
      select: { id: true, balance: true, currency: true },
    });

    await tx.transaction.create({
      data: {
        tenantId,
        toWalletId: wallet.id,
        amount: new Decimal(amount),
        type: 'RELOAD',
        status: 'COMPLETED',
        metadata: { source: 'MANUAL_DEV' },
      },
    });

    return updated;
  });
}
