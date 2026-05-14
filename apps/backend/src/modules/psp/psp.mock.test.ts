import { describe, it, expect } from 'vitest';
import { MockPspConnector } from './psp.mock.js';

const request = {
  sponsorId: 's-1',
  amount: 100,
  merchantPspReference: 'PSP-MERCHANT-001',
  authorizationId: 'auth-1',
};

describe('MockPspConnector.debit', () => {
  it('returns success: true', async () => {
    const result = await MockPspConnector.debit(request);
    expect(result.success).toBe(true);
  });

  it('returns a pspTransactionId containing PSP-MOCK', async () => {
    const result = await MockPspConnector.debit(request);
    expect(result.pspTransactionId).toMatch(/^PSP-MOCK-/);
  });

  it('returns a unique pspTransactionId on each call', async () => {
    const r1 = await MockPspConnector.debit(request);
    const r2 = await MockPspConnector.debit(request);
    expect(r1.pspTransactionId).not.toBe(r2.pspTransactionId);
  });
});
