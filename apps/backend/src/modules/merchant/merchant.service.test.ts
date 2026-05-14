import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    merchant: { findUnique: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('../auth/otp.service.js', () => ({
  OtpService: { requestOtp: vi.fn().mockResolvedValue('123456') },
}));

import { MerchantService } from './merchant.service.js';
import { prisma } from '../../lib/prisma.js';
import { OtpService } from '../auth/otp.service.js';

const mockPrisma = prisma as unknown as {
  user: { findUnique: ReturnType<typeof vi.fn> };
  merchant: { findUnique: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

const mockOtp = OtpService as unknown as { requestOtp: ReturnType<typeof vi.fn> };

const mockTx = {
  user: { create: vi.fn() },
  merchant: { create: vi.fn(), update: vi.fn() },
  auditLog: { create: vi.fn() },
};

const validRegisterData = {
  businessName: 'Pharmacie Al Amal',
  category: 'PHARMACY' as const,
  address: '123 Boulevard Mohammed V',
  city: 'Casablanca',
  phone: '+212612345678',
  firstName: 'Karim',
  lastName: 'Benali',
  cndpConsent: true as const,
};

// ─── register ────────────────────────────────────────────────────────────────

describe('MerchantService.register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockOtp.requestOtp.mockResolvedValue('123456');
    mockTx.user.create.mockResolvedValue({ id: 'user-new-1' });
    mockTx.merchant.create.mockResolvedValue({});
    mockTx.auditLog.create.mockResolvedValue({});
    mockPrisma.$transaction.mockImplementation((fn: Function) => fn(mockTx));
  });

  it('throws PHONE_ALREADY_EXISTS when phone is taken', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing' });
    await expect(MerchantService.register(validRegisterData)).rejects.toMatchObject({
      statusCode: 409,
      code: 'PHONE_ALREADY_EXISTS',
    });
  });

  it('returns OTP result on success', async () => {
    const result = await MerchantService.register(validRegisterData);
    expect(result).toBe('123456');
  });

  it('calls requestOtp with phone and SIGNUP', async () => {
    await MerchantService.register(validRegisterData);
    expect(mockOtp.requestOtp).toHaveBeenCalledWith(validRegisterData.phone, 'SIGNUP');
  });

  it('runs user, merchant, and auditLog creation in a single transaction', async () => {
    await MerchantService.register(validRegisterData);
    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
    expect(mockTx.user.create).toHaveBeenCalledOnce();
    expect(mockTx.merchant.create).toHaveBeenCalledOnce();
    expect(mockTx.auditLog.create).toHaveBeenCalledOnce();
  });
});

// ─── listPending ──────────────────────────────────────────────────────────────

describe('MerchantService.listPending', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.merchant.findMany.mockResolvedValue([]);
  });

  it('queries only PENDING_PSP merchants', async () => {
    await MerchantService.listPending();
    expect(mockPrisma.merchant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { kycStatus: 'PENDING_PSP' } }),
    );
  });

  it('orders by createdAt ascending', async () => {
    await MerchantService.listPending();
    const call = mockPrisma.merchant.findMany.mock.calls[0][0];
    expect(call.orderBy).toEqual({ createdAt: 'asc' });
  });

  it('returns the list of merchants', async () => {
    const merchants = [{ id: 'm1' }, { id: 'm2' }];
    mockPrisma.merchant.findMany.mockResolvedValue(merchants);
    const result = await MerchantService.listPending();
    expect(result).toEqual(merchants);
  });
});

// ─── approve ─────────────────────────────────────────────────────────────────

describe('MerchantService.approve', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTx.merchant.update.mockResolvedValue({});
    mockTx.auditLog.create.mockResolvedValue({});
    mockPrisma.$transaction.mockImplementation((fn: Function) => fn(mockTx));
  });

  it('throws MERCHANT_NOT_FOUND when merchant does not exist', async () => {
    mockPrisma.merchant.findUnique.mockResolvedValue(null);
    await expect(MerchantService.approve('unknown')).rejects.toMatchObject({
      statusCode: 404,
      code: 'MERCHANT_NOT_FOUND',
    });
  });

  it('throws MERCHANT_NOT_PENDING when kycStatus is not PENDING_PSP', async () => {
    mockPrisma.merchant.findUnique.mockResolvedValue({ id: 'm1', kycStatus: 'APPROVED' });
    await expect(MerchantService.approve('m1')).rejects.toMatchObject({
      statusCode: 400,
      code: 'MERCHANT_NOT_PENDING',
    });
  });

  it('updates kycStatus to APPROVED', async () => {
    mockPrisma.merchant.findUnique.mockResolvedValue({ id: 'm1', kycStatus: 'PENDING_PSP' });
    await MerchantService.approve('m1');
    expect(mockTx.merchant.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { kycStatus: 'APPROVED' } }),
    );
  });

  it('creates MERCHANT_APPROVED audit log', async () => {
    mockPrisma.merchant.findUnique.mockResolvedValue({ id: 'm1', kycStatus: 'PENDING_PSP' });
    await MerchantService.approve('m1');
    expect(mockTx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'MERCHANT_APPROVED' }),
      }),
    );
  });
});

// ─── reject ───────────────────────────────────────────────────────────────────

describe('MerchantService.reject', () => {
  const rejectData = { reason: 'Documents insuffisants' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockTx.merchant.update.mockResolvedValue({});
    mockTx.auditLog.create.mockResolvedValue({});
    mockPrisma.$transaction.mockImplementation((fn: Function) => fn(mockTx));
  });

  it('throws MERCHANT_NOT_FOUND when merchant does not exist', async () => {
    mockPrisma.merchant.findUnique.mockResolvedValue(null);
    await expect(MerchantService.reject('unknown', rejectData)).rejects.toMatchObject({
      statusCode: 404,
      code: 'MERCHANT_NOT_FOUND',
    });
  });

  it('throws MERCHANT_ALREADY_REJECTED when already rejected', async () => {
    mockPrisma.merchant.findUnique.mockResolvedValue({ id: 'm1', kycStatus: 'REJECTED' });
    await expect(MerchantService.reject('m1', rejectData)).rejects.toMatchObject({
      statusCode: 400,
      code: 'MERCHANT_ALREADY_REJECTED',
    });
  });

  it('updates kycStatus to REJECTED', async () => {
    mockPrisma.merchant.findUnique.mockResolvedValue({ id: 'm1', kycStatus: 'PENDING_PSP' });
    await MerchantService.reject('m1', rejectData);
    expect(mockTx.merchant.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { kycStatus: 'REJECTED' } }),
    );
  });

  it('stores rejection reason in audit log metadata', async () => {
    mockPrisma.merchant.findUnique.mockResolvedValue({ id: 'm1', kycStatus: 'PENDING_PSP' });
    await MerchantService.reject('m1', rejectData);
    expect(mockTx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'MERCHANT_REJECTED',
          metadata: { reason: rejectData.reason },
        }),
      }),
    );
  });
});

// ─── activate ─────────────────────────────────────────────────────────────────

describe('MerchantService.activate', () => {
  const activateData = { pspMerchantReference: 'PSP-MERCHANT-001' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockTx.merchant.update.mockResolvedValue({});
    mockTx.auditLog.create.mockResolvedValue({});
    mockPrisma.$transaction.mockImplementation((fn: Function) => fn(mockTx));
  });

  it('throws MERCHANT_NOT_FOUND when merchant does not exist', async () => {
    mockPrisma.merchant.findUnique.mockResolvedValue(null);
    await expect(MerchantService.activate('unknown', activateData)).rejects.toMatchObject({
      statusCode: 404,
      code: 'MERCHANT_NOT_FOUND',
    });
  });

  it('throws MERCHANT_NOT_APPROVED when kycStatus is not APPROVED', async () => {
    mockPrisma.merchant.findUnique.mockResolvedValue({ id: 'm1', kycStatus: 'PENDING_PSP' });
    await expect(MerchantService.activate('m1', activateData)).rejects.toMatchObject({
      statusCode: 400,
      code: 'MERCHANT_NOT_APPROVED',
    });
  });

  it('sets pspMerchantReference and activationStatus ACTIVE', async () => {
    mockPrisma.merchant.findUnique.mockResolvedValue({ id: 'm1', kycStatus: 'APPROVED' });
    await MerchantService.activate('m1', activateData);
    expect(mockTx.merchant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          pspMerchantReference: activateData.pspMerchantReference,
          activationStatus: 'ACTIVE',
        },
      }),
    );
  });

  it('creates MERCHANT_ACTIVATED audit log with pspRef', async () => {
    mockPrisma.merchant.findUnique.mockResolvedValue({ id: 'm1', kycStatus: 'APPROVED' });
    await MerchantService.activate('m1', activateData);
    expect(mockTx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'MERCHANT_ACTIVATED',
          metadata: { pspMerchantReference: activateData.pspMerchantReference },
        }),
      }),
    );
  });
});

// ─── suspend ──────────────────────────────────────────────────────────────────

describe('MerchantService.suspend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTx.merchant.update.mockResolvedValue({});
    mockTx.auditLog.create.mockResolvedValue({});
    mockPrisma.$transaction.mockImplementation((fn: Function) => fn(mockTx));
  });

  it('throws MERCHANT_NOT_FOUND when merchant does not exist', async () => {
    mockPrisma.merchant.findUnique.mockResolvedValue(null);
    await expect(MerchantService.suspend('unknown')).rejects.toMatchObject({
      statusCode: 404,
      code: 'MERCHANT_NOT_FOUND',
    });
  });

  it('throws MERCHANT_ALREADY_SUSPENDED when already suspended', async () => {
    mockPrisma.merchant.findUnique.mockResolvedValue({ id: 'm1', activationStatus: 'SUSPENDED' });
    await expect(MerchantService.suspend('m1')).rejects.toMatchObject({
      statusCode: 400,
      code: 'MERCHANT_ALREADY_SUSPENDED',
    });
  });

  it('sets activationStatus to SUSPENDED', async () => {
    mockPrisma.merchant.findUnique.mockResolvedValue({ id: 'm1', activationStatus: 'ACTIVE' });
    await MerchantService.suspend('m1');
    expect(mockTx.merchant.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { activationStatus: 'SUSPENDED' } }),
    );
  });

  it('creates MERCHANT_SUSPENDED audit log', async () => {
    mockPrisma.merchant.findUnique.mockResolvedValue({ id: 'm1', activationStatus: 'ACTIVE' });
    await MerchantService.suspend('m1');
    expect(mockTx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'MERCHANT_SUSPENDED' }),
      }),
    );
  });
});
