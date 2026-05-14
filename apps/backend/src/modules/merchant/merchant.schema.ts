import { z } from 'zod';

const moroccanPhone = z
  .string()
  .regex(/^\+212[67][0-9]{8}$/, 'Numéro marocain invalide (+212XXXXXXXXX)');

export const RegisterMerchantSchema = z.object({
  businessName: z.string().min(2).max(100),
  category: z.enum(['PHARMACY', 'FOOD', 'CLOTHING', 'EDUCATION', 'LEISURE', 'GENERAL']),
  address: z.string().min(5).max(200),
  city: z.string().min(2).max(100),
  phone: moroccanPhone,
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  cndpConsent: z.literal(true, { errorMap: () => ({ message: 'Consentement CNDP obligatoire' }) }),
});

export const AdminRejectSchema = z.object({
  reason: z.string().min(5).max(500),
});

export const AdminActivateSchema = z.object({
  pspMerchantReference: z.string().min(1).max(100),
});

export type RegisterMerchantDto = z.infer<typeof RegisterMerchantSchema>;
export type AdminRejectDto = z.infer<typeof AdminRejectSchema>;
export type AdminActivateDto = z.infer<typeof AdminActivateSchema>;
