import { prisma } from '../../lib/prisma.js';

export interface AuthorizationResult {
  status: 'APPROVED' | 'REJECTED' | 'PENDING_REVIEW';
  authorizationId: string | null;
  rejectionReason?: string;
  fraudScore: number;
}

interface CommitApprovedParams {
  beneficiaryId: string;
  merchantId: string;
  allocationId: string;
  amount: number;
  fraudScore: number;
}

interface CommitFailedParams {
  beneficiaryId: string;
  merchantId: string;
  allocationId: string;
  amount: number;
  status: 'REJECTED' | 'PENDING_REVIEW';
  rejectionReason: string;
  fraudScore: number;
}

export class AuthorizationService {
  static async commitApproved(params: CommitApprovedParams): Promise<AuthorizationResult> {
    let authorizationId = '';

    await prisma.$transaction(async (tx) => {
      const updated = await tx.allocation.update({
        where: { id: params.allocationId },
        data: { remainingAmount: { decrement: params.amount } },
        select: { remainingAmount: true },
      });

      if (Number(updated.remainingAmount) === 0) {
        await tx.allocation.update({
          where: { id: params.allocationId },
          data: { status: 'EXHAUSTED' },
        });
      }

      const auth = await tx.authorization.create({
        data: {
          allocationId: params.allocationId,
          beneficiaryId: params.beneficiaryId,
          merchantId: params.merchantId,
          amount: params.amount,
          status: 'APPROVED',
          fraudScore: params.fraudScore,
        },
        select: { id: true },
      });
      authorizationId = auth.id;

      await tx.auditLog.create({
        data: {
          action: 'AUTHORIZATION_APPROVED',
          entityType: 'Authorization',
          entityId: auth.id,
          metadata: {
            allocationId: params.allocationId,
            amount: params.amount,
            fraudScore: params.fraudScore,
          },
        },
      });
    });

    return { status: 'APPROVED', authorizationId, fraudScore: params.fraudScore };
  }

  static async commitFailed(params: CommitFailedParams): Promise<AuthorizationResult> {
    let authorizationId = '';

    await prisma.$transaction(async (tx) => {
      const auth = await tx.authorization.create({
        data: {
          allocationId: params.allocationId,
          beneficiaryId: params.beneficiaryId,
          merchantId: params.merchantId,
          amount: params.amount,
          status: params.status,
          rejectionReason: params.rejectionReason,
          fraudScore: params.fraudScore,
        },
        select: { id: true },
      });
      authorizationId = auth.id;

      await tx.auditLog.create({
        data: {
          action:
            params.status === 'REJECTED'
              ? 'AUTHORIZATION_REJECTED'
              : 'AUTHORIZATION_PENDING_REVIEW',
          entityType: 'Authorization',
          entityId: auth.id,
          metadata: {
            rejectionReason: params.rejectionReason,
            fraudScore: params.fraudScore,
          },
        },
      });
    });

    return {
      status: params.status,
      authorizationId,
      rejectionReason: params.rejectionReason,
      fraudScore: params.fraudScore,
    };
  }
}
