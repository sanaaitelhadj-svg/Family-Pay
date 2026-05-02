# ALTIVAX FamilyPay — Plan Sprints V2
## 14 Sprints — ~32 semaines | Révisé le 2026-05-02

> **Conventions**
> - SP = Story Points (1 SP ≈ 1 jour-développeur)
> - P1 = Critique | P2 = Important | P3 = Stretch
> - ✅ = Jalon avec sauvegarde obligatoire (`git tag` + `pg_dump`)
> - ⚠️ = Point d'attention critique
> - 🆕 = Ajout V2 (absent de la V1)

---

## PHASE 0 — FONDATIONS (S0a → S0c) | ~5 semaines

---

### Sprint 0a — Monorepo & Infrastructure Docker ✅
**Objectif :** Structure projet solide, environnement de dev reproductible, CI/CD basique.
**Durée :** 1.5 semaine | **SP Total : 9**

| Tâche | SP | Priorité |
|---|---|---|
| Monorepo Turborepo : `apps/payer` + `apps/beneficiary` + `apps/partner` + `apps/backend` | 2 | P1 |
| Docker Compose : frontend×3 + backend + PostgreSQL 16 + Redis 7 + MinIO | 3 | P1 |
| GitHub Actions CI : lint + test + build sur PR | 2 | P1 |
| Script backup automatique : `git tag` + `pg_dump` + archivage | 1 | P1 |
| `.env.example` documenté (tous les secrets requis) | 1 | P1 |

**Définition of Done :**
- [ ] `docker compose up` lance tous les services sans erreur
- [ ] CI passe sur un PR vide
- [ ] Script backup fonctionne et crée un tag git
- [ ] `git tag familypay-sprint-0a-complete`

---

### Sprint 0b — Schéma BDD, RLS & Tests Financiers Critiques ✅
**Objectif :** Base de données financière irréprochable dès le départ.
**Durée :** 1.5 semaine | **SP Total : 10**

| Tâche | SP | Priorité |
|---|---|---|
| Schéma Prisma complet : tenants, users, wallets, envelopes, transactions, qr_codes, rules, partners | 4 | P1 |
| RLS PostgreSQL multi-tenant + politique d'isolation par `tenant_id` | 3 | P1 |
| Tests RLS : wallet tenant A invisible depuis tenant B | 2 | P1 |
| Trigger PostgreSQL `prevent_transaction_update` (immuabilité) | 1 | P1 |
| Contraintes `CHECK (balance >= 0)` sur wallets et envelopes | 1 | P1 |
| i18n dès S0b : `react-i18next` configuré (FR V1, AR/EN placeholders V2) | 1 | P1 |

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
- [ ] 100% des tests RLS passent
- [ ] Trigger immuabilité actif et testé
- [ ] i18n configuré dans les 3 apps
- [ ] `git tag familypay-sprint-0b-complete`

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

### Sprint 1 — Auth, KYC & Gestion Bénéficiaires ✅
**Objectif :** Les 3 types d'utilisateurs peuvent créer un compte, se connecter et être associés.
**Durée :** 2 semaines | **SP Total : 18**

| User Story | SP | Priorité |
|---|---|---|
| Payeur : inscription email/téléphone + vérification OTP | 3 | P1 |
| Payeur : connexion avec 2FA (SMS ou authenticator) | 3 | P1 |
| Partenaire : création compte marchand avec RC/SIRET | 3 | P1 |
| Partenaire : validation par ALTIVAX avant activation | 2 | P1 |
| **Payeur : ajouter bénéficiaire par email, téléphone ou QR Code d'invitation 🆕** | 3 | P1 |
| Payeur : définir relation (enfant, ami, employé) + photo + pseudo | 1 | P1 |
| Payeur : suspendre / activer / supprimer un bénéficiaire | 1 | P1 |
| Dev : KYC basique — upload CNI + selfie (stockage MinIO) | 3 | P1 |
| Dev : rate limiting `/auth/*` — 5 req/min par IP | 1 | P1 |

**⚠️ Conformité Sprint 1 :**
- [ ] Consentement CNDP affiché et enregistré à l'inscription
- [ ] Consentement parental obligatoire si bénéficiaire mineur
- [ ] Données mineurs isolées (flag `is_minor` + protections spécifiques)

**Définition of Done :**
- [ ] Inscription + login fonctionnels pour les 3 rôles
- [ ] QR Code d'invitation bénéficiaire testé
- [ ] KYC upload opérationnel
- [ ] `git tag familypay-sprint-1-complete`

---

### Sprint 2 — Wallets, Enveloppes & Règles Intelligentes ✅
**Objectif :** Le payeur peut créer des enveloppes thématiques et configurer des règles.
**Durée :** 2.5 semaines | **SP Total : 17**

| User Story | SP | Priorité |
|---|---|---|
| Payeur : créer enveloppes par catégorie (Food, Santé, Vêtements, Éducation, Loisirs, Général) | 4 | P1 |
| Payeur : allouer budget par enveloppe + restreindre à des partenaires spécifiques | 2 | P1 |
| Payeur : recharger wallet via virement bancaire (simulé en Phase 1) | 3 | P1 |
| Bénéficiaire : voir ses soldes par enveloppe (UI claire, adaptée aux enfants) | 2 | P1 |
| Payeur : règle temporelle — actif uniquement entre heures X et Y | 2 | P1 |
| Payeur : règle montant — max X MAD par transaction, max Y MAD par jour | 2 | P1 |
| Payeur : règle recharge automatique mensuelle/hebdomadaire | 2 | P2 |
| Payeur : report du solde non utilisé (oui/non configurable) | 1 | P2 |
| Dev : `RulesEngine.canProcess()` — validateur avant toute transaction | 3 | P1 |

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
- [ ] 6 catégories d'enveloppes créables et configurables
- [ ] Rules Engine couvre : temps, montant, partenaire, journalier
- [ ] Tests unitaires Rules Engine : 15+ cas testés
- [ ] `git tag familypay-sprint-2-complete`

---

### Sprint 3 — QR Code Dynamique & Paiement Partenaire ✅ (Critique)
**Objectif :** Le flux de paiement complet fonctionne de bout en bout en < 3 secondes.
**Durée :** 2.5 semaines | **SP Total : 22**

| User Story | SP | Priorité |
|---|---|---|
| Bénéficiaire : générer QR Code dynamique (JWT signé, valide 60s, usage unique) | 4 | P1 |
| Partenaire : scanner QR + saisir montant → confirmation instantanée | 3 | P1 |
| Dev : transaction atomique PostgreSQL (débit + crédit + log = tout ou rien) | 4 | P1 |
| Dev : vérification règles AVANT autorisation (RulesEngine) | 3 | P1 |
| Dev : transaction traitée en < 3 secondes end-to-end | 2 | P1 |
| Payeur : notification push immédiate après paiement (FCM) | 2 | P1 |
| Partenaire : fallback Code PIN 6 chiffres si pas de QR scanner | 2 | P1 |
| **Dev : test de charge — 100 QR générés simultanément 🆕** | 2 | P1 |
| **Dev : test replay attack — QR déjà utilisé doit être rejeté 🆕** | 1 | P1 |
| Dev : INSERT only sur transactions — aucun UPDATE possible | 1 | P1 |

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
- [ ] Paiement end-to-end < 3 secondes (mesuré)
- [ ] 100% tests QR passent (expiration, usage unique, replay attack)
- [ ] Atomicité testée et prouvée
- [ ] `git tag familypay-sprint-3-complete`

---

### Sprint 4 — Demandes de Fonds, Cagnotte & Épargne
**Objectif :** Interactions sociales famille + occasions spéciales + objectifs épargne gamifiés.
**Durée :** 2 semaines | **SP Total : 16**

| User Story | SP | Priorité |
|---|---|---|
| Bénéficiaire : envoyer demande de fonds avec message et motif | 3 | P1 |
| Payeur : approuver ou refuser une demande (avec commentaire optionnel) | 2 | P1 |
| Payeur : créer une occasion (anniversaire, Aïd, Noël, rentrée) avec montant + date | 3 | P1 |
| Payeur : inviter proches à contribuer à l'occasion (cagnotte familiale) | 3 | P2 |
| Dev : notifications temps réel (WebSocket / Socket.io) | 2 | P1 |
| **Bénéficiaire : créer un objectif d'épargne avec barre de progression 🆕** | 2 | P2 |
| **Bénéficiaire : récompense visuelle (badge) quand objectif atteint 🆕** | 1 | P3 |

**🆕 Gamification légère (rétention enfants) :**
- Barre de progression vers l'objectif d'épargne
- Badge "Économiseur" au premier objectif atteint
- Message de félicitations du payeur automatique

**Définition of Done :**
- [ ] Flux demande → approbation → crédit wallet fonctionne
- [ ] Cagnotte multi-contributeurs opérationnelle
- [ ] WebSocket : notification < 1 seconde
- [ ] `git tag familypay-sprint-4-complete`

---

### Sprint 5 — Dashboards, Rapports & Clôture Phase 1 ✅
**Objectif :** Tableaux de bord complets pour les 3 profils. Prêt pour la beta.
**Durée :** 2 semaines | **SP Total : 14**

| User Story | SP | Priorité |
|---|---|---|
| Payeur : vue consolidée tous les soldes bénéficiaires + enveloppes | 3 | P1 |
| Payeur : historique complet transactions avec filtres (date, bénéficiaire, catégorie) | 3 | P1 |
| Partenaire : stats transactions (CA journalier, panier moyen, taux de refus) | 3 | P1 |
| Payeur : export relevé mensuel PDF | 2 | P2 |
| Partenaire : carte de chaleur heures de pointe clientèle | 2 | P2 |
| Dev : monitoring Redis QR codes actifs (dashboard interne) | 1 | P1 |

**✅ Checkpoint Phase 1 — MVP fonctionnel :**
- [ ] 3 apps opérationnelles (payeur, bénéficiaire, partenaire)
- [ ] Wallets et enveloppes thématiques fonctionnels
- [ ] QR Code dynamique + paiement < 3 secondes
- [ ] Règles intelligentes actives (horaire, montant, partenaire)
- [ ] Notifications temps réel WebSocket
- [ ] RLS multi-tenant : 100% tests passants
- [ ] Transactions immuables + audit trail complet
- [ ] i18n FR complet, placeholders AR/EN
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

### Sprint 6 — Déploiement VPS + Portainer ✅
**Objectif :** Infrastructure de production sur VPS OVH — cohérente avec infra ALTIVAX existante.
**Durée :** 2 semaines | **SP Total : 15**

| Tâche | SP | Priorité |
|---|---|---|
| Stacks Portainer : proxy + data + files + app (4 stacks séparées) | 4 | P1 |
| Traefik + SSL Let's Encrypt (`familypay.altivax.com`) | 2 | P1 |
| CI/CD GitHub Actions → webhook Portainer (déploiement automatique) | 3 | P1 |
| Monitoring : Sentry (erreurs) + UptimeRobot (disponibilité) | 2 | P1 |
| Sauvegardes automatiques : cron `pg_dump` → ATS Backup PBS | 2 | P1 |
| Streaming replication PostgreSQL (RPO < 1h) | 3 | P1 |
| Alertes : transaction échouée, solde anormalement bas, erreur 5xx | 1 | P1 |

**Définition of Done :**
- [ ] App accessible sur `familypay.altivax.com` avec SSL
- [ ] CI/CD : push main → déploiement auto en < 5 minutes
- [ ] Sauvegardes cron actives et testées (restore testé !)
- [ ] `git tag familypay-sprint-6-complete`

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

| Phase | Sprints | Durée | Jalons |
|---|---|---|---|
| Phase 0 — Fondations | S0a, S0b, S0c | ~5 semaines | 2 ✅ |
| Phase 1 — MVP Local | S1 → S5 | ~12 semaines | 4 ✅ |
| Phase 1.5 — Beta Fermé | S5.5 | 2 semaines | — |
| Phase 2 — Cloud & Prod | S6 → S12 | ~15 semaines | 5 ✅ |
| **TOTAL** | **14 sprints** | **~34 semaines** | **11 ✅** |

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

*Document généré le 2026-05-02 — ALTIVAX FamilyPay V2*
*Contact : contact@altivax.com | altivax.com | +212 678 742 172*
