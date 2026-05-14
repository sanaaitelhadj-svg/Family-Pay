import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    beneficiary: { findFirst: vi.fn() },
    allocation: { create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { AllocationService } from './allocation.service.js';
import { prisma } from '../../lib/prisma.js';

const mp = prisma as any;

const SPONSOR_ID = 'sponsor-111';
const USER_ID    = 'user-111';
const BEN_ID     = 'beneficiary-222';
const ALLOC_ID   = 'allocation-333';

const mockBeneficiary = { id: BEN_ID, sponsorId: SPONSOR_ID, isActive: true };

const makeAlloc = (overrides = {}) => ({
  id: ALLOC_ID,
  sponsorId: SPONSOR_ID,
  beneficiaryId: BEN_ID,
  category: 'PHARMACY',
  limitAmount: { valueOf: () => '500' },
  remainingAmount: { valueOf: () => '500' },
  status: 'ACTIVE',
  expiresAt: null,
  renewalPeriod: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  beneficiary: { user: { firstName: 'Sara', phone: '+212612345678' } },
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mp.auditLog.create.mockResolvedValue({});
});

// ─── CREATE ──────────────────────────────────────────────────────────────────

describe('AllocationService.create', () => {
  const input = { beneficiaryId: BEN_ID, category: 'PHARMACY' as const, limitAmount: 500 };

  it('sets remainingAmount equal to limitAmount at creation', async () => {
    mp.beneficiary.findFirst.mockResolvedValue(mockBeneficiary);
    mp.allocation.create.mockResolvedValue(makeAlloc());

    await AllocationService.create(SPONSOR_ID, USER_ID, input);

    const data = mp.allocation.create.mock.calls[0][0].data;
    expect(data.limitAmount).toBe(500);
    expect(data.remainingAmount).toBe(500);
  });

  it('sets status ACTIVE', async () => {
    mp.beneficiary.findFirst.mockResolvedValue(mockBeneficiary);
    mp.allocation.create.mockResolvedValue(makeAlloc());

    await AllocationService.create(SPONSOR_ID, USER_ID, input);

    expect(mp.allocation.create.mock.calls[0][0].data.status).toBe('ACTIVE');
  });

  it('creates audit log ALLOCATION_CREATED', async () => {
    mp.beneficiary.findFirst.mockResolvedValue(mockBeneficiary);
    mp.allocation.create.mockResolvedValue(makeAlloc());

    await AllocationService.create(SPONSOR_ID, USER_ID, input);

    expect(mp.auditLog.create).toHaveBeenCalledOnce();
    expect(mp.auditLog.create.mock.calls[0][0].data.action).toBe('ALLOCATION_CREATED');
  });

  it('throws BENEFICIARY_NOT_FOUND when beneficiary not owned by sponsor', async () => {
    mp.beneficiary.findFirst.mockResolvedValue(null);

    await expect(AllocationService.create(SPONSOR_ID, USER_ID, input))
      .rejects.toMatchObject({ code: 'BENEFICIARY_NOT_FOUND', statusCode: 404 });
  });
});

// ─── LIST BY SPONSOR ─────────────────────────────────────────────────────────

describe('AllocationService.listBySponsor', () => {
  it('queries by sponsorId', async () => {
    mp.allocation.findMany.mockResolvedValue([makeAlloc()]);

    await AllocationService.listBySponsor(SPONSOR_ID);

    expect(mp.allocation.findMany.mock.calls[0][0].where).toMatchObject({ sponsorId: SPONSOR_ID });
  });

  it('filters by beneficiaryId when provided', async () => {
    mp.allocation.findMany.mockResolvedValue([]);

    await AllocationService.listBySponsor(SPONSOR_ID, BEN_ID);

    expect(mp.allocation.findMany.mock.calls[0][0].where).toMatchObject({ beneficiaryId: BEN_ID });
  });

  it('sets isLowBalance = true when remaining < 20% of limit', async () => {
    mp.allocation.findMany.mockResolvedValue([
      makeAlloc({ limitAmount: { valueOf: () => '500' }, remainingAmount: { valueOf: () => '80' } }),
    ]);

    const result = await AllocationService.listBySponsor(SPONSOR_ID);

    expect(result[0].isLowBalance).toBe(true);
  });

  it('sets isLowBalance = false when remaining >= 20% of limit', async () => {
    mp.allocation.findMany.mockResolvedValue([
      makeAlloc({ limitAmount: { valueOf: () => '500' }, remainingAmount: { valueOf: () => '120' } }),
    ]);

    const result = await AllocationService.listBySponsor(SPONSOR_ID);

    expect(result[0].isLowBalance).toBe(false);
  });
});

// ─── GET ONE ─────────────────────────────────────────────────────────────────

describe('AllocationService.getOne', () => {
  it('returns allocation when found', async () => {
    mp.allocation.findFirst.mockResolvedValue(makeAlloc());

    const result = await AllocationService.getOne(SPONSOR_ID, ALLOC_ID);

    expect(result.id).toBe(ALLOC_ID);
  });

  it('checks ownership (sponsorId + id in query)', async () => {
    mp.allocation.findFirst.mockResolvedValue(makeAlloc());

    await AllocationService.getOne(SPONSOR_ID, ALLOC_ID);

    expect(mp.allocation.findFirst.mock.calls[0][0].where).toMatchObject({
      id: ALLOC_ID, sponsorId: SPONSOR_ID,
    });
  });

  it('throws ALLOCATION_NOT_FOUND when not found', async () => {
    mp.allocation.findFirst.mockResolvedValue(null);

    await expect(AllocationService.getOne(SPONSOR_ID, ALLOC_ID))
      .rejects.toMatchObject({ code: 'ALLOCATION_NOT_FOUND', statusCode: 404 });
  });
});

// ─── INCREASE AMOUNT ─────────────────────────────────────────────────────────

describe('AllocationService.increaseAmount', () => {
  const input = { additionalAmount: 200 };

  beforeEach(() => {
    mp.allocation.findFirst.mockResolvedValue(makeAlloc());
    mp.$transaction.mockImplementation((fn: any) =>
      fn({
        allocation: { update: vi.fn().mockResolvedValue(makeAlloc({ limitAmount: { valueOf: () => '700' }, remainingAmount: { valueOf: () => '700' } })) },
        auditLog: { create: vi.fn().mockResolvedValue({}) },
      })
    );
  });

  it('uses $transaction for atomic update', async () => {
    await AllocationService.increaseAmount(SPONSOR_ID, USER_ID, ALLOC_ID, input);
    expect(mp.$transaction).toHaveBeenCalledOnce();
  });

  it('throws ALLOCATION_NOT_FOUND when not found', async () => {
    mp.allocation.findFirst.mockResolvedValue(null);

    await expect(AllocationService.increaseAmount(SPONSOR_ID, USER_ID, ALLOC_ID, input))
      .rejects.toMatchObject({ code: 'ALLOCATION_NOT_FOUND' });
  });

  it('throws ALLOCATION_NOT_MODIFIABLE for EXPIRED', async () => {
    mp.allocation.findFirst.mockResolvedValue(makeAlloc({ status: 'EXPIRED' }));

    await expect(AllocationService.increaseAmount(SPONSOR_ID, USER_ID, ALLOC_ID, input))
      .rejects.toMatchObject({ code: 'ALLOCATION_NOT_MODIFIABLE' });
  });

  it('throws ALLOCATION_NOT_MODIFIABLE for EXHAUSTED', async () => {
    mp.allocation.findFirst.mockResolvedValue(makeAlloc({ status: 'EXHAUSTED' }));

    await expect(AllocationService.increaseAmount(SPONSOR_ID, USER_ID, ALLOC_ID, input))
      .rejects.toMatchObject({ code: 'ALLOCATION_NOT_MODIFIABLE' });
  });
});

// ─── UPDATE STATUS ───────────────────────────────────────────────────────────

describe('AllocationService.updateStatus', () => {
  it('pauses an ACTIVE allocation', async () => {
    mp.allocation.findFirst.mockResolvedValue(makeAlloc({ status: 'ACTIVE' }));
    mp.allocation.update.mockResolvedValue(makeAlloc({ status: 'PAUSED' }));

    await AllocationService.updateStatus(SPONSOR_ID, USER_ID, ALLOC_ID, { status: 'PAUSED' });

    expect(mp.allocation.update.mock.calls[0][0].data.status).toBe('PAUSED');
  });

  it('resumes a PAUSED allocation', async () => {
    mp.allocation.findFirst.mockResolvedValue(makeAlloc({ status: 'PAUSED' }));
    mp.allocation.update.mockResolvedValue(makeAlloc({ status: 'ACTIVE' }));

    await AllocationService.updateStatus(SPONSOR_ID, USER_ID, ALLOC_ID, { status: 'ACTIVE' });

    expect(mp.allocation.update.mock.calls[0][0].data.status).toBe('ACTIVE');
  });

  it('creates audit log ALLOCATION_STATUS_CHANGED', async () => {
    mp.allocation.findFirst.mockResolvedValue(makeAlloc({ status: 'ACTIVE' }));
    mp.allocation.update.mockResolvedValue(makeAlloc({ status: 'PAUSED' }));

    await AllocationService.updateStatus(SPONSOR_ID, USER_ID, ALLOC_ID, { status: 'PAUSED' });

    expect(mp.auditLog.create.mock.calls[0][0].data.action).toBe('ALLOCATION_STATUS_CHANGED');
    expect(mp.auditLog.create.mock.calls[0][0].data.metadata).toMatchObject({ from: 'ACTIVE', to: 'PAUSED' });
  });

  it('throws ALLOCATION_EXHAUSTED when allocation is exhausted', async () => {
    mp.allocation.findFirst.mockResolvedValue(makeAlloc({ status: 'EXHAUSTED' }));

    await expect(AllocationService.updateStatus(SPONSOR_ID, USER_ID, ALLOC_ID, { status: 'ACTIVE' }))
      .rejects.toMatchObject({ code: 'ALLOCATION_EXHAUSTED' });
  });

  it('throws ALLOCATION_EXPIRED when trying to reactivate expired allocation', async () => {
    mp.allocation.findFirst.mockResolvedValue(makeAlloc({ status: 'EXPIRED' }));

    await expect(AllocationService.updateStatus(SPONSOR_ID, USER_ID, ALLOC_ID, { status: 'ACTIVE' }))
      .rejects.toMatchObject({ code: 'ALLOCATION_EXPIRED' });
  });

  it('throws ALLOCATION_NOT_FOUND for non-existent allocation', async () => {
    mp.allocation.findFirst.mockResolvedValue(null);

    await expect(AllocationService.updateStatus(SPONSOR_ID, USER_ID, ALLOC_ID, { status: 'PAUSED' }))
      .rejects.toMatchObject({ code: 'ALLOCATION_NOT_FOUND' });
  });
});

// ─── LIST BY BENEFICIARY ─────────────────────────────────────────────────────

describe('AllocationService.listByBeneficiary', () => {
  it('queries only ACTIVE and PAUSED allocations', async () => {
    mp.allocation.findMany.mockResolvedValue([makeAlloc()]);

    await AllocationService.listByBeneficiary(BEN_ID);

    expect(mp.allocation.findMany.mock.calls[0][0].where).toMatchObject({
      beneficiaryId: BEN_ID,
      status: { in: ['ACTIVE', 'PAUSED'] },
    });
  });
});
