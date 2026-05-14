import { describe, it, expect } from 'vitest';
import { RegisterMerchantSchema, AdminRejectSchema, AdminActivateSchema } from './merchant.schema.js';

const validRegister = {
  businessName: 'Pharmacie Al Amal',
  category: 'PHARMACY',
  address: '123 Boulevard Mohammed V',
  city: 'Casablanca',
  phone: '+212612345678',
  firstName: 'Karim',
  lastName: 'Benali',
  cndpConsent: true,
};

describe('RegisterMerchantSchema', () => {
  it('accepts valid data', () => {
    expect(() => RegisterMerchantSchema.parse(validRegister)).not.toThrow();
  });

  it('rejects invalid phone format', () => {
    expect(() =>
      RegisterMerchantSchema.parse({ ...validRegister, phone: '0612345678' }),
    ).toThrow();
  });

  it('rejects phone without +212 prefix', () => {
    expect(() =>
      RegisterMerchantSchema.parse({ ...validRegister, phone: '+33612345678' }),
    ).toThrow();
  });

  it('rejects businessName shorter than 2 chars', () => {
    expect(() =>
      RegisterMerchantSchema.parse({ ...validRegister, businessName: 'A' }),
    ).toThrow();
  });

  it('rejects address shorter than 5 chars', () => {
    expect(() =>
      RegisterMerchantSchema.parse({ ...validRegister, address: 'Rue' }),
    ).toThrow();
  });

  it('rejects invalid category', () => {
    expect(() =>
      RegisterMerchantSchema.parse({ ...validRegister, category: 'TRANSPORT' }),
    ).toThrow();
  });

  it('accepts all 6 valid categories', () => {
    const categories = ['PHARMACY', 'FOOD', 'CLOTHING', 'EDUCATION', 'LEISURE', 'GENERAL'];
    categories.forEach((category) => {
      expect(() =>
        RegisterMerchantSchema.parse({ ...validRegister, category }),
      ).not.toThrow();
    });
  });

  it('rejects when cndpConsent is missing', () => {
    const { cndpConsent: _c, ...withoutConsent } = validRegister;
    expect(() => RegisterMerchantSchema.parse(withoutConsent)).toThrow();
  });

  it('rejects when cndpConsent is false', () => {
    expect(() =>
      RegisterMerchantSchema.parse({ ...validRegister, cndpConsent: false }),
    ).toThrow();
  });
});

describe('AdminRejectSchema', () => {
  it('accepts valid reason', () => {
    expect(() => AdminRejectSchema.parse({ reason: 'Informations insuffisantes' })).not.toThrow();
  });

  it('rejects reason shorter than 5 chars', () => {
    expect(() => AdminRejectSchema.parse({ reason: 'Non' })).toThrow();
  });

  it('rejects missing reason', () => {
    expect(() => AdminRejectSchema.parse({})).toThrow();
  });
});

describe('AdminActivateSchema', () => {
  it('accepts valid pspMerchantReference', () => {
    expect(() =>
      AdminActivateSchema.parse({ pspMerchantReference: 'PSP-MERCHANT-001' }),
    ).not.toThrow();
  });

  it('rejects empty pspMerchantReference', () => {
    expect(() => AdminActivateSchema.parse({ pspMerchantReference: '' })).toThrow();
  });

  it('rejects missing pspMerchantReference', () => {
    expect(() => AdminActivateSchema.parse({})).toThrow();
  });
});
