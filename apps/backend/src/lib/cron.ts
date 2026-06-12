import cron from 'node-cron';
import { prisma } from './prisma.js';
import { logger } from './logger.js';

const addPeriod = (date: Date, period: string): Date => {
  const d = new Date(date);
  switch (period) {
    case 'DAILY':     d.setDate(d.getDate() + 1);        break;
    case 'WEEKLY':    d.setDate(d.getDate() + 7);        break;
    case 'MONTHLY':   d.setMonth(d.getMonth() + 1);      break;
    case 'QUARTERLY': d.setMonth(d.getMonth() + 3);      break;
    case 'ANNUAL':    d.setFullYear(d.getFullYear() + 1); break;
  }
  return d;
};

export async function runAllocationRenewal() {
  logger.info('⏰ Cron: vérification renouvellement allocations...');

  const now = new Date();

  // Allocations expirées avec renewalPeriod défini
  const expired = await prisma.allocation.findMany({
    where: {
      renewalPeriod: { not: null },
      expiresAt:     { lte: now },
      status:        { in: ['ACTIVE', 'PAUSED', 'EXHAUSTED'] },
    },
    include: {
      beneficiary: { include: { user: true } },
    },
  });

  if (expired.length === 0) {
    logger.info('✅ Cron: aucune allocation à renouveler');
    return;
  }

  logger.info(`⏰ Cron: ${expired.length} allocation(s) à renouveler`);

  for (const alloc of expired) {
    try {
      const newExpiresAt = addPeriod(alloc.expiresAt!, alloc.renewalPeriod!);
      const benefName = `${alloc.beneficiary.user.firstName} ${alloc.beneficiary.user.lastName}`.trim();

      await prisma.allocation.update({
        where: { id: alloc.id },
        data: {
          remainingAmount: alloc.limitAmount,
          expiresAt:       newExpiresAt,
          status:          'ACTIVE',
        },
      });

      // Notification admin/sponsor
      await prisma.adminNotification.create({
        data: {
          type:     'ALLOCATION_RENEWED',
          title:    '🔄 Allocation renouvelée',
          body:     `Allocation ${alloc.category} de ${benefName} renouvelée — ${Number(alloc.limitAmount)} MAD remis à disposition (période: ${alloc.renewalPeriod})`,
          entityId: alloc.id,
        },
      });

      logger.info(`✅ Cron: allocation ${alloc.id} renouvelée → expire le ${newExpiresAt.toISOString()}`);
    } catch (err) {
      logger.error(`❌ Cron: erreur renouvellement allocation ${alloc.id}`, err);
    }
  }
}

export function startCronJobs() {
  // Vérification toutes les heures (chaque début d'heure)
  cron.schedule('0 * * * *', async () => {
    await runAllocationRenewal();
  });

  // Vérification au démarrage immédiat
  runAllocationRenewal().catch(err => logger.error('Cron startup error', err));

  logger.info('⏰ Cron jobs démarrés (renouvellement allocations toutes les heures)');
}
