import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { redis } from '../lib/redis.js';

const ACCESS_TTL = 15 * 60;
const REFRESH_TTL = 7 * 24 * 3600;

export interface TokenPayload {
  sub: string;
  tenantId: string;
  role: string;
  jti: string;
}

export function generateAccessToken(sub: string, tenantId: string, role: string): string {
  return jwt.sign({ sub, tenantId, role, jti: uuidv4() }, process.env.JWT_SECRET!, {
    expiresIn: ACCESS_TTL,
  });
}

export function generateRefreshToken(
  sub: string,
  tenantId: string,
  role: string,
): { token: string; jti: string } {
  const jti = uuidv4();
  const token = jwt.sign({ sub, tenantId, role, jti }, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: REFRESH_TTL,
  });
  return { token, jti };
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as TokenPayload;
}

export async function storeRefreshToken(jti: string, userId: string): Promise<void> {
  await redis.setex(`refresh:jti:${jti}`, REFRESH_TTL, userId);
}

export async function revokeRefreshToken(jti: string): Promise<void> {
  await redis.del(`refresh:jti:${jti}`);
}

export async function isRefreshTokenValid(jti: string, userId: string): Promise<boolean> {
  const stored = await redis.get(`refresh:jti:${jti}`);
  return stored === userId;
}
