/**
 * Script de création du compte Super Admin en production
 * Usage : npx tsx scripts/create-admin.ts
 * Nécessite DATABASE_URL et DATABASE_ADMIN_URL dans l'environnement
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

const TENANT_ID  = '00000000-0000-0000-0000-000000000001';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL    ?? 'admin@altivax.com';
const ADMIN_PASS  = process.env.ADMIN_PASSWORD ?? 'Altivax2026!';

async function main() {
  console.log(`🔐 Création du compte admin : ${ADMIN_EMAIL}`);

  const existing = await db.user.findFirst({ where: { email: ADMIN_EMAIL } });
  if (existing) {
    console.log('⚠️  Compte admin déjà existant — mise à jour du mot de passe');
    await db.user.update({
      where: { id: existing.id },
      data: { passwordHash: await bcrypt.hash(ADMIN_PASS, 12), role: 'ADMIN', isActive: true },
    });
    console.log(`✅ Mot de passe mis à jour pour ${ADMIN_EMAIL}`);
    return;
  }

  const hash = await bcrypt.hash(ADMIN_PASS, 12);
  const user = await db.user.create({
    data: {
      tenantId: TENANT_ID,
      email: ADMIN_EMAIL,
      passwordHash: hash,
      role: 'ADMIN',
      firstName: 'Super',
      lastName: 'Admin',
      kycStatus: 'VERIFIED',
      isActive: true,
    },
  });

  await db.wallet.create({
    data: { tenantId: TENANT_ID, userId: user.id, balance: 0, currency: 'MAD' },
  });

  console.log('✅ Compte admin créé avec succès !');
  console.log(`   Email    : ${ADMIN_EMAIL}`);
  console.log(`   Password : ${ADMIN_PASS}`);
  console.log('   ⚠️  Changez le mot de passe après la première connexion !');
}

main()
  .catch(e => { console.error('❌ Erreur :', e.message); process.exit(1); })
  .finally(() => db.$disconnect());
