import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    beneficiary: { findUnique: vi.fn() },
    merchant: { findUnique: vi.fn() },
    allocation: { findFirst: vi.fn() },
    authorization: { count: vi.fn() },
  },
}));

vi.mock('./authorization.service.js', () => ({
  AuthorizationService: {
    commitApproved: vi.fn(),
    commitFailed: vi.fn(),
  },
}));

import { AuthorizationEngine } from './authorization.engine.js';
import { prisma } from '../../lib/prisma.js';
import { AuthorizationService } from './authorization.service.js';

const mockPrisma = prisma as unknown as {
  beneficiary: { findUnique: ReturnType<typeof vi.fn> };
  merchant: { findUnique: ReturnType<typeof vi.fn> };
  allocation: { findFirst: ReturnType<typeof vi.fn> };
  authorization: { count: ReturnType<typeof vi.fn> };
};

const mockService = AuthorizationService as unknown as {
  commitApproved: ReturnType<typeof vi.fn>;
  commitFailed: ReturnType<typeof vi.fn>;
};

const request = { beneficiaryId: 'b-1', merchantId: 'm-1', amount: 100, category: 'PHARMACY' };
const activeBeneficiary = { id: 'b-1', isActive: true };
const activeMerchant = { id: 'm-1', activationStatus: 'ACTIVE', category: 'PHARMACY' };
const activeAllocation = { id: 'alloc-1', remainingAmount: 500, sponsorId: 's-1' };
const approvedResult = { status: 'APPROVED', authorizationId: 'auth-1', fraudScore: 0 };
const failedResult = { status: 'REJECTED', authorizationId: 'auth-1', rejectionReason: 'R', fraudScore: 0 };

describe('AuthorizationEngine.authorize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.beneficiary.findUnique.mockResolvedValue(activeBeneficiary);
    mockPrisma.merchant.findUnique.mockResolvedValue(activeMerchant);
    mockPrisma.allocation.findFirst.mockResolvedValue(activeAllocation);
    mockPrisma.authorization.count.mockResolvedValue(0);
    mockService.commitApproved.mockResolvedValue(approvedResult);
    mockService.commitFailed.mockResolvedValue(failedResult);
  });

  // ─── Early rejections (authorizationId null, pas de DB write) ──────────────

  it('rejects BENEFICIARY_NOT_FOUND when beneficiary does not exist', async () => {
    mockPrisma.beneficiary.findUnique.mockResolvedValue(null);
    const result = await AuthorizationEngine.authorize(request);
    expect(result.status).toBe('REJECTED');
    expect(result.rejectionReason).toBe('BENEFICIARY_NOT_FOUND');
    expect(result.authorizationId).toBeNull();
  });

  it('rejects BENEFICIARY_INACTIVE when beneficiary is inactive', async () => {
    mockPrisma.beneficiary.findUnique.mockResolvedValue({ ...activeBeneficiary, isActive: false });
    const result = await AuthorizationEngine.authorize(request);
    expect(result.rejectionReason).toBe('BENEFICIARY_INACTIVE');
    expect(result.authorizationId).toBeNull();
  });

  it('rejects MERCHANT_NOT_FOUND when merchant does not exist', async () => {
    mockPrisma.merchant.findUnique.mockResolvedValue(null);
    const result = await AuthorizationEngine.authorize(request);
    expect(result.rejectionReason).toBe('MERCHANT_NOT_FOUND');
    expect(result.authorizationId).toBeNull();
  });

  it('rejects MERCHANT_NOT_ACTIVE when activationStatus is INACTIVE', async () => {
    mockPrisma.merchant.findUnique.mockResolvedValue({ ...activeMerchant, activationStatus: 'INACTIVE' });
    const result = await AuthorizationEngine.authorize(request);
    expect(result.rejectionReason).toBe('MERCHANT_NOT_ACTIVE');
    expect(result.authorizationId).toBeNull();
  });

  it('rejects CATEGORY_MISMATCH when merchant category differs from request', async () => {
    mockPrisma.merchant.findUnique.mockResolvedValue({ ...activeMerchant, category: 'FOOD' });
    const result = await AuthorizationEngine.authorize(request);
    expect(result.rejectionReason).toBe('CATEGORY_MISMATCH');
    expect(result.authorizationId).toBeNull();
  });

  it('rejects ALLOCATION_NOT_FOUND when no active allocation exists', async () => {
    mockPrisma.allocation.findFirst.mockResolvedValue(null);
    const result = await AuthorizationEngine.authorize(request);
    expect(result.rejectionReason).toBe('ALLOCATION_NOT_FOUND');
    expect(result.authorizationId).toBeNull();
  });

  // ─── Rejections avec persistance ─────────────────────────────────────────────

  it('calls commitFailed INSUFFICIENT_ALLOCATION when amount exceeds remaining', async () => {
    mockPrisma.allocation.findFirst.mockResolvedValue({ ...activeAllocation, remainingAmount: 50 });
    await AuthorizationEngine.authorize({ ...request, amount: 100 });
    expect(mockService.commitFailed).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'REJECTED', rejectionReason: 'INSUFFICIENT_ALLOCATION' }),
    );
  });

  it('calls commitFailed PENDING_REVIEW + FRAUD_VELOCITY when velocity >= 5', async () => {
    mockPrisma.authorization.count.mockResolvedValue(5);
    await AuthorizationEngine.authorize(request);
    expect(mockService.commitFailed).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'PENDING_REVIEW', rejectionReason: 'FRAUD_VELOCITY', fraudScore: 40 }),
    );
  });

  // ─── Happy path ───────────────────────────────────────────────────────────────

  it('calls commitApproved with correct params on clean request', async () => {
    await AuthorizationEngine.authorize(request);
    expect(mockService.commitApproved).toHaveBeenCalledWith(
      expect.objectContaining({
        beneficiaryId: 'b-1',
        merchantId: 'm-1',
        allocationId: 'alloc-1',
        amount: 100,
        fraudScore: 0,
      }),
    );
  });

  it('does NOT call commitFailed when velocity is 4 (under threshold)', async () => {
    mockPrisma.authorization.count.mockResolvedValue(4);
    await AuthorizationEngine.authorize(request);
    expect(mockService.commitApproved).toHaveBeenCalledOnce();
    expect(mockService.commitFailed).not.toHaveBeenCalled();
  });

  it('queries allocation with beneficiaryId, category, and ACTIVE status', async () => {
    await AuthorizationEngine.authorize(request);
    expect(mockPrisma.allocation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          beneficiaryId: 'b-1',
          category: 'PHARMACY',
          status: 'ACTIVE',
        }),
      }),
    );
  });

  it('velocity check uses beneficiaryId and 1-hour window', async () => {
    await AuthorizationEngine.authorize(request);
    const call = mockPrisma.authorization.count.mock.calls[0][0];
    expect(call.where.beneficiaryId).toBe('b-1');
    expect(call.where.createdAt.gt).toBeInstanceOf(Date);
  });
});
