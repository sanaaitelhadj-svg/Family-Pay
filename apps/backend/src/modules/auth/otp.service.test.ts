import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    otpCode: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('../../lib/redis.js', () => ({
  redis: {
    get: vi.fn(),
    incr: vi.fn(),
    expire: vi.fn(),
  },
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$hashed'),
    compare: vi.fn(),
  },
}));

import { OtpService } from './otp.service.js';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import bcrypt from 'bcryptjs';

const mockPrisma = prisma as any;
const mockRedis = redis as any;
const mockBcrypt = bcrypt as any;

describe('OtpService.generateCode', () => {
  it('returns a 6-digit string', () => {
    const code = OtpService.generateCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it('returns value between 100000 and 999999', () => {
    for (let i = 0; i < 20; i++) {
      const n = parseInt(OtpService.generateCode(), 10);
      expect(n).toBeGreaterThanOrEqual(100000);
      expect(n).toBeLessThanOrEqual(999999);
    }
  });
});

describe('OtpService.requestOtp', () => {
  const phone = '+212612345678';

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.get.mockResolvedValue(null);
    mockRedis.incr.mockResolvedValue(1);
    mockRedis.expire.mockResolvedValue(1);
    mockPrisma.otpCode.create.mockResolvedValue({});
    process.env.NODE_ENV = 'development';
  });

  it('creates an OTP record in the database', async () => {
    await OtpService.requestOtp(phone, 'SIGNUP');
    expect(mockPrisma.otpCode.create).toHaveBeenCalledOnce();
    const callArg = mockPrisma.otpCode.create.mock.calls[0][0];
    expect(callArg.data.phone).toBe(phone);
    expect(callArg.data.purpose).toBe('SIGNUP');
    expect(callArg.data.codeHash).toBe('$hashed');
  });

  it('stores hashed code, not plain text', async () => {
    await OtpService.requestOtp(phone, 'SIGNUP');
    expect(mockBcrypt.hash).toHaveBeenCalledOnce();
    const callArg = mockPrisma.otpCode.create.mock.calls[0][0];
    expect(callArg.data.codeHash).not.toMatch(/^\d{6}$/);
  });

  it('increments the rate-limit counter in Redis', async () => {
    await OtpService.requestOtp(phone, 'SIGNUP');
    expect(mockRedis.incr).toHaveBeenCalledWith(`otp:rate:${phone}`);
  });

  it('sets expiry on the rate-limit key', async () => {
    await OtpService.requestOtp(phone, 'SIGNUP');
    expect(mockRedis.expire).toHaveBeenCalledWith(`otp:rate:${phone}`, 3600);
  });

  it('throws 429 when rate limit reached (5 attempts)', async () => {
    mockRedis.get.mockResolvedValue('5');
    await expect(OtpService.requestOtp(phone, 'SIGNUP')).rejects.toMatchObject({
      statusCode: 429,
      code: 'OTP_RATE_LIMIT_EXCEEDED',
    });
  });

  it('does NOT throw when counter is 4 (one below limit)', async () => {
    mockRedis.get.mockResolvedValue('4');
    await expect(OtpService.requestOtp(phone, 'SIGNUP')).resolves.not.toThrow();
  });

  it('returns the raw code in development mode', async () => {
    const result = await OtpService.requestOtp(phone, 'SIGNUP');
    expect(result).toMatch(/^\d{6}$/);
  });

  it('returns "SENT" in production mode', async () => {
    process.env.NODE_ENV = 'production';
    const result = await OtpService.requestOtp(phone, 'SIGNUP');
    expect(result).toBe('SENT');
    process.env.NODE_ENV = 'development';
  });
});

describe('OtpService.verifyOtp', () => {
  const phone = '+212612345678';
  const validRecord = {
    id: 'otp-id-1',
    codeHash: '$hashed',
    expiresAt: new Date(Date.now() + 60_000),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks OTP as used when code is correct', async () => {
    mockPrisma.otpCode.findFirst.mockResolvedValue(validRecord);
    mockBcrypt.compare.mockResolvedValue(true);
    mockPrisma.otpCode.update.mockResolvedValue({});

    await OtpService.verifyOtp(phone, '123456', 'SIGNUP');
    expect(mockPrisma.otpCode.update).toHaveBeenCalledWith({
      where: { id: validRecord.id },
      data: { usedAt: expect.any(Date) },
    });
  });

  it('throws OTP_INVALID_OR_EXPIRED when no valid record found', async () => {
    mockPrisma.otpCode.findFirst.mockResolvedValue(null);
    await expect(OtpService.verifyOtp(phone, '123456', 'SIGNUP')).rejects.toMatchObject({
      statusCode: 400,
      code: 'OTP_INVALID_OR_EXPIRED',
    });
  });

  it('throws OTP_INCORRECT when code does not match hash', async () => {
    mockPrisma.otpCode.findFirst.mockResolvedValue(validRecord);
    mockBcrypt.compare.mockResolvedValue(false);
    await expect(OtpService.verifyOtp(phone, '000000', 'SIGNUP')).rejects.toMatchObject({
      statusCode: 400,
      code: 'OTP_INCORRECT',
    });
  });

  it('queries only non-used, non-expired records', async () => {
    mockPrisma.otpCode.findFirst.mockResolvedValue(null);
    await expect(OtpService.verifyOtp(phone, '123456', 'LOGIN')).rejects.toThrow();
    const query = mockPrisma.otpCode.findFirst.mock.calls[0][0];
    expect(query.where.usedAt).toBeNull();
    expect(query.where.expiresAt).toMatchObject({ gt: expect.any(Date) });
  });
});
