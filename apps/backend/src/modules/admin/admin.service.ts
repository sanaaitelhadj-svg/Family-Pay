import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { MockPspConnector } from '../psp/psp.mock.js';

export class AdminService {
  static async listPendingReview() {
    return prisma.authorization.findMany({
      where: { status: 'PENDING_REVIEW' },
      include: {
        beneficiary: {
          include: { user: { select: { firstName: true, phone: true } } },
        },
        merchant: { select: { businessName: true, city: true } },
        allocation: { select: { category: true, remainingAmount: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  static async approve(authorizationId: string): Promise<void> {
    const auth = await prisma.authorization.findUnique({
      where: { id: authorizationId },
      include: { allocation: { select: { sponsorId: true, remainingAmount: true } } },
    });
    if (!auth) throw new AppError('Authorization introuvable', 404, 'AUTHORIZATION_NOT_FOUND');
    if (auth.status !== 'PENDING_REVIEW') {
      throw new AppError("Cette autorisation n'est pas en attente de revue", 400, 'NOT_PENDING_REVIEW');
    }

    const amount = Number(auth.amount);
    if (Number(auth.allocation.remainingAmount) < amount) {
      throw new AppError('Fonds insuffisants pour approuver', 400, 'INSUFFICIENT_ALLOCATION');
    }

    const merchant = await prisma.merchant.findUnique({
      where: { id: auth.merchantId },
      select: { pspMerchantReference: true },
    });

    const pspResult = await MockPspConnector.debit({
      sponsorId: auth.allocation.sponsorId,
      amount,
      merchantPspReference: merchant?.pspMerchantReference ?? 'MANUAL-REVIEW',
      authorizationId,
    });

    await prisma.$transaction(async (tx) => {
      const updated = await tx.allocation.update({
        where: { id: auth.allocationId },
        data: { remainingAmount: { decrement: amount } },
        select: { remainingAmount: true },
      });
      if (Number(updated.remainingAmount) === 0) {
        await tx.allocation.update({ where: { id: auth.allocationId }, data: { status: 'EXHAUSTED' } });
      }
      await tx.transaction.create({
        data: {
          authorizationId,
          sponsorId: auth.allocation.sponsorId,
          merchantId: auth.merchantId,
          amount,
          pspTransactionId: pspResult.pspTransactionId,
          status: 'COMPLETED',
        },
      });
      await tx.auditLog.create({
        data: {
          action: 'FRAUD_REVIEW_APPROVED',
          entityType: 'Authorization',
          entityId: authorizationId,
          metadata: { fraudScore: auth.fraudScore, pspTransactionId: pspResult.pspTransactionId },
        },
      });
    });
  }

  static async reject(authorizationId: string, reason: string): Promise<void> {
    const auth = await prisma.authorization.findUnique({ where: { id: authorizationId } });
    if (!auth) throw new AppError('Authorization introuvable', 404, 'AUTHORIZATION_NOT_FOUND');
    if (auth.status !== 'PENDING_REVIEW') {
      throw new AppError("Cette autorisation n'est pas en attente de revue", 400, 'NOT_PENDING_REVIEW');
    }

    await prisma.auditLog.create({
      data: {
        action: 'FRAUD_REVIEW_REJECTED',
        entityType: 'Authorization',
        entityId: authorizationId,
        metadata: { fraudScore: auth.fraudScore, adminReason: reason },
      },
    });
  }
}
