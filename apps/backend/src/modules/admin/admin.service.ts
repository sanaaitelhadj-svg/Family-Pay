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
  static async getStats() {
    const [sponsors, beneficiaries, activeMerchants, txAgg, pendingFraudReview] = await Promise.all([
      prisma.sponsor.count(),
      prisma.beneficiary.count(),
      prisma.merchant.count({ where: { kycStatus: 'APPROVED' } }),
      prisma.transaction.aggregate({ _sum: { amount: true }, _count: true, where: { status: 'COMPLETED' } }),
      prisma.authorization.count({ where: { status: 'PENDING_REVIEW' } }),
    ]);
    return {
      sponsors,
      beneficiaries,
      activeMerchants,
      totalTransactions: txAgg._count,
      totalVolume: Number(txAgg._sum.amount ?? 0),
      pendingFraudReview,
    };
  }

  static async listMerchants(kycStatus?: string) {
    return prisma.merchant.findMany({
      where: kycStatus ? { kycStatus: kycStatus as any } : undefined,
      include: { user: { select: { firstName: true, phone: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async approveMerchant(merchantId: string): Promise<void> {
    const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
    if (!merchant) throw new AppError('Marchand introuvable', 404, 'MERCHANT_NOT_FOUND');
    await prisma.$transaction(async (tx) => {
      await tx.merchant.update({ where: { id: merchantId }, data: { kycStatus: 'APPROVED', activationStatus: 'ACTIVE' } });
      await tx.auditLog.create({ data: { action: 'MERCHANT_KYC_APPROVED', entityType: 'Merchant', entityId: merchantId, metadata: { businessName: merchant.businessName } } });
    });
  }

  static async rejectMerchant(merchantId: string, reason: string): Promise<void> {
    const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
    if (!merchant) throw new AppError('Marchand introuvable', 404, 'MERCHANT_NOT_FOUND');
    await prisma.$transaction(async (tx) => {
      await tx.merchant.update({ where: { id: merchantId }, data: { kycStatus: 'REJECTED', activationStatus: 'INACTIVE' } });
      await tx.auditLog.create({ data: { action: 'MERCHANT_KYC_REJECTED', entityType: 'Merchant', entityId: merchantId, metadata: { businessName: merchant.businessName, reason } } });
    });
  }

  static async getSponsors() {
    return prisma.sponsor.findMany({
      include: {
        user: { select: { firstName: true, phone: true, email: true, createdAt: true } },
        _count: { select: { allocations: true, beneficiaries: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getSponsor(sponsorId: string) {
    const sponsor = await prisma.sponsor.findUnique({
      where: { id: sponsorId },
      include: {
        user: { select: { firstName: true, phone: true, email: true, createdAt: true } },
        allocations: {
          include: { beneficiary: { include: { user: { select: { firstName: true, phone: true } } } } },
          orderBy: { createdAt: 'desc' },
        },
        beneficiaries: {
          include: { user: { select: { firstName: true, phone: true } } },
        },
      },
    });
    if (!sponsor) throw new AppError('Sponsor introuvable', 404, 'NOT_FOUND');
    const volumeAgg = await prisma.transaction.aggregate({
      where: { sponsorId, status: 'COMPLETED' },
      _sum: { amount: true },
      _count: true,
    });
    return { ...sponsor, totalVolume: Number(volumeAgg._sum.amount ?? 0), totalTransactions: volumeAgg._count };
  }

  static async getBeneficiaries() {
    return prisma.beneficiary.findMany({
      include: {
        user: { select: { firstName: true, phone: true, createdAt: true } },
        sponsor: { include: { user: { select: { firstName: true } } } },
        _count: { select: { allocations: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getBeneficiary(beneficiaryId: string) {
    const beneficiary = await prisma.beneficiary.findUnique({
      where: { id: beneficiaryId },
      include: {
        user: { select: { firstName: true, phone: true, createdAt: true } },
        sponsor: { include: { user: { select: { firstName: true, phone: true } } } },
        allocations: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!beneficiary) throw new AppError('Bénéficiaire introuvable', 404, 'NOT_FOUND');
    const transactions = await prisma.transaction.findMany({
      where: { authorization: { beneficiaryId } },
      include: { merchant: { select: { businessName: true, category: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return { ...beneficiary, transactions };
  }

  static async getTransactions(status?: string) {
    return prisma.transaction.findMany({
      where: status ? { status: status as any } : undefined,
      include: {
        merchant: { select: { businessName: true, category: true, city: true } },
        authorization: {
          select: {
            amount: true, fraudScore: true,
            beneficiary: { include: { user: { select: { firstName: true, phone: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  static async getAuditLogs(action?: string) {
    return prisma.auditLog.findMany({
      where: action ? { action: { contains: action } } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

}
