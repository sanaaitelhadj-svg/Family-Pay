import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    authorization: { findUnique: vi.fn(), findMany: vi.fn() },
    merchant: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('../psp/psp.mock.js', () => ({
  MockPspConnector: { debit: vi.fn() },
}));

import { AdminService } from './admin.service.js';
import { prisma } from '../../lib/prisma.js';
import { MockPspConnector } from '../psp/psp.mock.js';

const mockPrisma = prisma as unknown as {
  authorization: { findUnique: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  merchant: { findUnique: ReturnType<typeof vi.fn> };
  auditLog: { create: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};
const mockPsp = MockPspConnector as unknown as { debit: ReturnType<typeof vi.fn> };

const mockTx = {
  allocation: { update: vi.fn() },
  transaction: { create: vi.fn() },
  auditLog: { create: vi.fn() },
};

const pendingAuth = {
  id: 'auth-1',
  status: 'PENDING_REVIEW',
  amount: 100,
  merchantId: 'm-1',
  allocationId: 'alloc-1',
  fraudScore: 40,
  allocation: { sponsorId: 's-1', remainingAmount: 500 },
};

// ─── listPendingReview ────────────────────────────────────────────────────────

describe('AdminService.listPendingReview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.authorization.findMany.mockResolvedValue([]);
  });

  it('queries only PENDING_REVIEW authorizations', async () => {
    await AdminService.listPendingReview();
    expect(mockPrisma.authorization.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'PENDING_REVIEW' } }),
    );
  });

  it('orders by createdAt ascending', async () => {
    await AdminService.listPendingReview();
    const call = mockPrisma.authorization.findMany.mock.calls[0][0];
    expect(call.orderBy).toEqual({ createdAt: 'asc' });
  });

  it('returns the list of authorizations', async () => {
    const list = [{ id: 'auth-1' }, { id: 'auth-2' }];
    mockPrisma.authorization.findMany.mockResolvedValue(list);
    const result = await AdminService.listPendingReview();
    expect(result).toEqual(list);
  });
});

// ─── approve ─────────────────────────────────────────────────────────────────

describe('AdminService.approve', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.authorization.findUnique.mockResolvedValue(pendingAuth);
    mockPrisma.merchant.findUnique.mockResolvedValue({ pspMerchantReference: 'PSP-M-001' });
    mockPsp.debit.mockResolvedValue({ success: true, pspTransactionId: 'PSP-MOCK-123' });
    mockPrisma.$transaction.mockImplementation((fn: Function) => fn(mockTx));
    mockTx.allocation.update.mockResolvedValue({ remainingAmount: 400 });
    mockTx.transaction.create.mockResolvedValue({});
    mockTx.auditLog.create.mockResolvedValue({});
  });

  it('throws AUTHORIZATION_NOT_FOUND when auth does not exist', async () => {
    mockPrisma.authorization.findUnique.mockResolvedValue(null);
    await expect(AdminService.approve('unknown')).rejects.toMatchObject({
      code: 'AUTHORIZATION_NOT_FOUND',
    });
  });

  it('throws NOT_PENDING_REVIEW when status is not PENDING_REVIEW', async () => {
    mockPrisma.authorization.findUnique.mockResolvedValue({ ...pendingAuth, status: 'APPROVED' });
    await expect(AdminService.approve('auth-1')).rejects.toMatchObject({
      code: 'NOT_PENDING_REVIEW',
    });
  });

  it('throws INSUFFICIENT_ALLOCATION when amount exceeds remaining', async () => {
    mockPrisma.authorization.findUnique.mockResolvedValue({
      ...pendingAuth,
      amount: 600,
      allocation: { sponsorId: 's-1', remainingAmount: 500 },
    });
    await expect(AdminService.approve('auth-1')).rejects.toMatchObject({
      code: 'INSUFFICIENT_ALLOCATION',
    });
  });

  it('decrements allocation remainingAmount', async () => {
    await AdminService.approve('auth-1');
    expect(mockTx.allocation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { remainingAmount: { decrement: 100 } } }),
    );
  });

  it('inserts COMPLETED transaction', async () => {
    await AdminService.approve('auth-1');
    expect(mockTx.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'COMPLETED', authorizationId: 'auth-1' }),
      }),
    );
  });

  it('creates FRAUD_REVIEW_APPROVED audit log', async () => {
    await AdminService.approve('auth-1');
    expect(mockTx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'FRAUD_REVIEW_APPROVED' }),
      }),
    );
  });
});

// ─── reject ───────────────────────────────────────────────────────────────────

describe('AdminService.reject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.authorization.findUnique.mockResolvedValue(pendingAuth);
    mockPrisma.auditLog.create.mockResolvedValue({});
  });

  it('throws AUTHORIZATION_NOT_FOUND when auth does not exist', async () => {
    mockPrisma.authorization.findUnique.mockResolvedValue(null);
    await expect(AdminService.reject('unknown', 'Test')).rejects.toMatchObject({
      code: 'AUTHORIZATION_NOT_FOUND',
    });
  });

  it('throws NOT_PENDING_REVIEW when status is not PENDING_REVIEW', async () => {
    mockPrisma.authorization.findUnique.mockResolvedValue({ ...pendingAuth, status: 'REJECTED' });
    await expect(AdminService.reject('auth-1', 'Test')).rejects.toMatchObject({
      code: 'NOT_PENDING_REVIEW',
    });
  });

  it('creates FRAUD_REVIEW_REJECTED audit log with admin reason', async () => {
    await AdminService.reject('auth-1', 'Transaction suspecte confirmée');
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'FRAUD_REVIEW_REJECTED',
          metadata: expect.objectContaining({ adminReason: 'Transaction suspecte confirmée' }),
        }),
      }),
    );
  });
});
