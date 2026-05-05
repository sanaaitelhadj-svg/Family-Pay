import { prisma } from '../lib/prisma.js';
import { FamilyPayError } from '../lib/errors.js';

export async function createLink(
  payerId: string,
  tenantId: string,
  beneficiaryId: string,
  relationship: string,
) {
  const beneficiary = await prisma.user.findFirst({
    where: { id: beneficiaryId, tenantId, role: 'BENEFICIARY', isActive: true },
  });
  if (!beneficiary) throw new FamilyPayError('USER_NOT_FOUND', 404, 'Bénéficiaire introuvable');

  const existing = await prisma.beneficiaryLink.findUnique({
    where: { payerId_beneficiaryId: { payerId, beneficiaryId } },
  });
  if (existing) {
    if (existing.isActive) throw new FamilyPayError('LINK_ALREADY_EXISTS', 409, 'Lien déjà actif');
    return prisma.beneficiaryLink.update({
      where: { id: existing.id },
      data: { isActive: true, relationship },
    });
  }

  return prisma.beneficiaryLink.create({
    data: { payerId, beneficiaryId, relationship, isActive: true },
  });
}

export async function listLinks(payerId: string) {
  return prisma.beneficiaryLink.findMany({
    where: { payerId, isActive: true },
    include: {
      beneficiary: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });
}

export async function removeLink(payerId: string, beneficiaryId: string) {
  const link = await prisma.beneficiaryLink.findFirst({
    where: { payerId, beneficiaryId, isActive: true },
  });
  if (!link) throw new FamilyPayError('LINK_NOT_FOUND', 404, 'Lien introuvable');
  return prisma.beneficiaryLink.update({
    where: { id: link.id },
    data: { isActive: false },
    select: { id: true, isActive: true },
  });
}
