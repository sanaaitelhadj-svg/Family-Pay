import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/prisma.js', () => ({
  prisma: { $transaction: vi.fn() },
}));

import { AuthorizationService } from './authorization.service.js';
import { prisma } from '../../lib/prisma.js';

const mockPrisma = prisma as unknown as { $transaction: ReturnType<typeof vi.fn> };

const mockTx = {
  allocation: { update: vi.fn() },
  authorization: { create: vi.fn() },
  auditLog: { create: vi.fn() },
};

const approvedParams = {
  beneficiaryId: 'b-1',
  merchantId: 'm-1',
  allocationId: 'alloc-1',
  amount: 100,
  fraudScore: 0,
};

const failedParams = {
  ...approvedParams,
  status: 'REJECTED' as const,
  rejectionReason: 'INSUFFICIENT_ALLOCATION',
};

// ─── commitApproved ───────────────────────────────────────────────────────────

describe('AuthorizationService.commitApproved', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTx.allocation.update.mockResolvedValue({ remainingAmount: 200 });
    mockTx.authorization.create.mockResolvedValue({ id: 'auth-new-1' });
    mockTx.auditLog.create.mockResolvedValue({});
    mockPrisma.$transaction.mockImplementation((fn: Function) => fn(mockTx));
  });

  it('decrements allocation remainingAmount', async () => {
    await AuthorizationService.commitApproved(approvedParams);
    expect(mockTx.allocation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'alloc-1' },
        data: { remainingAmount: { decrement: 100 } },
      }),
    );
  });

  it('inserts APPROVED authorization', async () => {
    await AuthorizationService.commitApproved(approvedParams);
    expect(mockTx.authorization.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'APPROVED', amount: 100 }),
      }),
    );
  });

  it('inserts AUTHORIZATION_APPROVED audit log', async () => {
    await AuthorizationService.commitApproved(approvedParams);
    expect(mockTx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'AUTHORIZATION_APPROVED' }),
      }),
    );
  });

  it('marks allocation EXHAUSTED when remainingAmount reaches 0', async () => {
    mockTx.allocation.update
      .mockResolvedValueOnce({ remainingAmount: 0 })
      .mockResolvedValueOnce({});
    await AuthorizationService.commitApproved(approvedParams);
    expect(mockTx.allocation.update).toHaveBeenCalledTimes(2);
    expect(mockTx.allocation.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: { status: 'EXHAUSTED' } }),
    );
  });

  it('does NOT set EXHAUSTED when remainingAmount is still positive', async () => {
    mockTx.allocation.update.mockResolvedValue({ remainingAmount: 50 });
    await AuthorizationService.commitApproved(approvedParams);
    expect(mockTx.allocation.update).toHaveBeenCalledTimes(1);
  });

  it('returns APPROVED result with authorizationId from created record', async () => {
    const result = await AuthorizationService.commitApproved(approvedParams);
    expect(result.status).toBe('APPROVED');
    expect(result.authorizationId).toBe('auth-new-1');
    expect(result.fraudScore).toBe(0);
  });
});

// ─── commitFailed ─────────────────────────────────────────────────────────────

describe('AuthorizationService.commitFailed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTx.authorization.create.mockResolvedValue({ id: 'auth-new-2' });
    mockTx.auditLog.create.mockResolvedValue({});
    mockPrisma.$transaction.mockImplementation((fn: Function) => fn(mockTx));
  });

  it('inserts REJECTED authorization with rejectionReason', async () => {
    await AuthorizationService.commitFailed(failedParams);
    expect(mockTx.authorization.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'REJECTED',
          rejectionReason: 'INSUFFICIENT_ALLOCATION',
        }),
      }),
    );
  });

  it('inserts PENDING_REVIEW authorization', async () => {
    await AuthorizationService.commitFailed({
      ...failedParams,
      status: 'PENDING_REVIEW',
      rejectionReason: 'FRAUD_VELOCITY',
      fraudScore: 40,
    });
    expect(mockTx.authorization.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING_REVIEW' }) }),
    );
  });

  it('does NOT touch the allocation', async () => {
    await AuthorizationService.commitFailed(failedParams);
    expect(mockTx.allocation.update).not.toHaveBeenCalled();
  });

  it('inserts AUTHORIZATION_REJECTED audit log for REJECTED status', async () => {
    await AuthorizationService.commitFailed(failedParams);
    expect(mockTx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'AUTHORIZATION_REJECTED' }),
      }),
    );
  });

  it('inserts AUTHORIZATION_PENDING_REVIEW audit log for PENDING_REVIEW status', async () => {
    await AuthorizationService.commitFailed({
      ...failedParams,
      status: 'PENDING_REVIEW',
      rejectionReason: 'FRAUD_VELOCITY',
      fraudScore: 40,
    });
    expect(mockTx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'AUTHORIZATION_PENDING_REVIEW' }),
      }),
    );
  });

  it('returns result with authorizationId, status, and rejectionReason', async () => {
    const result = await AuthorizationService.commitFailed(failedParams);
    expect(result.status).toBe('REJECTED');
    expect(result.authorizationId).toBe('auth-new-2');
    expect(result.rejectionReason).toBe('INSUFFICIENT_ALLOCATION');
  });
});
