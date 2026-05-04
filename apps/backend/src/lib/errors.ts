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
  | 'REFRESH_TOKEN_REVOKED'
  | 'WALLET_NOT_FOUND'
  | 'WALLET_FROZEN'
  | 'ENVELOPE_NOT_FOUND'
  | 'ENVELOPE_INACTIVE'
  | 'SAME_ENVELOPE_TRANSFER'
  | 'ENVELOPE_WALLET_MISMATCH'
  | 'PARTNER_NOT_FOUND'
  | 'FUND_REQUEST_NOT_FOUND'
  | 'FUND_REQUEST_ALREADY_RESPONDED'
  | 'OCCASION_NOT_FOUND';

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
