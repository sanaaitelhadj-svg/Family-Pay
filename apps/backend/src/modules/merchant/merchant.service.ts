import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { OtpService } from '../auth/otp.service.js';
import type { RegisterMerchantDto, AdminRejectDto, AdminActivateDto } from './merchant.schema.js';

export class MerchantService {
  static async register(data: RegisterMerchantDto): Promise<string> {
    const existing = await prisma.user.findUnique({ where: { phone: data.phone } });
    if (existing) {
      throw new AppError('Ce numéro est déjà enregistré', 409, 'PHONE_ALREADY_EXISTS');
    }

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          phone: data.phone,
          firstName: data.firstName,
          lastName: data.lastName,
          role: 'MERCHANT',
          cndpConsentAt: new Date(),
        },
      });
      await tx.merchant.create({
        data: {
          userId: user.id,
          businessName: data.businessName,
          category: data.category,
          address: data.address,
          city: data.city,
          phone: data.phone,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'MERCHANT_REGISTERED',
          entityType: 'Merchant',
          entityId: user.id,
          metadata: { businessName: data.businessName, city: data.city },
        },
      });
    });

    return OtpService.requestOtp(data.phone, 'SIGNUP');
  }

  static async listPending() {
    return prisma.merchant.findMany({
      where: { kycStatus: 'PENDING_PSP' },
      include: {
        user: { select: { firstName: true, lastName: true, phone: true, createdAt: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  static async approve(merchantId: string): Promise<void> {
    const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
    if (!merchant) {
      throw new AppError('Marchand introuvable', 404, 'MERCHANT_NOT_FOUND');
    }
    if (merchant.kycStatus !== 'PENDING_PSP') {
      throw new AppError(
        "Ce marchand n'est pas en attente de validation",
        400,
        'MERCHANT_NOT_PENDING',
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.merchant.update({
        where: { id: merchantId },
        data: { kycStatus: 'APPROVED' },
      });
      await tx.auditLog.create({
        data: {
          action: 'MERCHANT_APPROVED',
          entityType: 'Merchant',
          entityId: merchantId,
          metadata: { previousStatus: 'PENDING_PSP' },
        },
      });
    });
  }

  static async reject(merchantId: string, data: AdminRejectDto): Promise<void> {
    const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
    if (!merchant) {
      throw new AppError('Marchand introuvable', 404, 'MERCHANT_NOT_FOUND');
    }
    if (merchant.kycStatus === 'REJECTED') {
      throw new AppError('Ce marchand est déjà refusé', 400, 'MERCHANT_ALREADY_REJECTED');
    }

    await prisma.$transaction(async (tx) => {
      await tx.merchant.update({
        where: { id: merchantId },
        data: { kycStatus: 'REJECTED' },
      });
      await tx.auditLog.create({
        data: {
          action: 'MERCHANT_REJECTED',
          entityType: 'Merchant',
          entityId: merchantId,
          metadata: { reason: data.reason },
        },
      });
    });
  }

  static async activate(merchantId: string, data: AdminActivateDto): Promise<void> {
    const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
    if (!merchant) {
      throw new AppError('Marchand introuvable', 404, 'MERCHANT_NOT_FOUND');
    }
    if (merchant.kycStatus !== 'APPROVED') {
      throw new AppError(
        'Le marchand doit être approuvé avant activation',
        400,
        'MERCHANT_NOT_APPROVED',
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.merchant.update({
        where: { id: merchantId },
        data: {
          pspMerchantReference: data.pspMerchantReference,
          activationStatus: 'ACTIVE',
        },
      });
      await tx.auditLog.create({
        data: {
          action: 'MERCHANT_ACTIVATED',
          entityType: 'Merchant',
          entityId: merchantId,
          metadata: { pspMerchantReference: data.pspMerchantReference },
        },
      });
    });
  }

  static async suspend(merchantId: string): Promise<void> {
    const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
    if (!merchant) {
      throw new AppError('Marchand introuvable', 404, 'MERCHANT_NOT_FOUND');
    }
    if (merchant.activationStatus === 'SUSPENDED') {
      throw new AppError('Ce marchand est déjà suspendu', 400, 'MERCHANT_ALREADY_SUSPENDED');
    }

    await prisma.$transaction(async (tx) => {
      await tx.merchant.update({
        where: { id: merchantId },
        data: { activationStatus: 'SUSPENDED' },
      });
      await tx.auditLog.create({
        data: {
          action: 'MERCHANT_SUSPENDED',
          entityType: 'Merchant',
          entityId: merchantId,
          metadata: {},
        },
      });
    });
  }
}
