import { PrismaClient } from '@prisma/client';
import { logger } from './logger.js';

// ── CLIENT ADMIN (postgres superuser — bypass RLS : auth, seeds, tests) ────────
export const prismaAdmin = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL } },
});

// ── CLIENT APPLICATIF (familypay_app — soumis au RLS) ─────────────────────────
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

export async function withTenant<T>(
  tenantId: string,
  fn: (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx): Promise<T> => {
    await tx.$executeRawUnsafe(`SELECT set_tenant_context($1)`, tenantId);
    return fn(tx);
  });
}

export async function setTenantContext(tenantId: string): Promise<void> {
  await prisma.$executeRawUnsafe(`SELECT set_tenant_context($1)`, tenantId);
}
