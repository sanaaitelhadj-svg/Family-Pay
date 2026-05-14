import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/redis.js', () => ({
  redis: {
    setex: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
  },
}));

import { TokenService, JwtPayload } from './token.service.js';
import { redis } from '../../lib/redis.js';

const mockRedis = redis as any;

const testPayload: JwtPayload = {
  userId: 'user-123',
  role: 'SPONSOR',
  profileId: 'sponsor-456',
};

describe('TokenService — access token', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-for-vitest';
  });

  it('issues a JWT string', () => {
    const token = TokenService.issueAccessToken(testPayload);
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);
  });

  it('verifies a valid token and returns the payload', () => {
    const token = TokenService.issueAccessToken(testPayload);
    const decoded = TokenService.verifyAccessToken(token);
    expect(decoded.userId).toBe(testPayload.userId);
    expect(decoded.role).toBe(testPayload.role);
    expect(decoded.profileId).toBe(testPayload.profileId);
  });

  it('throws TOKEN_INVALID for a tampered token', () => {
    const token = TokenService.issueAccessToken(testPayload);
    const tampered = token.slice(0, -5) + 'XXXXX';
    expect(() => TokenService.verifyAccessToken(tampered)).toThrowError(
      expect.objectContaining({ code: 'TOKEN_INVALID', statusCode: 401 })
    );
  });

  it('throws TOKEN_INVALID for a token signed with wrong secret', () => {
    const otherToken = TokenService.issueAccessToken(testPayload);
    process.env.JWT_SECRET = 'different-secret';
    expect(() => TokenService.verifyAccessToken(otherToken)).toThrowError(
      expect.objectContaining({ code: 'TOKEN_INVALID' })
    );
    process.env.JWT_SECRET = 'test-secret-for-vitest';
  });

  it('embeds all four roles correctly', () => {
    const roles: JwtPayload['role'][] = ['SPONSOR', 'BENEFICIARY', 'MERCHANT', 'ADMIN'];
    roles.forEach((role) => {
      const t = TokenService.issueAccessToken({ ...testPayload, role });
      const d = TokenService.verifyAccessToken(t);
      expect(d.role).toBe(role);
    });
  });
});

describe('TokenService — refresh token', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.setex.mockResolvedValue('OK');
    mockRedis.get.mockResolvedValue(null);
    mockRedis.del.mockResolvedValue(1);
  });

  it('stores refresh token in Redis with 7-day TTL', async () => {
    const token = await TokenService.issueRefreshToken('user-123');
    expect(mockRedis.setex).toHaveBeenCalledWith(
      `refresh:${token}`,
      7 * 24 * 3600,
      'user-123'
    );
  });

  it('issues a UUID-like token', async () => {
    const token = await TokenService.issueRefreshToken('user-123');
    expect(token).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('rotateRefreshToken returns userId from Redis', async () => {
    mockRedis.get.mockResolvedValue('user-123');
    const result = await TokenService.rotateRefreshToken('old-token');
    expect(result.userId).toBe('user-123');
  });

  it('rotateRefreshToken deletes old token', async () => {
    mockRedis.get.mockResolvedValue('user-123');
    await TokenService.rotateRefreshToken('old-token');
    expect(mockRedis.del).toHaveBeenCalledWith('refresh:old-token');
  });

  it('throws REFRESH_TOKEN_INVALID when token not in Redis', async () => {
    mockRedis.get.mockResolvedValue(null);
    await expect(TokenService.rotateRefreshToken('stale-token')).rejects.toMatchObject({
      statusCode: 401,
      code: 'REFRESH_TOKEN_INVALID',
    });
  });

  it('revokeRefreshToken deletes the key', async () => {
    await TokenService.revokeRefreshToken('some-token');
    expect(mockRedis.del).toHaveBeenCalledWith('refresh:some-token');
  });
});

describe('TokenService — invitation token', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.setex.mockResolvedValue('OK');
    mockRedis.get.mockResolvedValue(null);
    mockRedis.del.mockResolvedValue(1);
  });

  it('stores invitation token with 7-day TTL and sponsorId', async () => {
    const token = await TokenService.issueInvitationToken('sponsor-789');
    expect(mockRedis.setex).toHaveBeenCalledWith(
      `invite:${token}`,
      7 * 24 * 3600,
      'sponsor-789'
    );
  });

  it('validateInvitationToken returns sponsorId', async () => {
    mockRedis.get.mockResolvedValue('sponsor-789');
    const sponsorId = await TokenService.validateInvitationToken('invite-token');
    expect(sponsorId).toBe('sponsor-789');
  });

  it('throws INVITATION_TOKEN_INVALID when not found in Redis', async () => {
    mockRedis.get.mockResolvedValue(null);
    await expect(TokenService.validateInvitationToken('expired-token')).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVITATION_TOKEN_INVALID',
    });
  });

  it('consumeInvitationToken deletes the key', async () => {
    await TokenService.consumeInvitationToken('invite-token');
    expect(mockRedis.del).toHaveBeenCalledWith('invite:invite-token');
  });
});
