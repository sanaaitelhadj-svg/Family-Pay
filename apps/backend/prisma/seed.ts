/**
 * Seed de développement — ALTIVAX FamilyPay
 * Crée des données réalistes pour tester les 3 apps en local
 * Usage : npx tsx prisma/seed.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

async function main() {
  console.log('🌱 Seed FamilyPay démarré...');

  // ── TENANT DEMO ────────────────────────────────────────────────────────────
  const tenant = await db.tenant.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'ALTIVAX Demo',
      plan: 'PREMIUM',
    },
  });
  console.log(`✅ Tenant : ${tenant.name}`);

  const hash = await bcrypt.hash('Demo1234!', 12);

  // ── PAYEUR ─────────────────────────────────────────────────────────────────
  const payerUser = await db.user.upsert({
    where: { email: 'papa@demo.familypay' },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'papa@demo.familypay',
      phone: '+212600000001',
      passwordHash: hash,
      role: 'PAYER',
      firstName: 'Karim',
      lastName: 'Benjelloun',
      kycStatus: 'VERIFIED',
    },
  });

  const payerWallet = await db.wallet.upsert({
    where: { userId: payerUser.id },
    update: {},
    create: {
      tenantId: tenant.id,
      userId: payerUser.id,
      balance: 5000,
      currency: 'MAD',
    },
  });
  console.log(`✅ Payeur : ${payerUser.firstName} — Wallet : ${payerWallet.balance} MAD`);

  // ── BÉNÉFICIAIRE ───────────────────────────────────────────────────────────
  const benUser = await db.user.upsert({
    where: { email: 'adam@demo.familypay' },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'adam@demo.familypay',
      passwordHash: hash,
      role: 'BENEFICIARY',
      firstName: 'Adam',
      lastName: 'Benjelloun',
      isMinor: true,
      kycStatus: 'VERIFIED',
    },
  });

  const benWallet = await db.wallet.upsert({
    where: { userId: benUser.id },
    update: {},
    create: {
      tenantId: tenant.id,
      userId: benUser.id,
      balance: 0,
      currency: 'MAD',
    },
  });

  // Lien payeur ↔ bénéficiaire
  await db.beneficiaryLink.upsert({
    where: { payerId_beneficiaryId: { payerId: payerUser.id, beneficiaryId: benUser.id } },
    update: {},
    create: {
      payerId: payerUser.id,
      beneficiaryId: benUser.id,
      relationship: 'enfant',
    },
  });
  console.log(`✅ Bénéficiaire : ${benUser.firstName} — lié à ${payerUser.firstName}`);

  // ── ENVELOPPES ─────────────────────────────────────────────────────────────
  const envelopeData = [
    { id: '00000000-0000-0000-0001-000000000001', category: 'FOOD' as const,      label: 'Nourriture',  balance: 500, maxPerTx: 200 },
    { id: '00000000-0000-0000-0002-000000000001', category: 'HEALTH' as const,    label: 'Santé',       balance: 300, maxPerTx: 300 },
    { id: '00000000-0000-0000-0003-000000000001', category: 'EDUCATION' as const, label: 'Éducation',   balance: 400, maxPerTx: 400 },
    { id: '00000000-0000-0000-0004-000000000001', category: 'LEISURE' as const,   label: 'Loisirs',     balance: 150, maxPerTx: 100 },
    { id: '00000000-0000-0000-0005-000000000001', category: 'CLOTHES' as const,   label: 'Vêtements',   balance: 200, maxPerTx: 200 },
    { id: '00000000-0000-0000-0006-000000000001', category: 'GENERAL' as const,   label: 'Général',     balance: 100, maxPerTx: 100 },
  ];

  for (const e of envelopeData) {
    await db.envelope.upsert({
      where: { id: e.id },
      update: {},
      create: {
        id: e.id,
        tenantId: tenant.id,
        walletId: benWallet.id,
        category: e.category,
        label: e.label,
        balance: e.balance,
        maxPerTransaction: e.maxPerTx,
      },
    });
  }
  console.log(`✅ ${envelopeData.length} enveloppes créées`);

  // ── PARTENAIRE ─────────────────────────────────────────────────────────────
  const partnerUser = await db.user.upsert({
    where: { email: 'mcdo-casa@demo.familypay' },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'mcdo-casa@demo.familypay',
      passwordHash: hash,
      role: 'PARTNER',
      firstName: 'Manager',
      lastName: 'McDonald\'s Casa',
      kycStatus: 'VERIFIED',
    },
  });

  const partnerWallet = await db.wallet.upsert({
    where: { userId: partnerUser.id },
    update: {},
    create: {
      tenantId: tenant.id,
      userId: partnerUser.id,
      balance: 0,
      currency: 'MAD',
    },
  });

  await db.partner.upsert({
    where: { userId: partnerUser.id },
    update: {},
    create: {
      tenantId: tenant.id,
      userId: partnerUser.id,
      walletId: partnerWallet.id,
      businessName: "McDonald's Casablanca Centre",
      category: 'restaurant',
      isVerified: true,
      isPremium: false,
      city: 'Casablanca',
      address: 'Boulevard Mohammed V, Casablanca',
    },
  });
  console.log(`✅ Partenaire : McDonald's Casablanca`);

  // ── SUPER ADMIN ────────────────────────────────────────────────────────────
  const adminUser = await db.user.upsert({
    where: { email: 'admin@altivax.com' },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'admin@altivax.com',
      phone: '+212600000099',
      passwordHash: hash,
      role: 'ADMIN',
      firstName: 'Super',
      lastName: 'Admin',
      kycStatus: 'VERIFIED',
    },
  });
  await db.wallet.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: { tenantId: tenant.id, userId: adminUser.id, balance: 0, currency: 'MAD' },
  });
  console.log(`✅ Admin : ${adminUser.email}`);

  // ── TRANSACTION DE DÉMO ────────────────────────────────────────────────────
  await db.transaction.create({
    data: {
      tenantId: tenant.id,
      fromWalletId: benWallet.id,
      toWalletId: partnerWallet.id,
      amount: 85,
      type: 'PAYMENT',
      status: 'COMPLETED',
      metadata: { description: 'Repas Big Mac + frites', demo: true },
    },
  });
  console.log('✅ Transaction démo créée');

  console.log('\n🎉 Seed terminé !');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Payeur    : papa@demo.familypay  / Demo1234!');
  console.log('  Bénéf.    : adam@demo.familypay  / Demo1234!');
  console.log('  Partenaire: mcdo-casa@demo.familypay / Demo1234!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .catch((e) => { console.error('❌ Seed échoué :', e); process.exit(1); })
  .finally(() => db.$disconnect());
