import { describe, it, expect } from 'vitest';
import {
  RegisterSponsorSchema,
  RegisterBeneficiarySchema,
  RegisterMerchantSchema,
  VerifyOtpSchema,
} from './auth.schema.js';

describe('moroccanPhone', () => {
  const validPhones = ['+212612345678', '+212712345678', '+212699999999'];
  const invalidPhones = ['0612345678', '+33612345678', '+212512345678', '+2126123456'];

  validPhones.forEach((phone) => {
    it(`accepts ${phone}`, () => {
      expect(RegisterSponsorSchema.safeParse({ phone, firstName: 'Ahmed', cndpConsent: true }).success).toBe(true);
    });
  });

  invalidPhones.forEach((phone) => {
    it(`rejects ${phone}`, () => {
      expect(RegisterSponsorSchema.safeParse({ phone, firstName: 'Ahmed', cndpConsent: true }).success).toBe(false);
    });
  });
});

describe('RegisterSponsorSchema', () => {
  const base = { phone: '+212612345678', firstName: 'Ahmed', cndpConsent: true as const };

  it('accepts minimal valid input', () => {
    expect(RegisterSponsorSchema.safeParse(base).success).toBe(true);
  });

  it('accepts with optional fields', () => {
    expect(RegisterSponsorSchema.safeParse({
      ...base, lastName: 'Benali', email: 'ahmed@example.com',
    }).success).toBe(true);
  });

  it('rejects missing cndpConsent', () => {
    const result = RegisterSponsorSchema.safeParse({ phone: base.phone, firstName: base.firstName });
    expect(result.success).toBe(false);
  });

  it('rejects cndpConsent = false', () => {
    const result = RegisterSponsorSchema.safeParse({ ...base, cndpConsent: false });
    expect(result.success).toBe(false);
  });

  it('rejects firstName too short', () => {
    const result = RegisterSponsorSchema.safeParse({ ...base, firstName: 'A' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const result = RegisterSponsorSchema.safeParse({ ...base, email: 'not-an-email' });
    expect(result.success).toBe(false);
  });
});

describe('RegisterBeneficiarySchema', () => {
  const base = {
    invitationToken: '123e4567-e89b-12d3-a456-426614174000',
    phone: '+212612345678',
    firstName: 'Sara',
    isMinor: false,
    cndpConsent: true as const,
  };

  it('accepts adult beneficiary without parental consent', () => {
    expect(RegisterBeneficiarySchema.safeParse(base).success).toBe(true);
  });

  it('accepts minor with parental consent', () => {
    expect(RegisterBeneficiarySchema.safeParse({
      ...base, isMinor: true, parentalConsent: true,
    }).success).toBe(true);
  });

  it('rejects minor without parental consent', () => {
    const result = RegisterBeneficiarySchema.safeParse({ ...base, isMinor: true });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('parentalConsent');
    }
  });

  it('rejects minor with parentalConsent = false', () => {
    const result = RegisterBeneficiarySchema.safeParse({
      ...base, isMinor: true, parentalConsent: false,
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-UUID invitation token', () => {
    const result = RegisterBeneficiarySchema.safeParse({ ...base, invitationToken: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('rejects missing cndpConsent', () => {
    const { cndpConsent: _, ...withoutConsent } = base;
    expect(RegisterBeneficiarySchema.safeParse(withoutConsent).success).toBe(false);
  });
});

describe('RegisterMerchantSchema', () => {
  const base = {
    businessName: 'Pharmacie Centrale',
    category: 'PHARMACY' as const,
    address: '12 Rue Hassan II',
    city: 'Casablanca',
    phone: '+212612345678',
    cndpConsent: true as const,
  };

  it('accepts valid merchant', () => {
    expect(RegisterMerchantSchema.safeParse(base).success).toBe(true);
  });

  it('accepts all category values', () => {
    const categories = ['PHARMACY', 'FOOD', 'CLOTHING', 'EDUCATION', 'LEISURE', 'GENERAL'] as const;
    categories.forEach((category) => {
      expect(RegisterMerchantSchema.safeParse({ ...base, category }).success).toBe(true);
    });
  });

  it('rejects unknown category', () => {
    const result = RegisterMerchantSchema.safeParse({ ...base, category: 'UNKNOWN' });
    expect(result.success).toBe(false);
  });

  it('rejects missing cndpConsent', () => {
    const { cndpConsent: _, ...withoutConsent } = base;
    expect(RegisterMerchantSchema.safeParse(withoutConsent).success).toBe(false);
  });
});

describe('VerifyOtpSchema', () => {
  it('accepts valid OTP input', () => {
    expect(VerifyOtpSchema.safeParse({
      phone: '+212612345678', code: '123456', purpose: 'SIGNUP',
    }).success).toBe(true);
  });

  it('rejects OTP code shorter than 6 digits', () => {
    expect(VerifyOtpSchema.safeParse({
      phone: '+212612345678', code: '12345', purpose: 'SIGNUP',
    }).success).toBe(false);
  });

  it('rejects OTP code longer than 6 digits', () => {
    expect(VerifyOtpSchema.safeParse({
      phone: '+212612345678', code: '1234567', purpose: 'SIGNUP',
    }).success).toBe(false);
  });

  it('rejects invalid purpose', () => {
    expect(VerifyOtpSchema.safeParse({
      phone: '+212612345678', code: '123456', purpose: 'RESET',
    }).success).toBe(false);
  });
});
