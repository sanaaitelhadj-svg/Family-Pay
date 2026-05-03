export type FamilyPayErrorCode =
  | 'INSUFFICIENT_BALANCE'
  | 'QR_EXPIRED'
  | 'QR_INVALID_OR_EXPIRED'
  | 'QR_ALREADY_USED'
  | 'RULE_VIOLATED'
  | 'PARTNER_NOT_ALLOWED'
  | 'OUT_OF_HOURS'
  | 'DAILY_LIMIT_REACHED'
  | 'AMOUNT_EXCEEDS_LIMIT'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR'
  | 'EMAIL_ALREADY_EXISTS'
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_DISABLED'
  | 'INVALID_REFRESH_TOKEN'
  | 'REFRESH_TOKEN_REVOKED';

export class FamilyPayError extends Error {
  constructor(
    public readonly code: FamilyPayErrorCode,
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'FamilyPayError';
  }
}
