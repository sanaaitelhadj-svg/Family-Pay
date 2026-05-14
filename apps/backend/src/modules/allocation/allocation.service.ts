import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import type {
  CreateAllocationInput,
  IncreaseAllocationAmountInput,
  UpdateAllocationStatusInput,
} from './allocation.schema.js';

const LOW_BALANCE_THRESHOLD = 0.2;

function fmt(a: any) {
  const remaining = Number(a.remainingAmount);
  const limit = Number(a.limitAmount);
  return { ...a, limitAmount: limit, remainingAmount: remaining, isLowBalance: remaining < limit * LOW_BALANCE_THRESHOLD };
}

export class AllocationService {
  static async create(sponsorId: string, actorUserId: string, input: CreateAllocationInput) {
    const beneficiary = await prisma.beneficiary.findFirst({
      where: { id: input.beneficiaryId, sponsorId, isActive: true },
    });
    if (!beneficiary) {
      throw new AppError('Bénéficiaire introuvable ou non lié à ce sponsor', 404, 'BENEFICIARY_NOT_FOUND');
    }

    const allocation = await prisma.allocation.create({
      data: {
        sponsorId,
        beneficiaryId: input.beneficiaryId,
        category: input.category,
        limitAmount: input.limitAmount,
        remainingAmount: input.limitAmount,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        renewalPeriod: input.renewalPeriod ?? null,
        status: 'ACTIVE',
      },
      include: { beneficiary: { include: { user: { select: { firstName: true } } } } },
    });

    await prisma.auditLog.create({
      data: {
        actorId: actorUserId,
        action: 'ALLOCATION_CREATED',
        entityType: 'Allocation',
        entityId: allocation.id,
        metadata: { category: input.category, limitAmount: input.limitAmount, beneficiaryId: input.beneficiaryId },
      },
    });

    return fmt(allocation);
  }

  static async listBySponsor(sponsorId: string, beneficiaryId?: string) {
    const allocations = await prisma.allocation.findMany({
      where: { sponsorId, ...(beneficiaryId ? { beneficiaryId } : {}) },
      include: { beneficiary: { include: { user: { select: { firstName: true, phone: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    return allocations.map(fmt);
  }

  static async getOne(sponsorId: string, allocationId: string) {
    const allocation = await prisma.allocation.findFirst({
      where: { id: allocationId, sponsorId },
      include: { beneficiary: { include: { user: { select: { firstName: true, phone: true } } } } },
    });
    if (!allocation) throw new AppError('Allocation introuvable', 404, 'ALLOCATION_NOT_FOUND');
    return fmt(allocation);
  }

  static async increaseAmount(
    sponsorId: string,
    actorUserId: string,
    allocationId: string,
    input: IncreaseAllocationAmountInput,
  ) {
    const allocation = await prisma.allocation.findFirst({ where: { id: allocationId, sponsorId } });
    if (!allocation) throw new AppError('Allocation introuvable', 404, 'ALLOCATION_NOT_FOUND');

    if (allocation.status === 'EXPIRED' || allocation.status === 'EXHAUSTED') {
      throw new AppError('Impossible de modifier une allocation expirée ou épuisée', 400, 'ALLOCATION_NOT_MODIFIABLE');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.allocation.update({
        where: { id: allocationId },
        data: {
          limitAmount: { increment: input.additionalAmount },
          remainingAmount: { increment: input.additionalAmount },
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actorUserId,
          action: 'ALLOCATION_AMOUNT_INCREASED',
          entityType: 'Allocation',
          entityId: allocationId,
          metadata: { additionalAmount: input.additionalAmount, newLimitAmount: Number(result.limitAmount) },
        },
      });
      return result;
    });

    return fmt(updated);
  }

  static async updateStatus(
    sponsorId: string,
    actorUserId: string,
    allocationId: string,
    input: UpdateAllocationStatusInput,
  ) {
    const allocation = await prisma.allocation.findFirst({ where: { id: allocationId, sponsorId } });
    if (!allocation) throw new AppError('Allocation introuvable', 404, 'ALLOCATION_NOT_FOUND');

    if (allocation.status === 'EXHAUSTED') {
      throw new AppError('Une allocation épuisée ne peut pas être modifiée', 400, 'ALLOCATION_EXHAUSTED');
    }
    if (allocation.status === 'EXPIRED' && input.status !== 'EXPIRED') {
      throw new AppError('Une allocation expirée ne peut pas être réactivée', 400, 'ALLOCATION_EXPIRED');
    }

    const updated = await prisma.allocation.update({
      where: { id: allocationId },
      data: { status: input.status },
    });

    await prisma.auditLog.create({
      data: {
        actorId: actorUserId,
        action: 'ALLOCATION_STATUS_CHANGED',
        entityType: 'Allocation',
        entityId: allocationId,
        metadata: { from: allocation.status, to: input.status },
      },
    });

    return fmt(updated);
  }

  static async listByBeneficiary(beneficiaryId: string) {
    const allocations = await prisma.allocation.findMany({
      where: { beneficiaryId, status: { in: ['ACTIVE', 'PAUSED'] } },
      orderBy: [{ category: 'asc' }, { createdAt: 'desc' }],
    });
    return allocations.map(fmt);
  }
}
