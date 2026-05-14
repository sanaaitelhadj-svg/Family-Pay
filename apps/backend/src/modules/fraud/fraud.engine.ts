import { prisma } from '../../lib/prisma.js';

export interface FraudScore {
  score: number;
  signals: string[];
}

export class FraudEngine {
  static async score(beneficiaryId: string, amount: number): Promise<FraudScore> {
    const signals: string[] = [];
    let score = 0;

    // Signal 1 — Velocity : > 5 tx dans la dernière heure
    const hourlyCount = await prisma.authorization.count({
      where: {
        beneficiaryId,
        createdAt: { gt: new Date(Date.now() - 3_600_000) },
      },
    });
    if (hourlyCount >= 5) {
      score += 40;
      signals.push('VELOCITY_HIGH');
    }

    // Signal 2 — Montant rond répété : multiple de 100, même montant >= 3x en 24h
    if (amount % 100 === 0) {
      const repeatCount = await prisma.authorization.count({
        where: {
          beneficiaryId,
          amount,
          status: 'APPROVED',
          createdAt: { gt: new Date(Date.now() - 86_400_000) },
        },
      });
      if (repeatCount >= 3) {
        score += 20;
        signals.push('ROUND_AMOUNT_REPEAT');
      }
    }

    return { score: Math.min(score, 100), signals };
  }
}
