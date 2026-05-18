import { prisma } from '../../lib/prisma.js';

export class CommissionService {
  static async calculate(transactionId: string): Promise<void> {
    const tx = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { merchant: true },
    });

    if (!tx || tx.status !== 'COMPLETED') return;

    const existing = await prisma.commission.findUnique({ where: { transactionId } });
    if (existing) return;

    const rate = tx.merchant.commissionRate ?? 0;
    const amount = Number(tx.amount) * Number(rate);

    await prisma.commission.create({
      data: {
        transactionId,
        merchantId: tx.merchantId,
        sponsorId: tx.sponsorId,
        amount,
        rate,
        commissionType: tx.merchant.commissionType,
        status: 'PENDING',
      },
    });
  }
}
