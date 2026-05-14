import { prisma } from '../../lib/prisma.js';
import { QrService } from '../qr/qr.service.js';
import { AuthorizationEngine } from '../authorization/authorization.engine.js';
import { MockPspConnector } from '../psp/psp.mock.js';

export interface PaymentResult {
  success: boolean;
  status?: string;
  authorizationId?: string | null;
  pspTransactionId?: string;
  rejectionReason?: string;
}

export class TransactionService {
  static async processPayment(token: string, beneficiaryId: string): Promise<PaymentResult> {
    // 1. Validate QR JWT (throws QR_INVALID if expired/tampered)
    const qrPayload = QrService.validate(token);

    // 2. Consume nonce atomically — replay protection (throws QR_ALREADY_USED)
    await QrService.consume(qrPayload.nonce, qrPayload.qrCodeId);

    // 3. Merchant PSP reference
    const merchant = await prisma.merchant.findUnique({
      where: { id: qrPayload.merchantId },
      select: { pspMerchantReference: true },
    });
    if (!merchant?.pspMerchantReference) {
      return { success: false, rejectionReason: 'MERCHANT_PSP_NOT_CONFIGURED' };
    }

    // 4. Authorization Engine
    const authResult = await AuthorizationEngine.authorize({
      beneficiaryId,
      merchantId: qrPayload.merchantId,
      amount: qrPayload.amount,
      category: qrPayload.category,
    });

    if (authResult.status !== 'APPROVED') {
      return {
        success: false,
        status: authResult.status,
        authorizationId: authResult.authorizationId,
        rejectionReason: authResult.rejectionReason,
      };
    }

    // 5. Get sponsorId via authorization → allocation
    const authRecord = await prisma.authorization.findUnique({
      where: { id: authResult.authorizationId! },
      select: { allocationId: true, allocation: { select: { sponsorId: true } } },
    });

    // 6. PSP debit (mock)
    const pspResult = await MockPspConnector.debit({
      sponsorId: authRecord!.allocation.sponsorId,
      amount: qrPayload.amount,
      merchantPspReference: merchant.pspMerchantReference,
      authorizationId: authResult.authorizationId!,
    });

    // 7. Persist transaction + optional rollback + audit log
    await prisma.$transaction(async (tx) => {
      await tx.transaction.create({
        data: {
          authorizationId: authResult.authorizationId!,
          sponsorId: authRecord!.allocation.sponsorId,
          merchantId: qrPayload.merchantId,
          amount: qrPayload.amount,
          pspTransactionId: pspResult.pspTransactionId,
          status: pspResult.success ? 'COMPLETED' : 'FAILED',
        },
      });

      if (!pspResult.success) {
        await tx.allocation.update({
          where: { id: authRecord!.allocationId },
          data: { remainingAmount: { increment: qrPayload.amount } },
        });
      }

      await tx.qrCode.update({
        where: { id: qrPayload.qrCodeId },
        data: { authorizationId: authResult.authorizationId },
      });

      await tx.auditLog.create({
        data: {
          action: pspResult.success ? 'TRANSACTION_COMPLETED' : 'TRANSACTION_FAILED',
          entityType: 'Transaction',
          entityId: authResult.authorizationId!,
          metadata: {
            amount: qrPayload.amount,
            merchantId: qrPayload.merchantId,
            pspTransactionId: pspResult.pspTransactionId,
          },
        },
      });
    });

    return {
      success: pspResult.success,
      status: pspResult.success ? 'COMPLETED' : 'FAILED',
      authorizationId: authResult.authorizationId,
      pspTransactionId: pspResult.pspTransactionId,
    };
  }
}
