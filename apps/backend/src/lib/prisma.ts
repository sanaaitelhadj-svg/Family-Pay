import { PrismaClient } from '@prisma/client';
import { logger } from './logger.js';

// ── CLIENT ADMIN (sans RLS — migrations, seeds, tests isolation) ──────────────
export const prismaAdmin = new PrismaClient();

// ── CLIENT PAR DÉFAUT ─────────────────────────────────────────────────────────
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? [{ emit: 'event', level: 'query' }]
    : [{ emit: 'stdout', level: 'error' }],
});

if (process.env.NODE_ENV === 'development') {
  (prisma as any).$on('query', (e: any) => {
    if (e.duration > 100) {
      logger.warn(`Slow query (${e.duration}ms): ${e.query}`);
    }
  });
}

// ── HELPER — Toute opération financière doit passer par withTenant() ──────────
// Injecte SET LOCAL app.tenant_id ce qui active les politiques RLS.
export async function withTenant<T>(
  tenantId: string,
  fn: (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT set_tenant_context($1)`, tenantId);
    return fn(tx);
  });
}

// ── HELPER — Contexte tenant sans transaction wrapping (lecture seule) ─────────
export async function setTenantContext(tenantId: string): Promise<void> {
  await prisma.$executeRawUnsafe(`SELECT set_tenant_context($1)`, tenantId);
}
