import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    authorization: { count: vi.fn() },
  },
}));

import { FraudEngine } from './fraud.engine.js';
import { prisma } from '../../lib/prisma.js';

const mockPrisma = prisma as unknown as {
  authorization: { count: ReturnType<typeof vi.fn> };
};

describe('FraudEngine.score', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.authorization.count.mockResolvedValue(0);
  });

  it('returns score 0 and empty signals when no fraud detected', async () => {
    const result = await FraudEngine.score('b-1', 150);
    expect(result.score).toBe(0);
    expect(result.signals).toHaveLength(0);
  });

  it('adds VELOCITY_HIGH +40 when hourly count >= 5', async () => {
    mockPrisma.authorization.count.mockResolvedValue(5);
    const result = await FraudEngine.score('b-1', 150);
    expect(result.score).toBe(40);
    expect(result.signals).toContain('VELOCITY_HIGH');
  });

  it('does NOT fire VELOCITY_HIGH when hourly count is 4', async () => {
    mockPrisma.authorization.count.mockResolvedValue(4);
    const result = await FraudEngine.score('b-1', 150);
    expect(result.signals).not.toContain('VELOCITY_HIGH');
  });

  it('adds ROUND_AMOUNT_REPEAT +20 when round amount repeated >= 3 times in 24h', async () => {
    mockPrisma.authorization.count
      .mockResolvedValueOnce(0)  // velocity
      .mockResolvedValueOnce(3); // round repeat
    const result = await FraudEngine.score('b-1', 200);
    expect(result.score).toBe(20);
    expect(result.signals).toContain('ROUND_AMOUNT_REPEAT');
  });

  it('does NOT fire ROUND_AMOUNT_REPEAT for non-round amounts', async () => {
    mockPrisma.authorization.count.mockResolvedValue(0);
    const result = await FraudEngine.score('b-1', 150);
    expect(result.signals).not.toContain('ROUND_AMOUNT_REPEAT');
  });

  it('does NOT fire ROUND_AMOUNT_REPEAT when repeated < 3 times', async () => {
    mockPrisma.authorization.count
      .mockResolvedValueOnce(0)  // velocity
      .mockResolvedValueOnce(2); // repeat = 2, below threshold
    const result = await FraudEngine.score('b-1', 200);
    expect(result.signals).not.toContain('ROUND_AMOUNT_REPEAT');
  });

  it('fires both signals and returns combined score 60', async () => {
    mockPrisma.authorization.count
      .mockResolvedValueOnce(5)  // velocity
      .mockResolvedValueOnce(3); // round repeat
    const result = await FraudEngine.score('b-1', 200);
    expect(result.score).toBe(60);
    expect(result.signals).toHaveLength(2);
  });

  it('skips round-amount DB query for non-round amounts (optimization)', async () => {
    mockPrisma.authorization.count.mockResolvedValueOnce(0);
    await FraudEngine.score('b-1', 150);
    expect(mockPrisma.authorization.count).toHaveBeenCalledOnce();
  });
});
