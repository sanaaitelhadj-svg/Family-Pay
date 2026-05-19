import bcrypt from 'bcryptjs';
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
    const merchants = await prisma.merchant.findMany({
      orderBy: { createdAt: 'desc' },
    });
    const merchantIds = merchants.map(m => m.id);
    const subscriptions = await prisma.subscription.findMany({
      where: { entityType: 'MERCHANT', entityId: { in: merchantIds }, status: 'ACTIVE' },
      include: { subscriptionPlan: true },
    });
    const subsByMerchantId = Object.fromEntries(subscriptions.map(s => [s.entityId, s]));
    return merchants.map(m => ({ ...m, subscriptions: subsByMerchantId[m.id] ? [subsByMerchantId[m.id]] : [] }));
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

  static async getCommissions(merchantId?: string, status?: string) {
    return prisma.commission.findMany({
      where: {
        ...(merchantId ? { merchantId } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        merchant: { select: { businessName: true, city: true, category: true } },
        transaction: { select: { amount: true, createdAt: true, pspTransactionId: true } },
        sponsor: { include: { user: { select: { firstName: true, phone: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  static async getCommissionStats() {
    const [total, byMerchant, byStatus] = await Promise.all([
      prisma.commission.aggregate({ _sum: { amount: true }, _count: true }),
      prisma.commission.groupBy({
        by: ['merchantId'],
        _sum: { amount: true },
        _count: true,
        orderBy: { _sum: { amount: 'desc' } },
        take: 10,
      }),
      prisma.commission.groupBy({ by: ['status'], _sum: { amount: true }, _count: true }),
    ]);
    return { total, byMerchant, byStatus };
  }

  static async updateMerchantCommission(merchantId: string, commissionType: string, commissionRate: number) {
    return prisma.merchant.update({
      where: { id: merchantId },
      data: { commissionType, commissionRate },
    });
  }

  static async getSubscriptions(entityType?: string, status?: string) {
    return prisma.subscription.findMany({
      where: {
        ...(entityType ? { entityType } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async createSubscription(data: {
    entityType: string; entityId: string; plan: string;
    amount: number; startDate: string; endDate: string; notes?: string;
  }) {
    return prisma.subscription.create({
      data: {
        ...data,
        amount: data.amount,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
      },
    });
  }

  static async updateSubscription(id: string, status: string) {
    return prisma.subscription.update({ where: { id }, data: { status } });
  }



  static async activateMerchant(merchantId: string, data: {
    contractUrl?: string;
    billingType: 'commission' | 'subscription';
    commissionType?: string;
    commissionRate?: number;
    planId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<void> {
    const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
    if (!merchant) throw new AppError('Marchand introuvable', 404, 'MERCHANT_NOT_FOUND');

    await prisma.$transaction(async (tx) => {
      await tx.merchant.update({
        where: { id: merchantId },
        data: {
          activationStatus: 'ACTIVE',
          ...(data.contractUrl ? { contractUrl: data.contractUrl } : {}),
          ...(data.billingType === 'commission' ? {
            commissionType: data.commissionType ?? 'TRANSACTION_PERCENTAGE',
            commissionRate: data.commissionRate ?? null,
          } : {
            commissionType: 'NONE',
            commissionRate: undefined,
          }),
        },
      });

      if (data.billingType === 'subscription') {
        await tx.subscription.create({
          data: {
            entityType: 'MERCHANT',
            entityId: merchantId,
            planId: data.planId ?? null,
            plan: 'CUSTOM',
            amount: 0,
            startDate: data.startDate ? new Date(data.startDate) : new Date(),
            endDate: data.endDate ? new Date(data.endDate) : new Date(new Date(data.startDate ?? Date.now()).setFullYear(new Date(data.startDate ?? Date.now()).getFullYear() + 1)),
            status: 'ACTIVE',
          },
        });
      }

      await tx.auditLog.create({
        data: {
          action: 'MERCHANT_ACTIVATED',
          entityType: 'Merchant',
          entityId: merchantId,
          metadata: { billingType: data.billingType, contractUrl: data.contractUrl ?? null },
        },
      });
    });
  }


  static async setMerchantStatus(merchantId: string, status: 'ACTIVE' | 'SUSPENDED'): Promise<void> {
    await prisma.merchant.update({ where: { id: merchantId }, data: { activationStatus: status } });
  }

  static async listSubscriptionPlans() {
    return prisma.subscriptionPlan.findMany({ orderBy: { createdAt: 'desc' } });
  }

  static async createSubscriptionPlan(data: { name: string; description?: string; price: number; durationMonths: number; features?: unknown }) {
    return prisma.subscriptionPlan.create({ data: { ...data, features: data.features as any } });
  }

  static async updateSubscriptionPlan(planId: string, data: { name?: string; description?: string; price?: number; durationMonths?: number; features?: unknown; isActive?: boolean }) {
    return prisma.subscriptionPlan.update({ where: { id: planId }, data: { ...data, features: data.features as any } });
  }


  static async updateMerchantBilling(merchantId: string, data: {
    contractUrl?: string;
    billingType: 'commission' | 'subscription';
    commissionType?: string;
    commissionRate?: number;
    planId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.merchant.update({
        where: { id: merchantId },
        data: {
          ...(data.contractUrl !== undefined ? { contractUrl: data.contractUrl } : {}),
          ...(data.billingType === 'commission' ? {
            commissionType: data.commissionType ?? 'TRANSACTION_PERCENTAGE',
            commissionRate: data.commissionRate ?? null,
          } : {
            commissionType: 'NONE',
            commissionRate: undefined,
          }),
        },
      });

      if (data.billingType === 'subscription') {
        await tx.subscription.updateMany({
          where: { entityType: 'MERCHANT', entityId: merchantId, status: 'ACTIVE' },
          data: { status: 'CANCELLED' },
        });
        await tx.subscription.create({
          data: {
            entityType: 'MERCHANT',
            entityId: merchantId,
            planId: data.planId ?? null,
            plan: 'CUSTOM',
            amount: 0,
            startDate: data.startDate ? new Date(data.startDate) : new Date(),
            endDate: data.endDate ? new Date(data.endDate)
              : new Date(new Date(data.startDate ?? Date.now()).setFullYear(new Date(data.startDate ?? Date.now()).getFullYear() + 1)),
            status: 'ACTIVE',
          },
        });
      } else {
        await tx.subscription.updateMany({
          where: { entityType: 'MERCHANT', entityId: merchantId, status: 'ACTIVE' },
          data: { status: 'CANCELLED' },
        });
      }

      await tx.auditLog.create({
        data: {
          action: 'MERCHANT_BILLING_UPDATED',
          entityType: 'Merchant',
          entityId: merchantId,
          metadata: { billingType: data.billingType },
        },
      });
    });
  }

  static async updateMerchantInfo(merchantId: string, data: Record<string, unknown>): Promise<void> {
    await prisma.merchant.update({ where: { id: merchantId }, data: data as any });
  }


  // ── Manual creation ────────────────────────────────────────────────────────

  static async createSponsor(data: {
    firstName: string; lastName?: string; phone: string; email?: string; password: string;
  }) {
    const existing = await prisma.user.findUnique({ where: { phone: data.phone } });
    if (existing) throw new AppError('Ce numéro est déjà utilisé', 409, 'PHONE_ALREADY_EXISTS');
    const hashed = await bcrypt.hash(data.password, 12);
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          phone: data.phone, email: data.email,
          firstName: data.firstName, lastName: data.lastName,
          password: hashed, role: 'SPONSOR', isVerified: true, cndpConsentAt: new Date(),
        },
      });
      const sponsor = await tx.sponsor.create({ data: { userId: user.id } });
      await tx.auditLog.create({
        data: { action: 'ADMIN_CREATED_SPONSOR', entityType: 'User', entityId: user.id, metadata: { phone: data.phone } },
      });
      return { userId: user.id, sponsorId: sponsor.id };
    });
  }

  static async createMerchantManual(data: {
    businessName: string; category: string; city: string; phone: string; password: string;
    address?: string; registrationNumber?: string; iceNumber?: string;
    activationStatus: 'ACTIVE' | 'INACTIVE';
  }) {
    const existing = await prisma.user.findUnique({ where: { phone: data.phone } });
    if (existing) throw new AppError('Ce numéro est déjà utilisé', 409, 'PHONE_ALREADY_EXISTS');
    const hashed = await bcrypt.hash(data.password, 12);
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          phone: data.phone, firstName: data.businessName,
          password: hashed, role: 'MERCHANT', isVerified: true, cndpConsentAt: new Date(),
        },
      });
      const merchant = await tx.merchant.create({
        data: {
          userId: user.id, businessName: data.businessName, phone: data.phone,
          category: data.category as any, city: data.city,
          address: data.address ?? '', registrationNumber: data.registrationNumber,
          iceNumber: data.iceNumber, activationStatus: data.activationStatus,
        },
      });
      await tx.auditLog.create({
        data: { action: 'ADMIN_CREATED_MERCHANT', entityType: 'Merchant', entityId: merchant.id, metadata: { businessName: data.businessName } },
      });
      return { userId: user.id, merchantId: merchant.id };
    });
  }

  static async createBeneficiary(data: {
    firstName: string; lastName?: string; phone: string; password: string;
    sponsorId: string; relationship?: string;
  }) {
    const existing = await prisma.user.findUnique({ where: { phone: data.phone } });
    if (existing) throw new AppError('Ce numéro est déjà utilisé', 409, 'PHONE_ALREADY_EXISTS');
    const sponsor = await prisma.sponsor.findUnique({ where: { id: data.sponsorId } });
    if (!sponsor) throw new AppError('Sponsor introuvable', 404, 'SPONSOR_NOT_FOUND');
    const hashed = await bcrypt.hash(data.password, 12);
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          phone: data.phone, firstName: data.firstName, lastName: data.lastName,
          password: hashed, role: 'BENEFICIARY', isVerified: true, cndpConsentAt: new Date(),
        },
      });
      const bene = await tx.beneficiary.create({
        data: { userId: user.id, sponsorId: data.sponsorId, relationship: data.relationship, isActive: true },
      });
      await tx.auditLog.create({
        data: { action: 'ADMIN_CREATED_BENEFICIARY', entityType: 'Beneficiary', entityId: bene.id, metadata: { phone: data.phone, sponsorId: data.sponsorId } },
      });
      return { userId: user.id, beneficiaryId: bene.id };
    });
  }

  // ── Admin management ───────────────────────────────────────────────────────

  static async listAdmins() {
    return prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true, phone: true, email: true, firstName: true, lastName: true, isVerified: true, createdAt: true, adminRoleId: true, adminRole: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async createAdmin(data: {
    firstName: string; lastName?: string; phone: string; email?: string; password: string; roleId?: string;
  }) {
    const existing = await prisma.user.findUnique({ where: { phone: data.phone } });
    if (existing) throw new AppError('Ce numéro est déjà utilisé', 409, 'PHONE_ALREADY_EXISTS');
    const hashed = await bcrypt.hash(data.password, 12);
    const user = await prisma.user.create({
      data: {
        phone: data.phone, email: data.email,
        firstName: data.firstName, lastName: data.lastName,
        password: hashed, role: 'ADMIN', isVerified: true, cndpConsentAt: new Date(),
        ...(data.roleId ? { adminRoleId: data.roleId } : {}),
      },
    });
    await prisma.auditLog.create({
      data: { action: 'ADMIN_CREATED', entityType: 'User', entityId: user.id, metadata: { phone: data.phone } },
    });
    return { userId: user.id };
  }

  static async setAdminStatus(userId: string, isActive: boolean): Promise<void> {
    await prisma.user.update({ where: { id: userId }, data: { isVerified: isActive } });
  }


  // ────────────────────────────────────────────────────────────────────────────
  // RBAC — Roles
  // ────────────────────────────────────────────────────────────────────────────

  static async listRoles() {
    return prisma.adminRole.findMany({ orderBy: { createdAt: 'desc' } });
  }

  static async createRole(data: { name: string; description?: string; permissions: Record<string, unknown> }) {
    return prisma.adminRole.create({ data: { ...data, permissions: data.permissions as any } });
  }

  static async updateRole(roleId: string, data: {
    name?: string;
    description?: string;
    permissions?: Record<string, unknown>;
    isActive?: boolean;
  }) {
    return prisma.adminRole.update({
      where: { id: roleId },
      data: { ...data, ...(data.permissions ? { permissions: data.permissions as any } : {}) },
    });
  }

  static async assignRole(adminId: string, roleId: string | null): Promise<void> {
    await prisma.user.update({
      where: { id: adminId },
      data: { adminRoleId: roleId },
    });
  }

  static async getAdminMe(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, firstName: true, lastName: true, email: true, phone: true,
        adminRole: { select: { id: true, name: true, permissions: true } },
      },
    });
  }

}