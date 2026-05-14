export interface PspDebitRequest {
  sponsorId: string;
  amount: number;
  merchantPspReference: string;
  authorizationId: string;
}

export interface PspDebitResult {
  success: boolean;
  pspTransactionId: string;
  failureReason?: string;
}

export class MockPspConnector {
  static async debit(_request: PspDebitRequest): Promise<PspDebitResult> {
    return {
      success: true,
      pspTransactionId: `PSP-MOCK-${Date.now()}-${Math.random().toString(36).slice(2, 9).toUpperCase()}`,
    };
  }
}
