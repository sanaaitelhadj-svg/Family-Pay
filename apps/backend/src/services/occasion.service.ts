import { Decimal } from '@prisma/client/runtime/library';
import { withTenant } from '../lib/prisma.js';
import { FamilyPayError } from '../lib/errors.js';
import { notifyUser } from '../lib/notify.js';

export interface CreateOccasionInput {
  beneficiaryId: string;
  title: string;
  message?: string;
  targetAmount: number;
  activatesAt: Date;
  expiresAt: Date;
  restrictPartnerId?: string;
}

export async function createOccasion(creatorId: string, tenantId: string, input: CreateOccasionInput) {
  if (input.targetAmount <= 0) throw new FamilyPayError('VALIDATION_ERROR', 400, 'Montant cible invalide');
  if (input.expiresAt <= new Date()) throw new FamilyPayError('VALIDATION_ERROR', 400, 'Date d\'expiration invalide');
  if (input.activatesAt >= input.expiresAt) throw new FamilyPayError('VALIDATION_ERROR', 400, 'Date d\'activation incohérente');

  const occasion = await withTenant(tenantId, (tx) =>
    tx.occasion.create({
      data: {
        tenantId,
        creatorId,
        beneficiaryId: input.beneficiaryId,
        title: input.title,
        message: input.message,
        targetAmount: new Decimal(input.targetAmount),
        activatesAt: input.activatesAt,
        expiresAt: input.expiresAt,
        restrictPartnerId: input.restrictPartnerId,
      },
    }),
  );

  notifyUser(input.beneficiaryId, 'occasion:created', { occasionId: occasion.id, title: input.title });
  return occasion;
}

export async function listOccasions(tenantId: string, beneficiaryId?: string, activeOnly = true) {
  return withTenant(tenantId, (tx) =>
    tx.occasion.findMany({
      where: {
        ...(beneficiaryId ? { beneficiaryId } : {}),
        ...(activeOnly ? { isActive: true, expiresAt: { gte: new Date() } } : {}),
      },
      orderBy: { activatesAt: 'asc' },
    }),
  );
}

export async function getOccasion(id: string, tenantId: string) {
  const occasion = await withTenant(tenantId, (tx) => tx.occasion.findUnique({ where: { id } }));
  if (!occasion) throw new FamilyPayError('OCCASION_NOT_FOUND', 404, 'Occasion introuvable');
  return occasion;
}

export async function deactivateOccasion(id: string, creatorId: string, tenantId: string) {
  return withTenant(tenantId, async (tx) => {
    const occasion = await tx.occasion.findUnique({ where: { id } });
    if (!occasion) throw new FamilyPayError('OCCASION_NOT_FOUND', 404, 'Occasion introuvable');
    if (occasion.creatorId !== creatorId) throw new FamilyPayError('FORBIDDEN', 403, 'Non autorisé');
    return tx.occasion.update({ where: { id }, data: { isActive: false } });
  });
}
