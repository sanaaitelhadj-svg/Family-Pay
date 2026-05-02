-- Initialisation PostgreSQL pour FamilyPay
-- Exécuté automatiquement au premier démarrage du container

-- Extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Extension pour chiffrement
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Fonction pour le support RLS multi-tenant
CREATE OR REPLACE FUNCTION set_tenant_context(tenant_id TEXT)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.tenant_id', tenant_id, TRUE);
END;
$$ LANGUAGE plpgsql;

-- Note : Le schéma complet (tables, RLS, triggers) est géré par Prisma migrations (Sprint 0b)
