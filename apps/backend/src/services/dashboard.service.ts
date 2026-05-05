import { prismaAdmin } from '../lib/prisma.js';
import { withTenant } from '../lib/prisma.js';

export interface PayerDashboard {
  totalBeneficiaries: number;
  totalAllocated: number;
  totalSpent: number;
  beneficiaries: BeneficiaryView[];
  recentTransactions: TransactionView[];
}
export interface BeneficiaryView {
  userId: string;
  email: string;
  walletBalance: number;
  envelopes: EnvelopeView[];
}
export interface EnvelopeView {
  id: string;
  category: string;
  label: string;
  balance: number;
  maxPerTransaction: number | null;
  isActive: boolean;
}
export interface TransactionView {
  id: string;
  amount: number;
  type: string;
  status: string;
  envelopeId: string | null;
  createdAt: Date;
}
export interface PartnerStats {
  totalRevenue: number;
  transactionCount: number;
  averageBasket: number;
  rejectionRate: number;
  hourlyHeatmap: { hour: number; count: number }[];
  dailyRevenue: { date: string; revenue: number }[];
}

export async function getPayerDashboard(
  payerId: string,
  tenantId: string
): Promise<PayerDashboard> {
  return withTenant(tenantId, async (tx) => {
    const links = await prismaAdmin.beneficiaryLink.findMany({
      where: { payerId },
      include: { beneficiary: { select: { id: true, email: true } } },
    });

    const beneficiaries: BeneficiaryView[] = [];
    let totalAllocated = 0;
    let totalSpent = 0;

    for (const link of links) {
      // Envelope est lié au wallet du bénéficiaire
      const wallet = await tx.wallet.findFirst({ where: { userId: link.beneficiaryId } });

      const envelopes = wallet
        ? await tx.envelope.findMany({ where: { walletId: wallet.id, isActive: true } })
        : [];

      const envelopeViews: EnvelopeView[] = envelopes.map((e) => {
        totalAllocated += Number(e.balance);
        return {
          id: e.id,
          category: e.category,
          label: e.label,
          balance: Number(e.balance),
          maxPerTransaction: e.maxPerTransaction ? Number(e.maxPerTransaction) : null,
          isActive: e.isActive,
        };
      });

      beneficiaries.push({
        userId: link.beneficiaryId,
        email: link.beneficiary.email ?? "",
        walletBalance: Number(wallet?.balance ?? 0),
        envelopes: envelopeViews,
      });
    }

    const beneficiaryIds = links.map((l) => l.beneficiaryId);
    const wallets = beneficiaryIds.length > 0
      ? await tx.wallet.findMany({ where: { userId: { in: beneficiaryIds } } })
      : [];
    const walletIds = wallets.map((w) => w.id);

    const recentTxs = walletIds.length > 0
      ? await tx.transaction.findMany({
          where: { fromWalletId: { in: walletIds } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        })
      : [];

    return {
      totalBeneficiaries: beneficiaries.length,
      totalAllocated,
      totalSpent,
      beneficiaries,
      recentTransactions: recentTxs.map((t) => ({
        id: t.id,
        amount: Number(t.amount),
        type: t.type,
        status: t.status,
        envelopeId: t.envelopeId ?? null,
        createdAt: t.createdAt,
      })),
    };
  });
}

export async function getPartnerStats(
  partnerUserId: string,
  tenantId: string,
  startDate?: Date,
  endDate?: Date
): Promise<PartnerStats> {
  return withTenant(tenantId, async (tx) => {
    const wallet = await tx.wallet.findFirst({ where: { userId: partnerUserId } });
    if (!wallet) {
      return {
        totalRevenue: 0, transactionCount: 0, averageBasket: 0, rejectionRate: 0,
        hourlyHeatmap: Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 })),
        dailyRevenue: [],
      };
    }

    const dateFilter = (startDate || endDate)
      ? { gte: startDate, lte: endDate } : undefined;

    const completedTxs = await tx.transaction.findMany({
      where: {
        toWalletId: wallet.id, type: 'PAYMENT', status: 'COMPLETED',
        ...(dateFilter ? { createdAt: dateFilter } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });

    const failedCount = await tx.transaction.count({
      where: {
        toWalletId: wallet.id, type: 'PAYMENT', status: 'FAILED',
        ...(dateFilter ? { createdAt: dateFilter } : {}),
      },
    });

    const totalRevenue = completedTxs.reduce((s, t) => s + Number(t.amount), 0);
    const transactionCount = completedTxs.length;
    const averageBasket = transactionCount > 0 ? totalRevenue / transactionCount : 0;
    const totalAttempts = transactionCount + failedCount;
    const rejectionRate = totalAttempts > 0 ? (failedCount / totalAttempts) * 100 : 0;

    const heatmap = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
    for (const t of completedTxs) { heatmap[t.createdAt.getHours()].count++; }

    const dailyMap: Record<string, number> = {};
    for (const t of completedTxs) {
      const day = t.createdAt.toISOString().slice(0, 10);
      dailyMap[day] = (dailyMap[day] ?? 0) + Number(t.amount);
    }

    return {
      totalRevenue, transactionCount, averageBasket, rejectionRate,
      hourlyHeatmap: heatmap,
      dailyRevenue: Object.entries(dailyMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, revenue]) => ({ date, revenue })),
    };
  });
}
