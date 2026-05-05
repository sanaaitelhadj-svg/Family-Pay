import { prismaAdmin } from '../lib/prisma.js';
import { withTenant } from '../lib/prisma.js';

export interface MonthlyReport {
  year: number; month: number; payerId: string;
  totalSpent: number; totalReloaded: number; transactionCount: number;
  byBeneficiary: {
    beneficiaryId: string; email: string; spent: number; txCount: number;
    byCategory: { category: string; spent: number }[];
  }[];
  byDay: { day: number; amount: number }[];
}

export async function getMonthlyReport(
  payerId: string, tenantId: string, year: number, month: number
): Promise<MonthlyReport> {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  return withTenant(tenantId, async (tx) => {
    const links = await prismaAdmin.beneficiaryLink.findMany({
      where: { payerId },
      include: { beneficiary: { select: { id: true, email: true } } },
    });

    const beneficiaryIds = links.map((l) => l.beneficiaryId);
    const benefWallets = beneficiaryIds.length > 0
      ? await tx.wallet.findMany({ where: { userId: { in: beneficiaryIds } } })
      : [];
    const walletToUser = new Map(benefWallets.map((w) => [w.id, w.userId]));
    const walletIds = benefWallets.map((w) => w.id);

    const payments = walletIds.length > 0
      ? await tx.transaction.findMany({
          where: {
            fromWalletId: { in: walletIds }, type: 'PAYMENT', status: 'COMPLETED',
            createdAt: { gte: startDate, lte: endDate },
          },
          orderBy: { createdAt: 'asc' },
        })
      : [];

    const payerWallet = await tx.wallet.findFirst({ where: { userId: payerId } });
    const reloads = payerWallet
      ? await tx.transaction.findMany({
          where: {
            toWalletId: payerWallet.id, type: 'RELOAD', status: 'COMPLETED',
            createdAt: { gte: startDate, lte: endDate },
          },
        })
      : [];

    const totalSpent = payments.reduce((s, t) => s + Number(t.amount), 0);
    const totalReloaded = reloads.reduce((s, t) => s + Number(t.amount), 0);

    // By beneficiary
    const byBenefMap = new Map<string, { email: string; spent: number; txCount: number; categories: Map<string, number> }>();
    for (const link of links) {
      byBenefMap.set(link.beneficiaryId, { email: link.beneficiary.email ?? "", spent: 0, txCount: 0, categories: new Map() });
    }

    // Get envelopeId → category mapping
    const envelopeIds = [...new Set(payments.map(t => t.envelopeId).filter(Boolean))] as string[];
    const envelopes = envelopeIds.length > 0
      ? await tx.envelope.findMany({ where: { id: { in: envelopeIds } }, select: { id: true, category: true } })
      : [];
    const envCategory = new Map<string, string>(envelopes.map(e => [e.id, String(e.category)]));

    for (const t of payments) {
      const userId = walletToUser.get(t.fromWalletId!);
      if (!userId) continue;
      const entry = byBenefMap.get(userId);
      if (!entry) continue;
      entry.spent += Number(t.amount);
      entry.txCount++;
      const cat = (t.envelopeId ? envCategory.get(t.envelopeId) : null) ?? 'GENERAL';
      entry.categories.set(cat, (entry.categories.get(cat) ?? 0) + Number(t.amount));
    }

    const byBeneficiary = Array.from(byBenefMap.entries()).map(([beneficiaryId, e]) => ({
      beneficiaryId, email: e.email, spent: e.spent, txCount: e.txCount,
      byCategory: Array.from(e.categories.entries()).map(([category, spent]) => ({ category, spent })),
    }));

    const byDayMap = new Map<number, number>();
    for (const t of payments) {
      const day = t.createdAt.getDate();
      byDayMap.set(day, (byDayMap.get(day) ?? 0) + Number(t.amount));
    }

    return {
      year, month, payerId, totalSpent, totalReloaded,
      transactionCount: payments.length, byBeneficiary,
      byDay: Array.from(byDayMap.entries()).sort(([a], [b]) => a - b).map(([day, amount]) => ({ day, amount })),
    };
  });
}
