import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { redis } from '../../lib/redis.js';
import { AppError } from '../../lib/errors.js';

const ACCESS_TTL = 15 * 60;
const REFRESH_TTL = 7 * 24 * 3600;

export interface JwtPayload {
  userId: string;
  role: 'SPONSOR' | 'BENEFICIARY' | 'MERCHANT' | 'ADMIN';
  profileId: string;
}

export class TokenService {
  static issueAccessToken(payload: JwtPayload): string {
    return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: ACCESS_TTL });
  }

  static async issueRefreshToken(userId: string): Promise<string> {
    const token = uuidv4();
    await redis.setex(`refresh:${token}`, REFRESH_TTL, userId);
    return token;
  }

  static verifyAccessToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    } catch {
      throw new AppError('Token invalide ou expiré', 401, 'TOKEN_INVALID');
    }
  }

  static async rotateRefreshToken(oldToken: string): Promise<{ accessToken: string; refreshToken: string; userId: string }> {
    const userId = await redis.get(`refresh:${oldToken}`);
    if (!userId) {
      throw new AppError('Refresh token invalide ou expiré', 401, 'REFRESH_TOKEN_INVALID');
    }

    await redis.del(`refresh:${oldToken}`);

    return { userId, accessToken: '', refreshToken: '' };
  }

  static async revokeRefreshToken(token: string): Promise<void> {
    await redis.del(`refresh:${token}`);
  }

  static async issueInvitationToken(sponsorId: string): Promise<string> {
    const token = uuidv4();
    const ttl = 7 * 24 * 3600;
    await redis.setex(`invite:${token}`, ttl, sponsorId);
    return token;
  }

  static async validateInvitationToken(token: string): Promise<string> {
    const sponsorId = await redis.get(`invite:${token}`);
    if (!sponsorId) {
      throw new AppError("Lien d'invitation invalide ou expiré", 400, 'INVITATION_TOKEN_INVALID');
    }
    return sponsorId;
  }

  static async consumeInvitationToken(token: string): Promise<void> {
    await redis.del(`invite:${token}`);
  }
}
