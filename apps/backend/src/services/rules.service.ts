import { FamilyPayError } from '../lib/errors.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function canProcess(tx: any, envelopeId: string, amount: number, partnerId: string | null): Promise<void> {
  const envelope = await tx.envelope.findUnique({
    where: { id: envelopeId },
    include: { rules: { where: { isActive: true } } },
  });

  if (!envelope) throw new FamilyPayError('ENVELOPE_NOT_FOUND', 404, 'Enveloppe introuvable');
  if (!envelope.isActive) throw new FamilyPayError('ENVELOPE_INACTIVE', 400, 'Enveloppe désactivée');

  // Restriction partenaire (liste blanche)
  if (envelope.allowedPartnerIds.length > 0 && partnerId) {
    if (!envelope.allowedPartnerIds.includes(partnerId)) {
      throw new FamilyPayError('PARTNER_NOT_ALLOWED', 403, 'Partenaire non autorisé pour cette enveloppe');
    }
  }

  // Plafond par transaction
  if (envelope.maxPerTransaction !== null && amount > Number(envelope.maxPerTransaction)) {
    throw new FamilyPayError('AMOUNT_EXCEEDS_LIMIT', 400, `Montant max par transaction : ${envelope.maxPerTransaction} MAD`);
  }

  const now = new Date();

  for (const rule of envelope.rules) {
    const cond = rule.conditions as Record<string, unknown>;

    if (rule.type === 'TIME') {
      const hour = now.getHours();
      const startHour = cond['start_hour'] as number | undefined;
      const endHour = cond['end_hour'] as number | undefined;
      if (startHour !== undefined && endHour !== undefined && (hour < startHour || hour >= endHour)) {
        throw new FamilyPayError('OUT_OF_HOURS', 403, `Paiement autorisé entre ${startHour}h et ${endHour}h uniquement`);
      }
    }

    if (rule.type === 'DAY') {
      const allowedDays = cond['allowed_days'] as number[] | undefined;
      if (allowedDays && !allowedDays.includes(now.getDay())) {
        throw new FamilyPayError('RULE_VIOLATED', 403, 'Paiement non autorisé ce jour');
      }
    }

    if (rule.type === 'DAILY_LIMIT') {
      const dailyMax = cond['daily_max'] as number | undefined;
      if (dailyMax !== undefined) {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const agg = await tx.transaction.aggregate({
          where: { envelopeId, type: 'PAYMENT', status: 'COMPLETED', createdAt: { gte: startOfDay } },
          _sum: { amount: true },
        });
        if (Number(agg._sum.amount ?? 0) + amount > dailyMax) {
          throw new FamilyPayError('DAILY_LIMIT_REACHED', 403, `Plafond journalier de ${dailyMax} MAD atteint`);
        }
      }
    }
  }
}
