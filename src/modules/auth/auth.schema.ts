import { z } from 'zod';

const moroccanPhone = z
  .string()
  .regex(/^\+212[67][0-9]{8}$/, 'Numéro marocain invalide (format: +212XXXXXXXXX)');

export const RegisterSponsorSchema = z.object({
  phone: moroccanPhone,
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50).optional(),
  email: z.string().email().optional(),
  cndpConsent: z.literal(true, {
    errorMap: () => ({ message: 'Le consentement CNDP est obligatoire' }),
  }),
});

export const RegisterBeneficiarySchema = z.object({
  invitationToken: z.string().uuid(),
  phone: moroccanPhone,
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50).optional(),
  isMinor: z.boolean().default(false),
  parentalConsent: z.boolean().optional(),
  cndpConsent: z.literal(true, {
    errorMap: () => ({ message: 'Le consentement CNDP est obligatoire' }),
  }),
}).refine(
  (data) => !data.isMinor || data.parentalConsent === true,
  { message: 'Le consentement parental est obligatoire pour un mineur', path: ['parentalConsent'] }
);

export const RegisterMerchantSchema = z.object({
  businessName: z.string().min(2).max(100),
  category: z.enum(['PHARMACY', 'FOOD', 'CLOTHING', 'EDUCATION', 'LEISURE', 'GENERAL']),
  address: z.string().min(5).max(200),
  city: z.string().min(2).max(50),
  phone: moroccanPhone,
  cndpConsent: z.literal(true, {
    errorMap: () => ({ message: 'Le consentement CNDP est obligatoire' }),
  }),
});

export const RequestOtpSchema = z.object({
  phone: moroccanPhone,
  purpose: z.enum(['SIGNUP', 'LOGIN']),
});

export const VerifyOtpSchema = z.object({
  phone: moroccanPhone,
  code: z.string().length(6, 'Le code OTP doit avoir 6 chiffres'),
  purpose: z.enum(['SIGNUP', 'LOGIN']),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export type RegisterSponsorInput = z.infer<typeof RegisterSponsorSchema>;
export type RegisterBeneficiaryInput = z.infer<typeof RegisterBeneficiarySchema>;
export type RegisterMerchantInput = z.infer<typeof RegisterMerchantSchema>;
export type RequestOtpInput = z.infer<typeof RequestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof VerifyOtpSchema>;
