import { withTenant } from '../lib/prisma.js';

export interface TransactionFilters {
  startDate?: Date;
  endDate?: Date;
  beneficiaryId?: string;
  envelopeId?: string;
  type?: string;
  page?: number;
  limit?: number;
}

export interface TransactionPage {
  transactions: {
    id: string; amount: number; type: string; status: string;
    envelopeId: string | null; fromWalletId: string | null;
    toWalletId: string | null; createdAt: Date;
  }[];
  total: number; page: number; totalPages: number;
}

export async function getTransactions(
  userId: string, tenantId: string, filters: TransactionFilters = {}
): Promise<TransactionPage> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
  const skip = (page - 1) * limit;

  return withTenant(tenantId, async (tx) => {
    const userWallets = await tx.wallet.findMany({ where: { userId } });
    const userWalletIds = userWallets.map((w) => w.id);

    let walletFilter = userWalletIds;
    if (filters.beneficiaryId) {
      const benefWallets = await tx.wallet.findMany({ where: { userId: filters.beneficiaryId } });
      walletFilter = benefWallets.map((w) => w.id);
    }

    const where: any = {
      OR: [
        { fromWalletId: { in: walletFilter } },
        { toWalletId: { in: walletFilter } },
      ],
    };
    if (filters.startDate || filters.endDate) {
      where.createdAt = {
        ...(filters.startDate ? { gte: filters.startDate } : {}),
        ...(filters.endDate ? { lte: filters.endDate } : {}),
      };
    }
    if (filters.envelopeId) where.envelopeId = filters.envelopeId;
    if (filters.type) where.type = filters.type;

    const [rows, total] = await Promise.all([
      tx.transaction.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      tx.transaction.count({ where }),
    ]);

    return {
      transactions: rows.map((t) => ({
        id: t.id, amount: Number(t.amount), type: t.type, status: t.status,
        envelopeId: t.envelopeId ?? null,
        fromWalletId: t.fromWalletId ?? null,
        toWalletId: t.toWalletId ?? null,
        createdAt: t.createdAt,
      })),
      total, page, totalPages: Math.ceil(total / limit),
    };
  });
}
