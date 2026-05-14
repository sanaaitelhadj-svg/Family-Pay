import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    qrCode: { create: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('../../lib/redis.js', () => ({
  redis: { setex: vi.fn(), del: vi.fn() },
}));

import { QrService } from './qr.service.js';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';

const mockPrisma = prisma as unknown as {
  qrCode: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
};
const mockRedis = redis as unknown as {
  setex: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
};

const SECRET = 'test-secret-qr';

function makeToken(overrides = {}) {
  return jwt.sign(
    { merchantId: 'm-1', category: 'PHARMACY', amount: 100, nonce: 'nonce-1', qrCodeId: 'qr-1', ...overrides },
    SECRET,
    { expiresIn: 60 },
  );
}

// ─── generate ────────────────────────────────────────────────────────────────

describe('QrService.generate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = SECRET;
    mockPrisma.qrCode.create.mockResolvedValue({ id: 'qr-1' });
    mockPrisma.qrCode.update.mockResolvedValue({});
    mockRedis.setex.mockResolvedValue('OK');
  });

  it('returns a signed JWT (3-part string)', async () => {
    const { token } = await QrService.generate('m-1', 'PHARMACY', 100);
    expect(token.split('.')).toHaveLength(3);
  });

  it('creates QrCode in DB with merchantId, category, amount', async () => {
    await QrService.generate('m-1', 'PHARMACY', 100);
    expect(mockPrisma.qrCode.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ merchantId: 'm-1', category: 'PHARMACY', amount: 100 }),
      }),
    );
  });

  it('stores nonce in Redis with 60s TTL and qrCodeId as value', async () => {
    await QrService.generate('m-1', 'PHARMACY', 100);
    expect(mockRedis.setex).toHaveBeenCalledWith(
      expect.stringMatching(/^qr:nonce:/),
      60,
      'qr-1',
    );
  });

  it('updates QrCode with the final JWT token', async () => {
    const { token } = await QrService.generate('m-1', 'PHARMACY', 100);
    expect(mockPrisma.qrCode.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { token } }),
    );
  });
});

// ─── validate ────────────────────────────────────────────────────────────────

describe('QrService.validate', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = SECRET;
  });

  it('returns payload with all fields', () => {
    const payload = QrService.validate(makeToken());
    expect(payload.merchantId).toBe('m-1');
    expect(payload.category).toBe('PHARMACY');
    expect(payload.amount).toBe(100);
    expect(payload.nonce).toBe('nonce-1');
    expect(payload.qrCodeId).toBe('qr-1');
  });

  it('throws QR_INVALID for an expired token', () => {
    const expired = jwt.sign({ merchantId: 'm-1', nonce: 'n', qrCodeId: 'q' }, SECRET, { expiresIn: -1 });
    expect(() => QrService.validate(expired)).toThrow(
      expect.objectContaining({ code: 'QR_INVALID' }),
    );
  });

  it('throws QR_INVALID for a tampered token', () => {
    const tampered = makeToken().slice(0, -5) + 'XXXXX';
    expect(() => QrService.validate(tampered)).toThrow(
      expect.objectContaining({ code: 'QR_INVALID' }),
    );
  });
});

// ─── consume ─────────────────────────────────────────────────────────────────

describe('QrService.consume', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.del.mockResolvedValue(1);
    mockPrisma.qrCode.update.mockResolvedValue({});
  });

  it('deletes the nonce key from Redis', async () => {
    await QrService.consume('nonce-1', 'qr-1');
    expect(mockRedis.del).toHaveBeenCalledWith('qr:nonce:nonce-1');
  });

  it('updates qrCode.usedAt', async () => {
    await QrService.consume('nonce-1', 'qr-1');
    expect(mockPrisma.qrCode.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'qr-1' },
        data: expect.objectContaining({ usedAt: expect.any(Date) }),
      }),
    );
  });

  it('throws QR_ALREADY_USED when nonce is not in Redis (del returns 0)', async () => {
    mockRedis.del.mockResolvedValue(0);
    await expect(QrService.consume('nonce-1', 'qr-1')).rejects.toMatchObject({
      code: 'QR_ALREADY_USED',
    });
  });
});
