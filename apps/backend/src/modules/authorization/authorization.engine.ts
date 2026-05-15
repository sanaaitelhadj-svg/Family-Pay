import type { AllocationCategory } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AuthorizationService } from './authorization.service.js';
import type { AuthorizationResult } from './authorization.service.js';
import { FraudEngine } from '../fraud/fraud.engine.js';

export interface AuthorizationRequest {
  beneficiaryId: string;
  merchantId: string;
  amount: number;
  category: string;
}

function earlyReject(reason: string): AuthorizationResult {
  return { status: 'REJECTED', authorizationId: null, rejectionReason: reason, fraudScore: 0 };
}

export class AuthorizationEngine {
  static async authorize(request: AuthorizationRequest): Promise<AuthorizationResult> {
    const { beneficiaryId, merchantId, amount, category } = request;

    // 1. Beneficiary
    const beneficiary = await prisma.beneficiary.findUnique({ where: { id: beneficiaryId } });
    if (!beneficiary) return earlyReject('BENEFICIARY_NOT_FOUND');
    if (!beneficiary.isActive) return earlyReject('BENEFICIARY_INACTIVE');

    // 2. Merchant
    const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
    if (!merchant) return earlyReject('MERCHANT_NOT_FOUND');
    if (merchant.activationStatus !== 'ACTIVE') return earlyReject('MERCHANT_NOT_ACTIVE');
    if (merchant.category !== (category as AllocationCategory)) return earlyReject('CATEGORY_MISMATCH');

    // 3. Allocation
    const allocation = await prisma.allocation.findFirst({
      where: { beneficiaryId, category: category as AllocationCategory, status: 'ACTIVE' },
    });
    if (!allocation) return earlyReject('ALLOCATION_NOT_FOUND');
    if (Number(allocation.remainingAmount) < amount) {
      return AuthorizationService.commitFailed({
        beneficiaryId, merchantId, allocationId: allocation.id,
        amount, status: 'REJECTED', rejectionReason: 'INSUFFICIENT_ALLOCATION', fraudScore: 0,
      });
    }

    // 4. Fraud scoring
    const { score: fraudScore, signals } = await FraudEngine.score(beneficiaryId, amount);
    const rejectionReason = signals.join(',');

    if (fraudScore > 70) {
      return AuthorizationService.commitFailed({
        beneficiaryId, merchantId, allocationId: allocation.id,
        amount, status: 'REJECTED', rejectionReason, fraudScore,
      });
    }
    if (fraudScore >= 40) {
      return AuthorizationService.commitFailed({
        beneficiaryId, merchantId, allocationId: allocation.id,
        amount, status: 'PENDING_REVIEW', rejectionReason, fraudScore,
      });
    }

    // 5. Approve — déduction atomique
    return AuthorizationService.commitApproved({
      beneficiaryId, merchantId, allocationId: allocation.id, amount, fraudScore,
    });
  }
}
