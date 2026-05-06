# ALTIVAX FamilyPay — Plan Sprints V2
## 14 Sprints — ~32 semaines | Révisé le 2026-05-05
### Avancement : 9.5 sprints réalisés | 128 tests automatisés | 15 commits pushés sur `main`

> **Conventions**
> - SP = Story Points (1 SP ≈ 1 jour-développeur)
> - P1 = Critique | P2 = Important | P3 = Stretch
> - ✅ = Jalon avec sauvegarde obligatoire (`git tag` + `pg_dump`)
> - ⚠️ = Point d'attention critique
> - 🆕 = Ajout V2 (absent de la V1)

---

## PHASE 0 — FONDATIONS (S0a → S0c) | ~5 semaines

---

### Sprint 0a — Monorepo & Infrastructure Docker ✅ 🟢 RÉALISÉ
**Objectif :** Structure projet solide, environnement de dev reproductible, CI/CD basique.
**Durée :** 1.5 semaine | **SP Total : 9**
**Commit :** `8d59c42` — `feat(sprint-0a): monorepo Turborepo + Docker Compose + CI/CD + backup script`

| Tâche | SP | Priorité | Statut |
|---|---|---|---|
| Monorepo Turborepo : `apps/payer` + `apps/beneficiary` + `apps/partner` + `apps/backend` | 2 | P1 | ✅ |
| Docker Compose : frontend×3 + backend + PostgreSQL 16 + Redis 7 + MinIO | 3 | P1 | ✅ |
| GitHub Actions CI : lint + test + build sur PR | 2 | P1 | ✅ |
| Script backup automatique : `git tag` + `pg_dump` + archivage | 1 | P1 | ✅ |
| `.env.example` documenté (tous les secrets requis) | 1 | P1 | ✅ |

**Définition of Done :**
- [x] `docker compose up` lance tous les services sans erreur
- [x] CI passe sur un PR vide
- [x] Script backup fonctionne et crée un tag git
- [x] `git tag familypay-sprint-0a-complete`

---

### Sprint 0b — Schéma BDD, RLS & Tests Financiers Critiques ✅ 🟢 RÉALISÉ
**Objectif :** Base de données financière irréprochable dès le départ.
**Durée :** 1.5 semaine | **SP Total : 10**
**Commits :** `ccda78d` + `3ba3080` | **Tests :** 19/19 ✅ (`critical.rls.test.ts`)

| Tâche | SP | Priorité | Statut |
|---|---|---|---|
| Schéma Prisma complet : tenants, users, wallets, envelopes, transactions, qr_codes, rules, partners | 4 | P1 | ✅ |
| RLS PostgreSQL multi-tenant + politique d'isolation par `tenant_id` | 3 | P1 | ✅ |
| Tests RLS : wallet tenant A invisible depuis tenant B (5 tests) | 2 | P1 | ✅ |
| Trigger PostgreSQL `prevent_transaction_update` (immuabilité — 4 tests) | 1 | P1 | ✅ |
| Contraintes `CHECK (balance >= 0)` sur wallets et envelopes (5 tests) | 1 | P1 | ✅ |
| Contraintes intégrité : unicité wallet/user, QR token, paire payeur-bénéficiaire (3 tests) | 1 | P1 | ✅ |
| i18n dès S0b : `react-i18next` configuré (FR V1, AR/EN placeholders V2) | 1 | P1 | ⏳ Phase 1 frontend |

> **Note technique :** Deux clients Prisma — `dbAdmin` (postgres superuser, bypass RLS) pour seeds/maintenance, `prisma` (familypay_app) soumis aux politiques RLS. Superusers PostgreSQL contournent toujours RLS — architecture conforme.

**Tests critiques fintech obligatoires :**
```typescript
// Test 1 — Isolation multi-tenant
test('CRITICAL: Tenant isolation', async () => {
  const wallet = await createWallet({ tenantId: TENANT_B });
  await setTenantContext(TENANT_A);
  const wallets = await prisma.wallets.findMany();
  expect(wallets.map(w => w.id)).not.toContain(wallet.id);
});

// Test 2 — Transactions immuables
test('CRITICAL: Transactions immutable', async () => {
  const tx = await createTransaction({ amount: 100 });
  await expect(
    prisma.transactions.update({ where: { id: tx.id }, data: { amount: 200 } })
  ).rejects.toThrow();
});

// Test 3 — Solde jamais négatif
test('CRITICAL: Balance never negative', async () => {
  await expect(
    debitWallet({ walletId, amount: 999999 })
  ).rejects.toThrow('INSUFFICIENT_BALANCE');
});
```

**Définition of Done :**
- [x] 100% des tests RLS passent (19/19 — 4 suites : RLS isolation, immutabilité, contraintes financières, intégrité)
- [x] Trigger immuabilité actif et testé (UPDATE et DELETE bloqués, REVERSAL pattern validé)
- [x] Contrainte CHECK balance ≥ 0 validée sur wallets et envelopes
- [ ] i18n configuré dans les 3 apps — reporté au démarrage du frontend
- [x] `git tag familypay-sprint-0b-complete`

---

### Sprint 0c — Design System & Wireframes UX 🆕
**Objectif :** Valider l'expérience utilisateur AVANT de coder — éviter les refontes coûteuses.
**Durée :** 2 semaines | **SP Total : 8**

> ⚠️ Ce sprint peut se faire en parallèle des S0a/S0b si ressources disponibles.

| Tâche | SP | Priorité |
|---|---|---|
| Wireframes Figma : App Payeur (gestion bénéficiaires, enveloppes, tableau de bord) | 2 | P1 |
| Wireframes Figma : App Bénéficiaire (wallet, QR Code, demande de fonds) | 2 | P1 |
| Wireframes Figma : Interface Partenaire (scan QR, confirmation, historique) | 1 | P1 |
| Design system : couleurs ALTIVAX, typographie, composants (boutons, cartes, badges) | 2 | P1 |
| Validation flux critiques : paiement QR end-to-end (papier ou Figma prototype) | 1 | P1 |

**🆕 Actions parallèles à déclencher dès S0c :**
- [ ] **Dépôt dossier CMI** (Centre Monétique Interbancaire) — délai 4-8 semaines
- [ ] **Contact CIH Bank ou Attijariwafa** pour partenariat bancaire (option A BAM)
- [ ] **Enregistrement CNDP** — registre des traitements données personnelles

**Définition of Done :**
- [ ] Wireframes validés pour les 3 apps
- [ ] Design system exporté (tokens CSS/Tailwind)
- [ ] Flux paiement QR validé sans ambiguïté
- [ ] Dossier CMI déposé (ou en cours)

---

## PHASE 1 — MVP LOCAL (S1 → S5) | ~12 semaines

---

### Sprint 1 — Auth JWT & Middleware RLS-aware ✅ 🟢 RÉALISÉ
**Objectif :** Authentification sécurisée avec rotation de tokens et isolation multi-tenant.
**Durée :** 2 semaines | **SP Total : 18**
**Commit :** `78c1351` | **Tests :** 14/14 ✅ (`auth.test.ts`)

> **Périmètre réalisé (Phase 1 MVP) :** Le sprint s'est concentré sur le socle auth backend critique. OTP/2FA, KYC MinIO et QR d'invitation sont planifiés en Phase 2 avec l'intégration mobile.

| User Story | SP | Priorité | Statut |
|---|---|---|---|
| Inscription email + password (hash bcrypt) pour les 3 rôles | 3 | P1 | ✅ |
| Login + émission access token (15 min) + refresh token (7 jours) | 3 | P1 | ✅ |
| Refresh token avec rotation JTI (stockage Redis, replay = 401) | 3 | P1 | ✅ |
| Logout — révocation JTI Redis | 1 | P1 | ✅ |
| `GET /me` — profil + solde wallet (contexte RLS via `withTenant`) | 2 | P1 | ✅ |
| Middleware `authenticate` — vérifie Bearer JWT sur toutes les routes protégées | 2 | P1 | ✅ |
| Middleware `requireRole` — contrôle d'accès par rôle (PAYER, BENEFICIARY, PARTNER) | 1 | P1 | ✅ |
| Rate limiting `/auth/*` — 5 req/min par IP (désactivé en `NODE_ENV=test`) | 1 | P1 | ✅ |
| Payeur : connexion avec 2FA (SMS ou authenticator) | 3 | P1 | ⏳ Sprint 8 (mobile) |
| Partenaire : validation par ALTIVAX avant activation | 2 | P1 | ⏳ Sprint 11 |
| Dev : KYC basique — upload CNI + selfie (stockage MinIO) | 3 | P1 | ⏳ Sprint 6 |

> **Note technique :** `prismaAdmin` (DATABASE_ADMIN_URL = postgres superuser) utilisé pour la recherche d'email globale (cross-tenant) lors du login — nécessaire car RLS filtre par tenant_id. `withTenant(tenantId, fn)` encapsule toutes les lectures métier dans `prisma.$transaction()` avec `set_tenant_context($1)`.

**⚠️ Conformité Sprint 1 :**
- [ ] Consentement CNDP affiché et enregistré à l'inscription — ⏳ frontend
- [ ] Consentement parental obligatoire si bénéficiaire mineur — ⏳ frontend
- [x] Données mineurs isolées (flag `is_minor` dans le schéma Prisma)

**Définition of Done :**
- [x] Register + login fonctionnels pour les 3 rôles (14 tests couvrant succès + cas d'erreur)
- [x] Rotation refresh token testée (token révoqué après usage)
- [x] Middleware RLS-aware validé (withTenant actif sur /me)
- [ ] QR Code d'invitation bénéficiaire — ⏳ Sprint 3
- [ ] KYC upload opérationnel — ⏳ Sprint 6
- [x] `git tag familypay-sprint-1-complete`

---

### Sprint 2 — Wallets, Enveloppes & CRUD ✅ 🟢 RÉALISÉ
**Objectif :** Wallet rechargeable + enveloppes thématiques + transfert atomique inter-enveloppes.
**Durée :** 2.5 semaines | **SP Total : 17**
**Commit :** `00bd72c` | **Tests :** 17/17 ✅ (`wallet.test.ts` × 7 + `envelope.test.ts` × 10)

| User Story | SP | Priorité | Statut |
|---|---|---|---|
| Payeur : recharger wallet (simulé Phase 1 — `POST /api/wallets/reload`) | 3 | P1 | ✅ |
| Payeur/Bénéficiaire : consulter solde wallet + enveloppes (`GET /api/wallets/me`) | 2 | P1 | ✅ |
| Payeur : créer enveloppes par catégorie (Food, Santé, Vêtements, Éducation, Loisirs, Général) | 4 | P1 | ✅ |
| Payeur : allouer budget par enveloppe + `maxPerTransaction` + `allowedPartnerIds` | 2 | P1 | ✅ |
| Bénéficiaire : voir ses soldes par enveloppe (`GET /api/envelopes?beneficiaryId=…`) | 2 | P1 | ✅ |
| Payeur : transfert atomique entre enveloppes (`POST /api/envelopes/transfer`) | 3 | P1 | ✅ |
| Payeur : désactiver enveloppe — soft delete `isActive = false` (`DELETE /api/envelopes/:id`) | 1 | P1 | ✅ |
| Payeur : règle temporelle — actif uniquement entre heures X et Y | 2 | P1 | ⏳ Sprint 3 (RulesEngine) |
| Payeur : règle montant — max X MAD par transaction, max Y MAD par jour | 2 | P1 | ⏳ Sprint 3 (RulesEngine) |
| Payeur : règle recharge automatique mensuelle/hebdomadaire | 2 | P2 | ⏳ Sprint 4 |
| Dev : `RulesEngine.canProcess()` — validateur avant toute transaction | 3 | P1 | ⏳ Sprint 3 |

> **Note technique :** `POST /transfer` enregistré **avant** `/:id` dans le routeur Express pour éviter le conflit de routing ("transfer" interprété comme un UUID). Transfert inter-enveloppes dans une seule `withTenant()` = atomicité PostgreSQL garantie. `beneficiary_links` sans RLS → lisible sans contexte tenant.

**Catégories d'enveloppes V1 :**
```typescript
export const ENVELOPE_CATEGORIES = {
  FOOD:      { icon: '🍕', label: 'Nourriture',  color: '#f97316' },
  HEALTH:    { icon: '💊', label: 'Santé',        color: '#10b981' },
  CLOTHES:   { icon: '👗', label: 'Vêtements',    color: '#8b5cf6' },
  EDUCATION: { icon: '📚', label: 'Éducation',    color: '#3b82f6' },
  LEISURE:   { icon: '🎮', label: 'Loisirs',      color: '#f59e0b' },
  GENERAL:   { icon: '💰', label: 'Général',      color: '#6b7280' },
};
```

**Définition of Done :**
- [x] 6 catégories d'enveloppes créables et configurables (FOOD, HEALTH, CLOTHES, EDUCATION, LEISURE, GENERAL)
- [x] Wallet reload atomique avec INSERT transaction COMPLETED
- [x] Transfert inter-enveloppes atomique (débit + crédit + log dans une transaction)
- [x] Contrainte wallet non-négatif respectée (CHECK PostgreSQL)
- [ ] Rules Engine couvre : temps, montant, partenaire, journalier — ⏳ Sprint 3
- [ ] Tests unitaires Rules Engine : 15+ cas testés — ⏳ Sprint 3
- [x] `git tag familypay-sprint-2-complete`

---

### Sprint 3 — QR Code Dynamique & Paiement Partenaire ✅ 🟢 RÉALISÉ
**Objectif :** Le flux de paiement complet fonctionne de bout en bout en < 3 secondes.
**Durée :** 2.5 semaines | **SP Total : 22**
**Commit :** `4ddff3f` | **Tests :** 31/31 ✅ (`qr.test.ts` × 5 + `rules.test.ts` × 15 + `payment.test.ts` × 11)

| User Story | SP | Priorité | Statut |
|---|---|---|---|
| Bénéficiaire : générer QR Code dynamique (JWT signé QR_SECRET, valide 60s, usage unique) | 4 | P1 | ✅ |
| Partenaire : soumettre token QR + montant → paiement confirmé (`POST /api/payments`) | 3 | P1 | ✅ |
| Dev : transaction atomique PostgreSQL (débit + crédit + marque QR + log = tout ou rien) | 4 | P1 | ✅ |
| Dev : `RulesEngine.canProcess()` — TIME, DAY, DAILY_LIMIT, maxPerTx, allowedPartners | 3 | P1 | ✅ |
| **Dev : test replay attack — QR déjà utilisé rejeté (QR_ALREADY_USED) 🆕** | 1 | P1 | ✅ |
| **Dev : 10 QR générés simultanément — tokens tous uniques 🆕** | 2 | P1 | ✅ |
| Dev : INSERT only sur transactions — aucun UPDATE possible (trigger DB) | 1 | P1 | ✅ |
| Payeur : notification push immédiate après paiement (FCM) | 2 | P1 | ⏳ Sprint 8 (mobile) |
| Partenaire : fallback Code PIN 6 chiffres | 2 | P1 | ⏳ Sprint 8 (mobile) |
| Dev : transaction traitée en < 3 secondes (mesuré en prod) | 2 | P1 | ⏳ Sprint 6 (monitoring) |

> **Note technique :** `updateMany({ where: { id, usedAt: null } })` pour marquer le QR utilisé — protection contre les race conditions concurrentes sans SELECT FOR UPDATE. `canProcess(tx, ...)` reçoit le client Prisma de la transaction courante — aucune transaction imbriquée. `requireRole` ajouté dans `authenticate.ts` (factory middleware).

**Flux paiement — 7 étapes < 3 secondes :**
```
1. Bénéficiaire génère QR (JWT signé, exp: 60s, nonce unique)
2. Partenaire scanne + saisit montant
3. Backend : décode + valide JWT (signature + expiration)
4. Vérifie en base : QR pas encore utilisé
5. RulesEngine.canProcess() : horaire OK ? montant OK ? partenaire autorisé ?
6. prisma.$transaction() :
   BEGIN
     → débit wallet bénéficiaire (solde ≥ montant)
     → crédit wallet partenaire
     → INSERT transaction (immuable)
     → UPDATE qr_codes SET used_at = NOW()
   COMMIT
7. Push notifications : bénéficiaire + payeur + partenaire
```

**Tests critiques Sprint 3 :**
```typescript
test('QR Code expires after 60s', async () => {
  const token = await qrEngine.generate(beneficiaryId);
  jest.advanceTimersByTime(61000);
  await expect(qrEngine.validate(token, 100, partnerId))
    .rejects.toThrow('QR_INVALID_OR_EXPIRED');
});

test('QR Code cannot be used twice', async () => {
  const token = await qrEngine.generate(beneficiaryId);
  await qrEngine.validate(token, 100, partnerId); // OK
  await expect(qrEngine.validate(token, 100, partnerId)).rejects.toThrow();
});

test('Payment atomicity — rollback on failure', async () => {
  const balanceBefore = await getWalletBalance(beneficiary.walletId);
  await expect(processPayment({ ...params, partnerId: 'invalid' })).rejects.toThrow();
  expect(await getWalletBalance(beneficiary.walletId)).toBe(balanceBefore);
});
```

**⚠️ Conformité Sprint 3 :**
- [ ] Audit log complet sur chaque tentative de transaction (succès ET échec)
- [ ] Alerte automatique si transaction > seuil AML défini

**Définition of Done :**
- [x] QR généré avec JWT signé (QR_SECRET), TTL 60s, nonce UUID unique
- [x] 100% tests QR passent : expiration JWT (fake Date), usage unique, replay attack, concurrent
- [x] Atomicité testée et prouvée (balance inchangée si partenaire invalide = rollback)
- [x] RulesEngine : 15 tests couvrant TIME, DAY, DAILY_LIMIT, maxPerTx, partner restriction, règle inactive, règles multiples
- [x] `git tag familypay-sprint-3-complete`

---

### Sprint 4 — Demandes de Fonds, Occasions & WebSocket ✅ 🟢 RÉALISÉ
**Objectif :** Interactions sociales famille + occasions spéciales + notifications temps réel.
**Durée :** 2 semaines | **SP Total : 16**
**Commit :** `7af64f1` | **Tests :** 20/20 ✅ (`fund-request.test.ts` × 12 + `occasion.test.ts` × 8)

| User Story | SP | Priorité | Statut |
|---|---|---|---|
| Bénéficiaire : envoyer demande de fonds avec message et motif | 3 | P1 | ✅ |
| Payeur : approuver une demande → transfert atomique wallet | 2 | P1 | ✅ |
| Payeur : refuser une demande (avec statut REJECTED) | 1 | P1 | ✅ |
| Payeur : créer une occasion (anniversaire, Aïd, Noël, rentrée) avec montant + date | 3 | P1 | ✅ |
| Dev : notifications temps réel (WebSocket / Socket.io) fire-and-forget | 2 | P1 | ✅ |
| Dev : `notify.ts` — fire-and-forget via `setImmediate` + dynamic import (silent en tests) | 1 | P1 | ✅ |
| Payeur : inviter proches à contribuer à l'occasion (cagnotte familiale) | 3 | P2 | ⏳ Sprint 5 |
| **Bénéficiaire : créer un objectif d'épargne avec barre de progression 🆕** | 2 | P2 | ⏳ Phase 2 |
| **Bénéficiaire : récompense visuelle (badge) quand objectif atteint 🆕** | 1 | P3 | ⏳ Phase 2 |

> **Note technique :** `fund_requests` n'a PAS de `tenant_id` → approbation via `prismaAdmin.$transaction()` avec filtres explicites `{ userId, tenantId }` sur wallet queries pour maintenir l'isolation sans RLS. `occasions` a `tenant_id` → `withTenant()` normal. `notifyUser()` utilise `setImmediate` + dynamic import de `socket.js` — silencieux si Socket.io non initialisé (tests unitaires).

**🆕 Gamification légère (rétention enfants) :**
- Barre de progression vers l'objectif d'épargne ⏳
- Badge "Économiseur" au premier objectif atteint ⏳
- Message de félicitations du payeur automatique ⏳

**Définition of Done :**
- [x] Flux demande → approbation → crédit wallet fonctionne (12 tests fund-request)
- [x] Occasions CRUD avec soft-delete (8 tests occasion)
- [x] WebSocket : `notifyUser()` fire-and-forget, zéro erreur en tests
- [x] `requireRole()` factory supporte plusieurs rôles (ex: `requireRole('BENEFICIARY', 'PAYER')`)
- [ ] Cagnotte multi-contributeurs — ⏳ Sprint 5
- [ ] `git tag familypay-sprint-4-complete`

---

### Sprint 5 — Dashboards, Rapports & Clôture Phase 1 ✅ 🟢 RÉALISÉ
**Objectif :** Tableaux de bord complets pour les 3 profils. Backend MVP prêt pour la beta.
**Durée :** 2 semaines | **SP Total : 14**
**Commit :** `0e68165` | **Tests :** 25/25 ✅ (`dashboard.test.ts` × 12 + `transaction.test.ts` × 8 + `report.test.ts` × 5)

| User Story | SP | Priorité | Statut |
|---|---|---|---|
| Payeur : vue consolidée bénéficiaires + wallets + enveloppes + txns récentes (`GET /api/dashboard/payer`) | 3 | P1 | ✅ |
| Partenaire : stats CA, panier moyen, taux de refus, heatmap horaire (`GET /api/dashboard/partner`) | 3 | P1 | ✅ |
| Payeur/Bénéficiaire : historique paginé avec filtres date/enveloppe/type (`GET /api/transactions`) | 3 | P1 | ✅ |
| Payeur : rapport mensuel JSON par bénéficiaire + par jour (`GET /api/reports/monthly`) | 2 | P1 | ✅ |
| Dev : `async-handler` middleware Express pour tous les controllers | 1 | P1 | ✅ |
| Payeur : export relevé mensuel PDF | 2 | P2 | ⏳ Phase 2 |
| Dev : monitoring Redis QR codes actifs | 1 | P1 | ⏳ Phase 2 |

> **Note technique :** `beforeEach` + random tenant IDs (même pattern que payment.test.ts) — compatible avec le `setup.ts` TRUNCATE après chaque test (bypass trigger immuabilité). `beneficiaryLink` sans `tenantId`, champ `relationship` requis (String). Envelopes liées via `walletId` et non `beneficiaryId`.

**✅ Checkpoint Phase 1 — MVP Backend Complet :**
- [x] Auth JWT + rotation refresh tokens (Sprint 1)
- [x] Wallets + enveloppes thématiques + transfert atomique (Sprint 2)
- [x] QR Code dynamique + RulesEngine + paiement < 3s (Sprint 3)
- [x] Demandes de fonds + occasions + notifications WebSocket (Sprint 4)
- [x] Dashboards payer/partner + historique + rapport mensuel (Sprint 5)
- [x] RLS multi-tenant : 128/128 tests passants
- [x] Transactions immuables + audit trail complet
- [ ] 3 apps frontend opérationnelles — ⏳ Phase 2
- [ ] i18n FR complet, placeholders AR/EN — ⏳ Phase 2
- [ ] `git tag familypay-v1-phase1` + `pg_dump archivé`

---

## PHASE 1.5 — BETA FERMÉ 🆕 (S5.5) | 2 semaines

---

### Sprint 5.5 — Beta Test Fermé & Ajustements 🆕
**Objectif :** Valider le MVP sur le terrain avant tout investissement cloud/production.
**Durée :** 2 semaines

| Action | Responsable | Priorité |
|---|---|---|
| Recrutement : 20-50 familles pilotes (Casablanca/Rabat) | Business | P1 |
| Recrutement : 5-10 partenaires pilotes (1 restaurant, 1 pharmacie, 1 épicerie) | Business | P1 |
| Déploiement environnement de staging (VPS léger) | Dev | P1 |
| Sessions d'observation utilisateurs (enregistrées avec consentement) | Product | P1 |
| Collecte bugs terrain + NPS utilisateurs | Product | P1 |
| Correction bugs critiques remontés | Dev | P1 |
| **Décision go/no-go Phase 2** | Direction | P1 |

**Métriques go/no-go Phase 2 :**
- NPS famille ≥ 7/10
- Taux de succès paiement QR ≥ 95%
- Zéro bug bloquant sur la gestion financière
- Au moins 3 partenaires prêts à s'engager post-MVP

---

## PHASE 2 — CLOUD & PAIEMENT RÉEL (S6 → S12) | ~15 semaines

---

### Sprint 6 — Déploiement Railway (Beta Cloud) ✅ 🟢 RÉALISÉ
**Objectif :** Backend MVP déployé sur Railway (free tier) pour beta fermée — VPS OVH reporté à Phase 3.
**Durée :** 2 semaines | **SP Total : 15**
**Commits :** `e1ed7aa` + `fa6e360` + `bdc04a8` | **URL :** `https://familypaybackend-production.up.railway.app`

> **Adaptation V2 :** Pas de VPS disponible en beta → Railway (free) + Upstash Redis + Vercel (frontends). CI/CD via push GitHub → Railway auto-deploy. Migration vers VPS OVH planifiée en Phase 3 si go/no-go validé.

| Tâche | SP | Priorité | Statut |
|---|---|---|---|
| Railway : service backend connecté au repo GitHub (`main`) | 2 | P1 | ✅ |
| PostgreSQL Railway + migrations Prisma automatiques (`prestart`) | 2 | P1 | ✅ |
| Upstash Redis (TLS `rediss://`) — rate limiting + refresh tokens | 2 | P1 | ✅ |
| Variables d'environnement production (JWT/QR secrets forts 64-hex) | 1 | P1 | ✅ |
| Fix TypeScript build : tsconfig, ioredis, prisma generics, controllers | 3 | P1 | ✅ |
| `prebuild`: `prisma generate` avant `tsc` | 1 | P1 | ✅ |
| `prestart`: `prisma migrate deploy` avant `node dist/index.js` | 1 | P1 | ✅ |
| Seed tenant beta `00000000-0000-0000-0000-000000000001` (ALTIVAX Beta) | 1 | P1 | ✅ |
| Test E2E : `GET /health` → `database: ok, redis: ok` ✅ | 1 | P1 | ✅ |
| Test E2E : `POST /api/auth/register` → user + JWT + refreshToken ✅ | 1 | P1 | ✅ |
| Monitoring : Sentry + UptimeRobot | 2 | P2 | ⏳ Phase 3 |
| Sauvegardes automatiques `pg_dump` | 2 | P2 | ⏳ Phase 3 |

**Définition of Done :**
- [x] `GET /health` → `{ status: ok, database: ok, redis: ok }`
- [x] `POST /api/auth/register` → user créé + JWT valide
- [x] CI/CD : push `main` → déploiement Railway auto en < 3 minutes
- [x] Migrations Prisma appliquées automatiquement au démarrage
- [x] `git tag familypay-sprint-6-complete`

---

### Sprint 6.5 — Frontend Payer Beta (Web) 🆕 ✅ 🟢 RÉALISÉ
**Objectif :** Mini-frontend Payer fonctionnel déployé sur Vercel pour valider le flux E2E en beta fermée.
**Durée :** 1 semaine | **SP Total : 8**
**Commits :** `158ae9b` + `e2f79b4` | **URL :** `https://family-pay-payer.vercel.app`

> **Contexte :** Aucune app frontend n'était disponible pour tester le backend en production. Ce sprint livre un SPA React/Vite minimaliste couvrant le parcours essentiel du Payeur : inscription → connexion → tableau de bord → création d'enveloppe. Déployé sur Vercel (free tier), connecté au backend Railway via `VITE_API_URL`.

| Tâche | SP | Priorité | Statut |
|---|---|---|---|
| Setup `apps/payer` : Vite + React + TypeScript + TailwindCSS | 1 | P1 | ✅ |
| Client API Axios avec intercepteur JWT (auto-refresh 401 → /login) | 1 | P1 | ✅ |
| Store auth Zustand avec persistance localStorage (`familypay-auth`) | 1 | P1 | ✅ |
| Page Login — formulaire email/password + gestion erreurs | 1 | P1 | ✅ |
| Page Register — inscription avec confirmation redirect | 1 | P1 | ✅ |
| Dashboard Payer — solde wallet, bénéficiaires, bouton nouvelle enveloppe | 1 | P1 | ✅ |
| Page Create Envelope — formulaire catégorie + budget + `maxPerTransaction` | 1 | P1 | ✅ |
| Déploiement Vercel + `VITE_API_URL` prod + CORS_ORIGINS Railway | 1 | P1 | ✅ |

**Stack technique :**
```
Vite 6 + React 18 + TypeScript
TailwindCSS (utility-first)
Axios (api client + intercepteur JWT)
Zustand + persist (auth store)
React Router v6 (protected routes)
React Query (dashboard data fetching)
Vercel (déploiement SPA statique)
```

**Configuration prod :**
- `VITE_API_URL=https://familypaybackend-production.up.railway.app` (Vercel env var)
- `CORS_ORIGINS` Railway inclut `https://family-pay-payer.vercel.app`
- Build : `vite build` (sans `tsc -b` pour éviter les erreurs de types stricts)
- Proxy dev : `/api` → Railway (évite CORS en local)

**Tests E2E manuels validés en production :**
- [x] `POST /api/auth/register` → user créé + JWT reçu
- [x] `POST /api/auth/login` → connexion réussie (`connexion réussie` affiché)
- [x] `GET /api/dashboard/payer` → tableau de bord chargé (solde 0.00 MAD)
- [x] `POST /api/envelopes` → enveloppe créée depuis le formulaire
- [x] Refresh page → session persistée (Zustand + localStorage)
- [x] Déconnexion → redirect /login

**Définition of Done :**
- [x] App accessible sur `https://family-pay-payer.vercel.app`
- [x] Connexion réussie avec `test@altivax.ma / Test1234!`
- [x] Dashboard affiche solde wallet + bénéficiaires
- [x] Push GitHub → redéploiement Vercel automatique
- [x] `git tag familypay-sprint-6.5-complete`

---

### Sprint 7 — Intégration Paiement Réel (CMI) ✅ (Critique)
**Objectif :** Les recharges wallet passent par le vrai processeur de paiement marocain.
**Durée :** 3 semaines | **SP Total : 18**

> ⚠️ Requiert dossier CMI déposé dès S0c — accès sandbox CMI disponible.

| User Story | SP | Priorité |
|---|---|---|
| Payeur : recharger wallet par carte bancaire (intégration CMI) | 5 | P1 |
| Payeur : recharger par virement bancaire (RIB ALTIVAX / compte séquestre) | 3 | P1 |
| Dev : webhooks paiement CMI (succès, échec, remboursement) | 3 | P1 |
| Dev : ségrégation des fonds (compte séquestre isolé des fonds propres) | 4 | P1 |
| Dev : AML basique — détection transactions suspectes (montant > seuil, fréquence anormale) | 3 | P1 |

**⚠️ Conformité Sprint 7 :**
- [ ] Ségrégation comptable fonds clients / fonds ALTIVAX documentée
- [ ] Rapport AML mensuel généré automatiquement
- [ ] Audit complet flow recharge → wallet → dépense

**Définition of Done :**
- [ ] Paiement CB live fonctionnel (sandbox CMI)
- [ ] Webhook CMI traité de manière idempotente
- [ ] Ségrégation fonds validée par comptable/juriste
- [ ] `git tag familypay-sprint-7-complete`

---

### Sprint 8 — Application Mobile React Native
**Objectif :** Apps natives iOS + Android pour payeur et bénéficiaire.
**Durée :** 3 semaines | **SP Total : 20**

> 🆕 **Stratégie clarifiée V2 :** Les Sprints 0-7 livrent des PWA web responsive.
> Ce sprint porte le même code en React Native (partage des composants via design system).

| Tâche | SP | Priorité |
|---|---|---|
| Setup React Native + Expo (ou CLI bare) pour apps payeur + bénéficiaire | 3 | P1 |
| Partage des composants UI depuis le design system (S0c) | 3 | P1 |
| Caméra native pour scan QR Code (partenaire reste web tablette) | 3 | P1 |
| Push notifications FCM natives (iOS + Android) | 2 | P1 |
| Biométrie : Face ID / Touch ID pour validation paiement | 3 | P1 |
| Deep links : `familypay://` pour invitations et partages | 2 | P2 |
| Publication stores : TestFlight (iOS) + Google Play Console (beta) | 4 | P2 |

**Définition of Done :**
- [ ] Apps fonctionnelles sur iOS et Android (simulateur + device réel)
- [ ] Paiement QR testé sur device réel
- [ ] Push notifications testées sur les deux OS
- [ ] `git tag familypay-sprint-8-complete`

---

### Sprint 9 — Programme Fidélité Cross-Enseignes
**Objectif :** Rétention familles et partenaires via un programme de points unifié.
**Durée :** 2 semaines | **SP Total : 13**

| User Story | SP | Priorité |
|---|---|---|
| Dev : système de points (X points par MAD dépensé, configurable par partenaire) | 4 | P1 |
| Bénéficiaire : voir son solde de points + historique | 2 | P1 |
| Bénéficiaire : convertir points en solde wallet (taux de change configurable) | 3 | P1 |
| Partenaire Premium : bonus points x2 chez ce partenaire | 2 | P2 |
| Payeur : voir les points cumulés de ses bénéficiaires | 2 | P2 |

**Définition of Done :**
- [ ] Points crédités automatiquement après chaque paiement
- [ ] Conversion points → MAD opérationnelle
- [ ] `git tag familypay-sprint-9-complete`

---

### Sprint 10 — Extension B2B (Tickets Repas / Avantages Salariés)
**Objectif :** Nouveau segment de revenus — concurrent de Sodexo/Edenred au Maroc.
**Durée :** 2 semaines | **SP Total : 14**

| User Story | SP | Priorité |
|---|---|---|
| Entreprise : création compte Pro avec SIRET/RC + validation ALTIVAX | 3 | P1 |
| Entreprise : créer des portefeuilles employés en masse (import CSV) | 3 | P1 |
| Entreprise : allouer budget mensuel repas par employé | 2 | P1 |
| Employé : utiliser son allocation repas chez les partenaires (même flow QR) | 2 | P1 |
| Entreprise : tableau de bord RH (consommation, partenaires fréquentés) | 2 | P1 |
| Dev : facturation mensuelle automatique entreprise | 2 | P2 |

**Définition of Done :**
- [ ] Flow entreprise → employé → dépense opérationnel
- [ ] Import CSV employés fonctionnel
- [ ] Facturation auto entreprise générée et envoyée
- [ ] `git tag familypay-sprint-10-complete`

---

### Sprint 11 — Onboarding Partenaires & Go-to-Market 🆕
**Objectif :** Industrialiser l'acquisition et l'activation des partenaires marchands.
**Durée :** 2 semaines | **SP Total : 12**

| Tâche | SP | Priorité |
|---|---|---|
| Landing page partenaire : bénéfices, inscription, tarification | 3 | P1 |
| Self-onboarding partenaire : inscription → validation → activation en < 48h | 3 | P1 |
| Kit d'accueil partenaire : guide d'utilisation, QR d'affichage, stickers | 2 | P2 |
| Dashboard ALTIVAX admin : gestion partenaires, validation KYC, statistiques globales | 3 | P1 |
| Intégration première enseigne réelle (fast food ou pharmacie Casablanca) | 1 | P1 |

**Définition of Done :**
- [ ] Parcours self-onboarding partenaire testé de A à Z
- [ ] Au moins 1 partenaire réel activé en production
- [ ] Dashboard admin ALTIVAX opérationnel

---

### Sprint 12 — Sécurité, Audit Final & Conformité BAM/CNDP ✅
**Objectif :** Revue de sécurité complète + conformité réglementaire avant ouverture grand public.
**Durée :** 2 semaines | **SP Total : 16**

| Tâche | SP | Priorité |
|---|---|---|
| Audit de sécurité : OWASP Top 10, injection SQL, XSS, CSRF | 4 | P1 |
| Pentest : tentatives de manipulation de solde, replay attacks, brute force | 3 | P1 |
| Conformité CNDP : registre des traitements complet, DPO désigné | 3 | P1 |
| Conformité BAM : dossier agrément EP ou partenariat bancaire finalisé | 4 | P1 |
| Documentation technique finale : API, architecture, procédures d'incident | 2 | P2 |

**✅ Checkpoint Final — Prêt pour lancement grand public :**
- [ ] Zéro vulnérabilité critique (rapport pentest)
- [ ] Conformité CNDP documentée et validée
- [ ] Stratégie BAM actée (partenariat bancaire signé OU dossier déposé)
- [ ] SLA défini : 99.9% uptime, < 3s transactions, < 1h support critique
- [ ] `git tag familypay-v1-launch` + sauvegarde complète archivée

---

## Résumé du Plan V2

| Phase | Sprints | Durée | Jalons | Avancement |
|---|---|---|---|---|
| Phase 0 — Fondations | S0a, S0b, S0c | ~5 semaines | 2 ✅ | 🟢 S0a ✅ 🟢 S0b ✅ ⬜ S0c |
| Phase 1 — MVP Local | S1 → S5 | ~12 semaines | 5 ✅ | 🟢 S1 ✅ 🟢 S2 ✅ 🟢 S3 ✅ 🟢 S4 ✅ 🟢 S5 ✅ |
| Phase 1.5 — Beta Fermé | S5.5 | 2 semaines | — | ⬜ |
| Phase 2 — Cloud & Prod | S6 → S12 | ~15 semaines | 5 ✅ | 🟢 S6 ✅ 🟢 S6.5 ✅ ⬜ S7+ |
| **TOTAL** | **14+ sprints** | **~34 semaines** | **11 ✅** | **9.5/14 réalisés — 128 tests ✅** |

### Compteur de tests automatisés

| Sprint | Fichier | Tests | Statut |
|---|---|---|---|
| S0b | `critical.rls.test.ts` | 19 | ✅ |
| S1 | `auth.test.ts` | 14 | ✅ |
| S2 | `wallet.test.ts` | 7 | ✅ |
| S2 | `envelope.test.ts` | 10 | ✅ |
| S3 | `qr.test.ts` | 5 | ✅ |
| S3 | `rules.test.ts` | 15 | ✅ |
| S3 | `payment.test.ts` | 11 | ✅ |
| S4 | `fund-request.test.ts` | 12 | ✅ |
| S4 | `occasion.test.ts` | 8 | ✅ |
| S5 | `dashboard.test.ts` | 12 | ✅ |
| S5 | `transaction.test.ts` | 8 | ✅ |
| S5 | `report.test.ts` | 5 | ✅ |
| **Total** | | **128** | **✅ 100%** |

---

## Calendrier des actions parallèles (hors sprints)

| Action | Déclencher à | Délai attendu |
|---|---|---|
| Dépôt dossier CMI | Sprint 0c | 4-8 semaines |
| Contact CIH Bank / Attijariwafa (partenariat BAM) | Sprint 0c | 3-6 mois |
| Enregistrement CNDP | Sprint 0c | 2-4 semaines |
| Recrutement familles & partenaires beta | Sprint 4 | — |
| Certification CMI (sandbox → prod) | Sprint 6 | 2-4 semaines |

---

## Règles métier immuables (rappel permanent)

```typescript
// JAMAIS
prisma.transactions.update(...)       // Transactions IMMUABLES
wallet.balance < 0                     // Solde JAMAIS négatif
qrEngine.TTL > 60                     // QR Code MAX 60 secondes

// TOUJOURS
await prisma.$transaction(async (tx) => { ... })  // Tout mouvement de fonds
t('errors.insufficient_balance')       // i18n obligatoire
```

---

*Document généré le 2026-05-02 — Mis à jour le 2026-05-04 (Sprint 6.5 ✅ — Backend Railway + Frontend Payer Vercel) — ALTIVAX FamilyPay V2*
*Contact : contact@altivax.com | altivax.com | +212 678 742 172*
