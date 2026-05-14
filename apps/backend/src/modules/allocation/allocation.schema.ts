import { z } from 'zod';

export const CreateAllocationSchema = z.object({
  beneficiaryId: z.string().uuid('ID bénéficiaire invalide'),
  category: z.enum(['PHARMACY', 'FOOD', 'CLOTHING', 'EDUCATION', 'LEISURE', 'GENERAL']),
  limitAmount: z
    .number({ invalid_type_error: 'Le montant doit être un nombre' })
    .positive('Le montant doit être positif')
    .max(50000, 'Plafond maximum : 50 000 MAD'),
  expiresAt: z.string().datetime({ message: 'Date invalide (ISO 8601 requis)' }).optional(),
  renewalPeriod: z.enum(['MONTHLY', 'WEEKLY']).optional().nullable(),
});

export const IncreaseAllocationAmountSchema = z.object({
  additionalAmount: z
    .number({ invalid_type_error: 'Le montant doit être un nombre' })
    .positive('Le montant additionnel doit être strictement positif'),
});

export const UpdateAllocationStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'PAUSED', 'EXPIRED'], {
    errorMap: () => ({ message: 'Statut invalide. Valeurs acceptées : ACTIVE, PAUSED, EXPIRED' }),
  }),
});

export type CreateAllocationInput = z.infer<typeof CreateAllocationSchema>;
export type IncreaseAllocationAmountInput = z.infer<typeof IncreaseAllocationAmountSchema>;
export type UpdateAllocationStatusInput = z.infer<typeof UpdateAllocationStatusSchema>;
