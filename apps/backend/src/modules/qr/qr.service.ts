import jwt from 'jsonwebtoken';
import type { AllocationCategory } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import { AppError } from '../../lib/errors.js';

export interface QrPayload {
  merchantId: string;
  category: string;
  amount: number;
  nonce: string;
  qrCodeId: string;
}

export class QrService {
  static async generate(
    merchantId: string,
    category: string,
    amount: number,
  ): Promise<{ token: string; expiresAt: Date }> {
    const nonce = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60_000);

    const created = await prisma.qrCode.create({
      data: {
        merchantId,
        category: category as AllocationCategory,
        amount,
        token: nonce,
        expiresAt,
      },
      select: { id: true },
    });

    const payload: QrPayload = { merchantId, category, amount, nonce, qrCodeId: created.id };
    const token = jwt.sign(
      payload as object,
      process.env.JWT_SECRET ?? 'dev-secret',
      { expiresIn: 60 },
    );

    await prisma.qrCode.update({ where: { id: created.id }, data: { token } });
    await redis.setex(`qr:nonce:${nonce}`, 60, created.id);

    return { token, expiresAt };
  }

  static validate(token: string): QrPayload {
    try {
      return jwt.verify(
        token,
        process.env.JWT_SECRET ?? 'dev-secret',
      ) as unknown as QrPayload;
    } catch {
      throw new AppError('QR code expiré ou invalide', 400, 'QR_INVALID');
    }
  }

  static async consume(nonce: string, qrCodeId: string): Promise<void> {
    const deleted = await redis.del(`qr:nonce:${nonce}`);
    if (deleted === 0) {
      throw new AppError('QR code déjà utilisé', 400, 'QR_ALREADY_USED');
    }
    await prisma.qrCode.update({
      where: { id: qrCodeId },
      data: { usedAt: new Date() },
    });
  }
}
