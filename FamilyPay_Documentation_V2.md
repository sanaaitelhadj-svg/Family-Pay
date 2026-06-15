# FamilyPay — Documentation Projet V2
> Dernière mise à jour : Juin 2026

## 1. Présentation
FamilyPay est une solution de paiement familial marocaine permettant à un sponsor de contrôler les dépenses de ses bénéficiaires auprès de marchands via QR code et allocations par catégorie.

## 2. Architecture technique
- **Backend** : Node.js + Express + TypeScript + Prisma + PostgreSQL (Railway)
- **Mobile** : React Native + Expo SDK 53 + Expo Router
- **Auth** : JWT + OTP SMS + Reset password email (Mailtrap HTTP API)
- **Push** : Expo Notifications API
- **Monorepo** : Turborepo

## 3. État d'avancement

### ✅ Terminé

**Authentification & Sécurité**
- Login OTP SMS pour tous les rôles
- Forgot password marchand (OTP email via Mailtrap HTTP API)
- Historique mots de passe (6 derniers, réutilisation interdite)

**Gestion allocations**
- CRUD allocations par catégorie (FOOD, PHARMACY, EDUCATION, CLOTHING, LEISURE, GENERAL)
- Restrictions par marchand spécifique (allowedMerchantIds)
- Pause / suppression allocation
- Renouvellement automatique (DAILY/WEEKLY/MONTHLY/QUARTERLY/ANNUAL)
- Renouvellement manuel depuis l'app
- Badge renouvellement dans l'interface
- Seuils d'alerte (montant fixe ou %) avec suspension automatique

**Paiement QR**
- Génération QR par marchand (TTL 5 min, usage unique)
- Scanner QR style WhatsApp (native + web) + saisie manuelle token
- Preview paiement avant confirmation
- Flux auto-approve → Transaction COMPLETED
- Flux approbation sponsor → PENDING_REVIEW → Approuver/Refuser
- Protection mineurs : approbation forcée (calcul âge temps réel)

**Historique transactions**
- Historique bénéficiaire, marchand et sponsor
- Transactions FAILED loggées dès la preview (fonds insuffisants)
- Demandes PENDING visibles avec boutons Approuver/Refuser inline
- Infos carte sponsor (brand, 4 derniers chiffres) sur chaque transaction
- Filtres : Tout / Réussi / Échoué / En attente

**Push notifications**
- Enregistrement token Expo (POST /mobile/sponsor/push-token)
- Notification au sponsor sur paiement mineur en attente
- Contenu : nom bénéficiaire + montant + marchand

**Admin**
- KYC marchands (kycStatus, activationStatus)
- Demandes de modification marchand
- Panel admin

### 🔄 En cours
- Test push notifications sur device Android physique
- Deep link depuis notification → écran approbation

### Règles métier critiques
- `Transaction` et `Authorization` sont INSERT ONLY (triggers DB — aucun UPDATE possible)
- Approbation individuelle → crée une nouvelle Transaction sans modifier l'Authorization
- Mineur → requiresApproval forcé en temps réel (pas seulement le flag DB)
- Transactions FAILED loggées dès la preview (pas seulement au confirm)
- OTP reset consommé APRÈS vérification historique mot de passe (permet retry)

## 4. Benchmark international

### Solutions existantes comparées
| Solution | Pays | Modèle |
|----------|------|--------|
| Greenlight | 🇺🇸 USA | Carte débit enfant + contrôle parental avancé |
| GoHenry | 🇬🇧 UK | Carte débit enfant + app parent |
| Pixpay | 🇫🇷 France | Carte débit ado + cashback |
| Kard | 🇫🇷 France | Carte ado + cashback + parrainage |
| Revolut Junior | 🌍 Global | Sous-compte enfant Revolut |
| FamZoo | 🇺🇸 USA | Banque familiale virtuelle |
| Step | 🇺🇸 USA | Banking ado + credit building |
| Vybe | 🇫🇷 France | Carte ado lifestyle |
| Xaalys | 🇫🇷 France | Éducation financière ados |
| **FamilyPay** | 🇲🇦 **Maroc** | **Paiement familial QR + marchands** |

### Comparatif fonctionnalités
| Fonctionnalité | Greenlight | GoHenry | Pixpay | Revolut Jr | FamZoo | **FamilyPay** |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Contrôle parental | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Limites par catégorie | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| Restrictions par marchand | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Paiement QR | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Interface marchand dédiée | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| KYC marchand | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Multi-bénéficiaires | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Approbation temps réel | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Push notifications | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Renouvellement auto | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| Suspension auto sur seuil | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Protection mineurs temps réel | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Adultes non-mineurs | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Conformité réglementaire locale | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ BAM |
| Éducation financière | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Objectifs d'épargne | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Cashback / récompenses | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Tâches / argent conditionnel | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Rapport mensuel automatique | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |

### Points forts FamilyPay
🟢 **Différenciants uniques (aucun concurrent ne propose)**
1. Écosystème QR tripartite Sponsor / Bénéficiaire / Marchand avec interface dédiée à chaque acteur
2. Restriction par marchand spécifique (pas seulement par catégorie)
3. Suspension automatique allocation sur seuil de dépense
4. Ciblage adultes (tous les concurrents ciblent exclusivement enfants/ados)
5. Seule solution conforme BAM pour le marché marocain

🟡 **Comparable aux leaders**
- Approbation individuelle temps réel, limites par catégorie, renouvellement auto, push notifications, multi-bénéficiaires, historique détaillé tous rôles

🔴 **Gaps vs concurrents**
- Pas d'éducation financière / gamification
- Pas d'objectifs d'épargne bénéficiaire
- Pas de cashback / récompenses
- Pas de rapport mensuel automatique
- Pas d'intégration Apple Pay / Google Pay

## 5. Évolutions prioritaires

### 🚀 Priorité HAUTE (prochains sprints)

**1. Objectifs d'épargne bénéficiaire**
- Bénéficiaire définit un objectif (nom, montant cible, deadline)
- Sponsor peut abonder automatiquement
- Barre de progression dans l'app
- Notification sponsor quand objectif atteint
- *Pourquoi : Greenlight et GoHenry en font un argument commercial majeur — fort levier d'engagement et de rétention*

**2. Deep link push notification → écran approbation**
- Clic sur notification → ouvre directement l'écran de la demande d'approbation
- *Pourquoi : UX indispensable pour les paiements urgents (mineur en caisse)*

**3. Rapport mensuel automatique sponsor (email)**
- Email auto le 1er de chaque mois : total par bénéficiaire, par catégorie, top marchands
- *Pourquoi : Réduit le churn, transparence sans ouvrir l'app*

**4. Onboarding guidé (première connexion)**
- Étapes guidées : ajouter bénéficiaire → créer allocation → inviter marchand
- Checklist "Premiers pas" dans le dashboard
- *Pourquoi : Tous les concurrents ont un onboarding soigné — réduit le drop à l'inscription*

### ⚡ Priorité MOYENNE

**5. Module éducation financière (bénéficiaire)**
- Quiz, badges, score "Bonne gestion" visible par le sponsor
- *Différenciateur fort pour familles avec enfants*

**6. Tâches / argent conditionnel**
- Sponsor crée des tâches → validation → crédit automatique sur allocation
- *Modèle populaire : BusyKid, Greenlight, GoHenry*

**7. Lien de paiement marchand (e-commerce)**
- Marchand génère un lien au lieu d'un QR
- Cas d'usage : cours en ligne, livraison à domicile

**8. Rapport hebdomadaire SMS / email bénéficiaire**
- Solde restant, dépenses de la semaine, progression objectif épargne

### 🌱 Priorité BASSE / Long terme

**9. Cashback / programme de fidélité**
- Cashback (0.5-2%) sur catégories ou marchands partenaires

**10. Expansion MENA**
- Tunisie, Sénégal, Côte d'Ivoire — adaptation réglementaire + multi-devises

**11. API marchands (intégration POS)**
- SDK pour caisses enregistreuses — webhook temps réel

**12. Épargne / investissement**
- Hors scope BAM actuel — produits sharia-compliant à étudier

## 6. Réglementation BAM
| Point | Statut |
|-------|--------|
| Consentement CNDP | ✅ Implémenté (`cndpConsentAt` sur User) |
| KYC marchands | ✅ Implémenté (`kycStatus`, `activationStatus`) |
| Traçabilité transactions (INSERT ONLY) | ✅ Implémenté |
| Plafonds de paiement par catégorie | 🔄 À configurer |
| Rapports réglementaires BAM | ❌ À implémenter |
| Agrément établissement de paiement | 📋 En cours |

---
*ALTIVAX FamilyPay © 2026 — Document maintenu à chaque sprint*
