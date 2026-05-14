import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '../../lib/errors.js';

vi.mock('../qr/qr.service.js', () => ({
  QrService: { validate: vi.fn(), consume: vi.fn() },
}));

vi.mock('../authorization/authorization.engine.js', () => ({
  AuthorizationEngine: { authorize: vi.fn() },
}));

vi.mock('../psp/psp.mock.js', () => ({
  MockPspConnector: { debit: vi.fn() },
}));

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    merchant: { findUnique: vi.fn() },
    authorization: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { TransactionService } from './transaction.service.js';
import { prisma } from '../../lib/prisma.js';
import { QrService } from '../qr/qr.service.js';
import { AuthorizationEngine } from '../authorization/authorization.engine.js';
import { MockPspConnector } from '../psp/psp.mock.js';

const mockPrisma = prisma as unknown as {
  merchant: { findUnique: ReturnType<typeof vi.fn> };
  authorization: { findUnique: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};
const mockQr = QrService as unknown as { validate: ReturnType<typeof vi.fn>; consume: ReturnType<typeof vi.fn> };
const mockEngine = AuthorizationEngine as unknown as { authorize: ReturnType<typeof vi.fn> };
const mockPsp = MockPspConnector as unknown as { debit: ReturnType<typeof vi.fn> };

const mockTx = {
  transaction: { create: vi.fn() },
  allocation: { update: vi.fn() },
  qrCode: { update: vi.fn() },
  auditLog: { create: vi.fn() },
};

const qrPayload = { merchantId: 'm-1', category: 'PHARMACY', amount: 100, nonce: 'nonce-1', qrCodeId: 'qr-1' };
const approvedAuth = { status: 'APPROVED', authorizationId: 'auth-1', fraudScore: 0 };
const authRecord = { allocationId: 'alloc-1', allocation: { sponsorId: 's-1' } };
const pspOk = { success: true, pspTransactionId: 'PSP-MOCK-123' };

describe('TransactionService.processPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQr.validate.mockReturnValue(qrPayload);
    mockQr.consume.mockResolvedValue(undefined);
    mockPrisma.merchant.findUnique.mockResolvedValue({ pspMerchantReference: 'PSP-MERCHANT-001' });
    mockEngine.authorize.mockResolvedValue(approvedAuth);
    mockPrisma.authorization.findUnique.mockResolvedValue(authRecord);
    mockPsp.debit.mockResolvedValue(pspOk);
    mockPrisma.$transaction.mockImplementation((fn: Function) => fn(mockTx));
    mockTx.transaction.create.mockResolvedValue({});
    mockTx.allocation.update.mockResolvedValue({});
    mockTx.qrCode.update.mockResolvedValue({});
    mockTx.auditLog.create.mockResolvedValue({});
  });

  it('propagates QR_INVALID when QrService.validate throws', async () => {
    mockQr.validate.mockImplementation(() => {
      throw new AppError('Invalide', 400, 'QR_INVALID');
    });
    await expect(TransactionService.processPayment('bad', 'b-1')).rejects.toMatchObject({
      code: 'QR_INVALID',
    });
  });

  it('propagates QR_ALREADY_USED when QrService.consume throws', async () => {
    mockQr.consume.mockRejectedValue(new AppError('Utilisé', 400, 'QR_ALREADY_USED'));
    await expect(TransactionService.processPayment('token', 'b-1')).rejects.toMatchObject({
      code: 'QR_ALREADY_USED',
    });
  });

  it('returns MERCHANT_PSP_NOT_CONFIGURED when merchant has no pspMerchantReference', async () => {
    mockPrisma.merchant.findUnique.mockResolvedValue({ pspMerchantReference: null });
    const result = await TransactionService.processPayment('token', 'b-1');
    expect(result.success).toBe(false);
    expect(result.rejectionReason).toBe('MERCHANT_PSP_NOT_CONFIGURED');
  });

  it('returns rejection result when authorization is not APPROVED', async () => {
    mockEngine.authorize.mockResolvedValue({
      status: 'REJECTED', authorizationId: null,
      rejectionReason: 'INSUFFICIENT_ALLOCATION', fraudScore: 0,
    });
    const result = await TransactionService.processPayment('token', 'b-1');
    expect(result.success).toBe(false);
    expect(result.rejectionReason).toBe('INSUFFICIENT_ALLOCATION');
  });

  it('calls PSP debit with merchant pspMerchantReference', async () => {
    await TransactionService.processPayment('token', 'b-1');
    expect(mockPsp.debit).toHaveBeenCalledWith(
      expect.objectContaining({ merchantPspReference: 'PSP-MERCHANT-001' }),
    );
  });

  it('inserts COMPLETED transaction on PSP success', async () => {
    await TransactionService.processPayment('token', 'b-1');
    expect(mockTx.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'COMPLETED', pspTransactionId: 'PSP-MOCK-123' }),
      }),
    );
  });

  it('inserts FAILED transaction on PSP failure', async () => {
    mockPsp.debit.mockResolvedValue({ success: false, pspTransactionId: 'PSP-FAIL' });
    await TransactionService.processPayment('token', 'b-1');
    expect(mockTx.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );
  });

  it('rolls back allocation remainingAmount on PSP failure', async () => {
    mockPsp.debit.mockResolvedValue({ success: false, pspTransactionId: 'PSP-FAIL' });
    await TransactionService.processPayment('token', 'b-1');
    expect(mockTx.allocation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { remainingAmount: { increment: 100 } } }),
    );
  });

  it('does NOT touch allocation on PSP success', async () => {
    await TransactionService.processPayment('token', 'b-1');
    expect(mockTx.allocation.update).not.toHaveBeenCalled();
  });

  it('creates TRANSACTION_COMPLETED audit log on success', async () => {
    await TransactionService.processPayment('token', 'b-1');
    expect(mockTx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'TRANSACTION_COMPLETED' }),
      }),
    );
  });

  it('returns success result with authorizationId and pspTransactionId', async () => {
    const result = await TransactionService.processPayment('token', 'b-1');
    expect(result.success).toBe(true);
    expect(result.authorizationId).toBe('auth-1');
    expect(result.pspTransactionId).toBe('PSP-MOCK-123');
  });
});
