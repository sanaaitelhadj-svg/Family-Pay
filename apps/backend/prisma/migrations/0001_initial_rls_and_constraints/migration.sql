-- ============================================================
-- ALTIVAX FamilyPay — Migration initiale
-- RLS multi-tenant + contraintes financières + triggers immuabilité
-- ============================================================

-- Extensions PostgreSQL requises
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── ENUMS ─────────────────────────────────────────────────────────────────────
CREATE TYPE "Plan" AS ENUM ('FREE', 'FAMILY', 'PREMIUM', 'PRO_B2B');
CREATE TYPE "Role" AS ENUM ('PAYER', 'BENEFICIARY', 'PARTNER', 'ADMIN');
CREATE TYPE "KycStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');
CREATE TYPE "EnvelopeCategory" AS ENUM ('FOOD', 'HEALTH', 'CLOTHES', 'EDUCATION', 'LEISURE', 'GENERAL');
CREATE TYPE "RuleType" AS ENUM ('TIME', 'DAY', 'DAILY_LIMIT', 'GEO', 'CONDITIONAL');
CREATE TYPE "TransactionType" AS ENUM ('PAYMENT', 'RELOAD', 'TRANSFER', 'REVERSAL', 'FUND_REQUEST_APPROVED');
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REVERSED');
CREATE TYPE "FundRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- ── TABLES ────────────────────────────────────────────────────────────────────
CREATE TABLE "tenants" (
    "id"        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name"      TEXT NOT NULL,
    "plan"      "Plan" NOT NULL DEFAULT 'FREE',
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "users" (
    "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId"          UUID NOT NULL REFERENCES "tenants"("id"),
    "email"             TEXT UNIQUE,
    "phone"             TEXT UNIQUE,
    "passwordHash"      TEXT,
    "role"              "Role" NOT NULL,
    "firstName"         TEXT,
    "lastName"          TEXT,
    "avatarUrl"         TEXT,
    "kycStatus"         "KycStatus" NOT NULL DEFAULT 'PENDING',
    "kycDocumentUrl"    TEXT,
    "isMinor"           BOOLEAN NOT NULL DEFAULT false,
    "twoFaEnabled"      BOOLEAN NOT NULL DEFAULT false,
    "twoFaSecret"       TEXT,
    "biometricEnabled"  BOOLEAN NOT NULL DEFAULT false,
    "fcmToken"          TEXT,
    "isActive"          BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt"       TIMESTAMPTZ,
    "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "beneficiary_links" (
    "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "payerId"       UUID NOT NULL REFERENCES "users"("id"),
    "beneficiaryId" UUID NOT NULL REFERENCES "users"("id"),
    "relationship"  TEXT NOT NULL,
    "isActive"      BOOLEAN NOT NULL DEFAULT true,
    "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE ("payerId", "beneficiaryId")
);

-- CONTRAINTE CRITIQUE : balance >= 0 (jamais négatif)
CREATE TABLE "wallets" (
    "id"        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId"  UUID NOT NULL REFERENCES "tenants"("id"),
    "userId"    UUID NOT NULL UNIQUE REFERENCES "users"("id"),
    "balance"   DECIMAL(12,2) NOT NULL DEFAULT 0 CONSTRAINT "positive_wallet_balance" CHECK ("balance" >= 0),
    "currency"  TEXT NOT NULL DEFAULT 'MAD',
    "frozen"    BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CONTRAINTE CRITIQUE : balance >= 0 (jamais négatif)
CREATE TABLE "envelopes" (
    "id"                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId"           UUID NOT NULL REFERENCES "tenants"("id"),
    "walletId"           UUID NOT NULL REFERENCES "wallets"("id"),
    "category"           "EnvelopeCategory" NOT NULL,
    "label"              TEXT NOT NULL,
    "balance"            DECIMAL(12,2) NOT NULL DEFAULT 0 CONSTRAINT "positive_envelope_balance" CHECK ("balance" >= 0),
    "maxPerTransaction"  DECIMAL(12,2),
    "allowedPartnerIds"  UUID[] NOT NULL DEFAULT '{}',
    "autoReloadEnabled"  BOOLEAN NOT NULL DEFAULT false,
    "autoReloadAmount"   DECIMAL(12,2),
    "autoReloadDay"      INTEGER CHECK ("autoReloadDay" BETWEEN 1 AND 28),
    "carryOverBalance"   BOOLEAN NOT NULL DEFAULT true,
    "isActive"           BOOLEAN NOT NULL DEFAULT true,
    "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "rules" (
    "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId"   UUID NOT NULL REFERENCES "tenants"("id"),
    "envelopeId" UUID NOT NULL REFERENCES "envelopes"("id"),
    "type"       "RuleType" NOT NULL,
    "conditions" JSONB NOT NULL,
    "isActive"   BOOLEAN NOT NULL DEFAULT true,
    "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "partners" (
    "id"                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId"           UUID NOT NULL REFERENCES "tenants"("id"),
    "userId"             UUID NOT NULL UNIQUE REFERENCES "users"("id"),
    "walletId"           UUID REFERENCES "wallets"("id"),
    "businessName"       TEXT NOT NULL,
    "category"           TEXT NOT NULL,
    "registrationNumber" TEXT,
    "logoUrl"            TEXT,
    "address"            TEXT,
    "city"               TEXT,
    "isPremium"          BOOLEAN NOT NULL DEFAULT false,
    "isVerified"         BOOLEAN NOT NULL DEFAULT false,
    "isActive"           BOOLEAN NOT NULL DEFAULT true,
    "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "qr_codes" (
    "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId"      UUID NOT NULL REFERENCES "tenants"("id"),
    "beneficiaryId" UUID NOT NULL REFERENCES "users"("id"),
    "token"         TEXT NOT NULL UNIQUE,
    "expiresAt"     TIMESTAMPTZ NOT NULL,
    "usedAt"        TIMESTAMPTZ,
    "amountUsed"    DECIMAL(12,2),
    "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CONTRAINTE CRITIQUE : amount > 0 (jamais nul ou négatif)
-- Cette table est IMMUABLE — un trigger bloque tout UPDATE
CREATE TABLE "transactions" (
    "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId"      UUID NOT NULL REFERENCES "tenants"("id"),
    "fromWalletId"  UUID REFERENCES "wallets"("id"),
    "toWalletId"    UUID REFERENCES "wallets"("id"),
    "envelopeId"    UUID REFERENCES "envelopes"("id"),
    "partnerId"     UUID REFERENCES "partners"("id"),
    "qrCodeId"      UUID UNIQUE REFERENCES "qr_codes"("id"),
    "amount"        DECIMAL(12,2) NOT NULL CONSTRAINT "positive_transaction_amount" CHECK ("amount" > 0),
    "type"          "TransactionType" NOT NULL,
    "status"        "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "reversalOfId"  UUID,
    "metadata"      JSONB,
    "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    -- Pas de updatedAt : cette table est IMMUABLE
);

CREATE TABLE "fund_requests" (
    "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "senderId"    UUID NOT NULL REFERENCES "users"("id"),
    "receiverId"  UUID NOT NULL REFERENCES "users"("id"),
    "amount"      DECIMAL(12,2) NOT NULL CHECK ("amount" > 0),
    "message"     TEXT,
    "status"      "FundRequestStatus" NOT NULL DEFAULT 'PENDING',
    "respondedAt" TIMESTAMPTZ,
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "occasions" (
    "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId"          UUID NOT NULL REFERENCES "tenants"("id"),
    "creatorId"         UUID NOT NULL REFERENCES "users"("id"),
    "beneficiaryId"     UUID NOT NULL REFERENCES "users"("id"),
    "title"             TEXT NOT NULL,
    "message"           TEXT,
    "targetAmount"      DECIMAL(12,2) NOT NULL CHECK ("targetAmount" > 0),
    "currentAmount"     DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK ("currentAmount" >= 0),
    "restrictPartnerId" UUID REFERENCES "partners"("id"),
    "activatesAt"       TIMESTAMPTZ NOT NULL,
    "expiresAt"         TIMESTAMPTZ NOT NULL,
    "isActive"          BOOLEAN NOT NULL DEFAULT true,
    "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── INDEX ─────────────────────────────────────────────────────────────────────
CREATE INDEX "idx_users_tenant"         ON "users"("tenantId");
CREATE INDEX "idx_wallets_tenant"       ON "wallets"("tenantId");
CREATE INDEX "idx_envelopes_tenant"     ON "envelopes"("tenantId");
CREATE INDEX "idx_envelopes_wallet"     ON "envelopes"("walletId");
CREATE INDEX "idx_transactions_tenant"  ON "transactions"("tenantId");
CREATE INDEX "idx_transactions_from"    ON "transactions"("fromWalletId");
CREATE INDEX "idx_transactions_to"      ON "transactions"("toWalletId");
CREATE INDEX "idx_transactions_created" ON "transactions"("createdAt" DESC);
CREATE INDEX "idx_qr_codes_token"       ON "qr_codes"("token");
CREATE INDEX "idx_qr_codes_beneficiary" ON "qr_codes"("beneficiaryId");

-- ── FONCTION SET_TENANT_CONTEXT ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_tenant_context(p_tenant_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM set_config('app.tenant_id', p_tenant_id, TRUE);
END;
$$;

-- ── RLS — ROW LEVEL SECURITY ──────────────────────────────────────────────────
-- Active RLS sur toutes les tables financières sensibles

ALTER TABLE "wallets"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "envelopes"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rules"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "qr_codes"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "occasions"    ENABLE ROW LEVEL SECURITY;

-- Politiques RLS : un tenant ne voit que ses propres données
CREATE POLICY "tenant_isolation_wallets" ON "wallets"
    USING ("tenantId" = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);

CREATE POLICY "tenant_isolation_envelopes" ON "envelopes"
    USING ("tenantId" = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);

CREATE POLICY "tenant_isolation_transactions" ON "transactions"
    USING ("tenantId" = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);

CREATE POLICY "tenant_isolation_rules" ON "rules"
    USING ("tenantId" = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);

CREATE POLICY "tenant_isolation_qr_codes" ON "qr_codes"
    USING ("tenantId" = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);

CREATE POLICY "tenant_isolation_occasions" ON "occasions"
    USING ("tenantId" = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);

-- Bypasser RLS pour le superuser (migrations, admin)
ALTER TABLE "wallets"      FORCE ROW LEVEL SECURITY;
ALTER TABLE "envelopes"    FORCE ROW LEVEL SECURITY;
ALTER TABLE "transactions" FORCE ROW LEVEL SECURITY;
ALTER TABLE "rules"        FORCE ROW LEVEL SECURITY;
ALTER TABLE "qr_codes"     FORCE ROW LEVEL SECURITY;
ALTER TABLE "occasions"    FORCE ROW LEVEL SECURITY;

-- ── TRIGGER IMMUABILITÉ TRANSACTIONS ─────────────────────────────────────────
-- RÈGLE ABSOLUE : aucun UPDATE sur la table transactions
-- Pour annuler : créer une transaction de type REVERSAL

CREATE OR REPLACE FUNCTION prevent_transaction_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'IMMUTABLE_TRANSACTION: Transactions cannot be modified. Create a REVERSAL transaction instead. (id: %)',
    OLD.id
  USING ERRCODE = 'P0001';
END;
$$;

CREATE TRIGGER "no_update_transactions"
    BEFORE UPDATE ON "transactions"
    FOR EACH ROW
    EXECUTE FUNCTION prevent_transaction_update();

-- Bloquer aussi les DELETE (audit trail permanent)
CREATE OR REPLACE FUNCTION prevent_transaction_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'IMMUTABLE_TRANSACTION: Transactions cannot be deleted. (id: %)',
    OLD.id
  USING ERRCODE = 'P0001';
END;
$$;

CREATE TRIGGER "no_delete_transactions"
    BEFORE DELETE ON "transactions"
    FOR EACH ROW
    EXECUTE FUNCTION prevent_transaction_delete();

-- ── TRIGGER updatedAt AUTOMATIQUE ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER "auto_updated_at_tenants"
    BEFORE UPDATE ON "tenants"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER "auto_updated_at_users"
    BEFORE UPDATE ON "users"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER "auto_updated_at_wallets"
    BEFORE UPDATE ON "wallets"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER "auto_updated_at_envelopes"
    BEFORE UPDATE ON "envelopes"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER "auto_updated_at_partners"
    BEFORE UPDATE ON "partners"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
