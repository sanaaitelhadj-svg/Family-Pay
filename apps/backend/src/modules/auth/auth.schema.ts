import { z } from 'zod';

const moroccanPhone = z
  .string()
  .regex(/^(\+212|00212|0)[67][0-9]{8}$/, 'Numéro marocain invalide (+212 6XXXXXXXX)');

/* ═══════════════════ SPONSOR ═══════════════════ */
export const RegisterSponsorSchema = z.object({
  phone:      moroccanPhone,
  firstName:  z.string().min(2).max(50),
  lastName:   z.string().min(2).max(50).optional(),
  email:      z.string().email().optional(),
  cndpConsent: z.literal(true, {
    errorMap: () => ({ message: 'Le consentement CNDP est obligatoire' }),
  }),
});

/* ═══════════════════ BENEFICIARY ═══════════════════ */
export const RegisterBeneficiarySchema = z.object({
  phone:           moroccanPhone,
  firstName:       z.string().min(2).max(50),
  lastName:        z.string().min(2).max(50).optional(),
  dateOfBirth:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: AAAA-MM-JJ'),
  // Optionnel pour adultes, obligatoire pour mineurs (validé dans le service)
  invitationToken: z.string().uuid().optional(),
  parentalConsent: z.boolean().optional(),
  relationship:    z.string().max(50).optional(),
  cndpConsent: z.literal(true, {
    errorMap: () => ({ message: 'Le consentement CNDP est obligatoire' }),
  }),
});

/* ═══════════════════ MERCHANT ═══════════════════ */
export const RegisterMerchantSchema = z.object({
  // Infos de base
  businessName: z.string().min(2).max(100),
  category:     z.enum(['PHARMACY', 'FOOD', 'CLOTHING', 'EDUCATION', 'LEISURE', 'GENERAL']),
  address:      z.string().min(5).max(200),
  city:         z.string().min(2).max(50),
  phone:        moroccanPhone,
  email:        z.string().email().optional(),
  // Légal — obligatoire pour KYC
  registrationNumber: z.string().min(2).max(50),
  iceNumber:          z.string().min(5).max(20),
  taxId:              z.string().min(5).max(20).optional(),
  fiscalId:           z.string().min(2).max(50).optional(),
  cinRepresentant:    z.string().min(5).max(20),
  // Bancaire — obligatoire
  rib: z.string().min(10).max(30),
  // Contacts — obligatoire
  contactAdmin:   z.object({ nom: z.string(), phone: z.string(), email: z.string().email().optional() }),
  contactFinance: z.object({ nom: z.string(), phone: z.string(), email: z.string().email().optional() }),
  contactOps:     z.object({ nom: z.string(), phone: z.string(), email: z.string().email().optional() }).optional(),
  contactLegal:   z.object({ nom: z.string(), phone: z.string(), email: z.string().email().optional() }).optional(),
  // Physique — obligatoire
  gpsLat: z.number().min(-90).max(90),
  gpsLng: z.number().min(-180).max(180),
  photos: z.array(z.string().url()).min(1).max(10),
  // Horaires
  businessHours: z.record(
    z.string(),
    z.object({ open: z.string(), close: z.string(), closed: z.boolean().optional() })
  ).optional(),
  // CNDP
  cndpConsent: z.literal(true, {
    errorMap: () => ({ message: 'Le consentement CNDP est obligatoire' }),
  }),
});

/* ═══════════════════ AUTH ═══════════════════ */
export const RequestOtpSchema = z.object({
  phone:   moroccanPhone,
  purpose: z.enum(['SIGNUP', 'LOGIN']),
});

export const VerifyOtpSchema = z.object({
  phone:   moroccanPhone,
  code:    z.string().length(6, 'Le code OTP doit avoir 6 chiffres'),
  purpose: z.enum(['SIGNUP', 'LOGIN']),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

/* ═══════════════════ CARD ═══════════════════ */
export const AddCardSchema = z.object({
  maskedCardReference:  z.string().min(4).max(20),   // ex: **** **** **** 4242
  pspCustomerReference: z.string().min(4).max(100),  // ref PSP
});

export type RegisterSponsorInput     = z.infer<typeof RegisterSponsorSchema>;
export type RegisterBeneficiaryInput = z.infer<typeof RegisterBeneficiarySchema>;
export type RegisterMerchantInput    = z.infer<typeof RegisterMerchantSchema>;
export type RequestOtpInput          = z.infer<typeof RequestOtpSchema>;
export type VerifyOtpInput           = z.infer<typeof VerifyOtpSchema>;
export type AddCardInput             = z.infer<typeof AddCardSchema>;
