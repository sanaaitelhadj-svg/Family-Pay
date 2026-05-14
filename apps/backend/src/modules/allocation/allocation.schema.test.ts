import { describe, it, expect } from 'vitest';
import {
  CreateAllocationSchema,
  IncreaseAllocationAmountSchema,
  UpdateAllocationStatusSchema,
} from './allocation.schema.js';

describe('CreateAllocationSchema', () => {
  const base = {
    beneficiaryId: '123e4567-e89b-12d3-a456-426614174000',
    category: 'PHARMACY' as const,
    limitAmount: 500,
  };

  it('accepts valid input', () => {
    expect(CreateAllocationSchema.safeParse(base).success).toBe(true);
  });

  it('accepts with optional fields', () => {
    expect(CreateAllocationSchema.safeParse({
      ...base, expiresAt: '2026-12-31T23:59:59.000Z', renewalPeriod: 'MONTHLY',
    }).success).toBe(true);
  });

  it('accepts all 6 categories', () => {
    (['PHARMACY', 'FOOD', 'CLOTHING', 'EDUCATION', 'LEISURE', 'GENERAL'] as const).forEach((category) => {
      expect(CreateAllocationSchema.safeParse({ ...base, category }).success).toBe(true);
    });
  });

  it('rejects unknown category', () => {
    expect(CreateAllocationSchema.safeParse({ ...base, category: 'HOUSING' }).success).toBe(false);
  });

  it('rejects amount = 0', () => {
    expect(CreateAllocationSchema.safeParse({ ...base, limitAmount: 0 }).success).toBe(false);
  });

  it('rejects negative amount', () => {
    expect(CreateAllocationSchema.safeParse({ ...base, limitAmount: -100 }).success).toBe(false);
  });

  it('rejects amount > 50000', () => {
    expect(CreateAllocationSchema.safeParse({ ...base, limitAmount: 50001 }).success).toBe(false);
  });

  it('accepts amount = 50000 (boundary)', () => {
    expect(CreateAllocationSchema.safeParse({ ...base, limitAmount: 50000 }).success).toBe(true);
  });

  it('rejects non-UUID beneficiaryId', () => {
    expect(CreateAllocationSchema.safeParse({ ...base, beneficiaryId: 'not-a-uuid' }).success).toBe(false);
  });

  it('rejects invalid datetime for expiresAt', () => {
    expect(CreateAllocationSchema.safeParse({ ...base, expiresAt: '31/12/2026' }).success).toBe(false);
  });

  it('rejects invalid renewalPeriod', () => {
    expect(CreateAllocationSchema.safeParse({ ...base, renewalPeriod: 'DAILY' }).success).toBe(false);
  });
});

describe('IncreaseAllocationAmountSchema', () => {
  it('accepts positive number', () => {
    expect(IncreaseAllocationAmountSchema.safeParse({ additionalAmount: 100 }).success).toBe(true);
  });

  it('rejects zero', () => {
    expect(IncreaseAllocationAmountSchema.safeParse({ additionalAmount: 0 }).success).toBe(false);
  });

  it('rejects negative', () => {
    expect(IncreaseAllocationAmountSchema.safeParse({ additionalAmount: -50 }).success).toBe(false);
  });

  it('rejects string value', () => {
    expect(IncreaseAllocationAmountSchema.safeParse({ additionalAmount: '100' }).success).toBe(false);
  });
});

describe('UpdateAllocationStatusSchema', () => {
  it('accepts ACTIVE', () => {
    expect(UpdateAllocationStatusSchema.safeParse({ status: 'ACTIVE' }).success).toBe(true);
  });

  it('accepts PAUSED', () => {
    expect(UpdateAllocationStatusSchema.safeParse({ status: 'PAUSED' }).success).toBe(true);
  });

  it('accepts EXPIRED', () => {
    expect(UpdateAllocationStatusSchema.safeParse({ status: 'EXPIRED' }).success).toBe(true);
  });

  it('rejects EXHAUSTED — set by engine only', () => {
    expect(UpdateAllocationStatusSchema.safeParse({ status: 'EXHAUSTED' }).success).toBe(false);
  });

  it('rejects unknown status', () => {
    expect(UpdateAllocationStatusSchema.safeParse({ status: 'DELETED' }).success).toBe(false);
  });
});
