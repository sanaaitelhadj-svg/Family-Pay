import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { withTenant } from '../lib/prisma.js';
import { FamilyPayError } from '../lib/errors.js';

const QR_TTL = parseInt(process.env.QR_TTL_SECONDS ?? '60', 10);

export interface QrPayload {
  sub: string;
  tenantId: string;
  jti: string;
  envelopeId: string | null;
}

export async function generateQrCode(
  beneficiaryId: string,
  tenantId: string,
  envelopeId?: string,
) {
  const jti = uuidv4();
  const expiresAt = new Date(Date.now() + QR_TTL * 1000);

  const token = jwt.sign(
    { sub: beneficiaryId, tenantId, jti, envelopeId: envelopeId ?? null },
    process.env.QR_SECRET!,
    { expiresIn: QR_TTL },
  );

  const qrRecord = await withTenant(tenantId, (tx) =>
    tx.qrCode.create({ data: { tenantId, beneficiaryId, token, expiresAt } }),
  );

  return { id: qrRecord.id, token, expiresAt };
}

export function decodeQrToken(token: string): QrPayload {
  try {
    return jwt.verify(token, process.env.QR_SECRET!) as QrPayload;
  } catch {
    throw new FamilyPayError('QR_INVALID_OR_EXPIRED', 400, 'QR code invalide ou expiré');
  }
}
