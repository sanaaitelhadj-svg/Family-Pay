import { smsProvider } from '../../lib/sms.js';
import { randomInt } from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import { AppError } from '../../lib/errors.js';

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RATE_LIMIT = 5;
const OTP_RATE_WINDOW = 3600;

export class OtpService {
  static generateCode(): string {
    return randomInt(100000, 999999).toString();
  }

  static async requestOtp(phone: string, purpose: 'SIGNUP' | 'LOGIN' | 'VERIFY_PHONE'): Promise<string> {
    await this.checkRateLimit(phone);

    const code = this.generateCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await prisma.otpCode.create({
      data: { phone, codeHash, purpose, expiresAt },
    });

    const rateLimitKey = `otp:rate:${phone}`;
    await redis.incr(rateLimitKey);
    await redis.expire(rateLimitKey, OTP_RATE_WINDOW);

    await smsProvider.send(phone, code);
    return 'SENT';
  }

  static async verifyOtp(phone: string, code: string, purpose: 'SIGNUP' | 'LOGIN' | 'VERIFY_PHONE'): Promise<void> {
    const otpRecord = await prisma.otpCode.findFirst({
      where: {
        phone,
        purpose,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      throw new AppError('OTP invalide ou expiré', 400, 'OTP_INVALID_OR_EXPIRED');
    }

    const isValid = await bcrypt.compare(code, otpRecord.codeHash);
    if (!isValid) {
      throw new AppError('Code OTP incorrect', 400, 'OTP_INCORRECT');
    }

    await prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { usedAt: new Date() },
    });
  }

  private static async checkRateLimit(phone: string): Promise<void> {
    const key = `otp:rate:${phone}`;
    const attempts = await redis.get(key);
    if (attempts && parseInt(attempts) >= OTP_RATE_LIMIT) {
      throw new AppError('Trop de demandes OTP. Réessayez dans 1 heure.', 429, 'OTP_RATE_LIMIT_EXCEEDED');
    }
  }
}
