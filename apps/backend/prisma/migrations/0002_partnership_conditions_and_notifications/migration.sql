-- AlterTable: add new fields to partners
ALTER TABLE "partners"
  ADD COLUMN IF NOT EXISTS "rejectionReason"     TEXT,
  ADD COLUMN IF NOT EXISTS "contractGeneratedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "approvedAt"          TIMESTAMP(3);

-- CreateTable: partnership_conditions
CREATE TABLE IF NOT EXISTS "partnership_conditions" (
    "id"          TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isRequired"  BOOLEAN NOT NULL DEFAULT true,
    "order"       INTEGER NOT NULL DEFAULT 0,
    "isActive"    BOOLEAN NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "partnership_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: partner_notifications
CREATE TABLE IF NOT EXISTS "partner_notifications" (
    "id"        TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "type"      TEXT NOT NULL,
    "title"     TEXT NOT NULL,
    "message"   TEXT NOT NULL,
    "isRead"    BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "partner_notifications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "partner_notifications_partnerId_fkey"
        FOREIGN KEY ("partnerId") REFERENCES "partners"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "partner_notifications_partnerId_idx" ON "partner_notifications"("partnerId");

-- Seed default partnership conditions
INSERT INTO "partnership_conditions" ("id", "title", "description", "isRequired", "order", "isActive", "updatedAt")
VALUES
  (gen_random_uuid()::text,
   'Respect de la charte ALTIVAX',
   'Le partenaire s''engage à respecter la charte de qualité ALTIVAX FamilyPay, notamment en matière d''accueil des porteurs de carte et de traitement des transactions.',
   true, 1, true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text,
   'Commission de transaction',
   'Le partenaire accepte une commission de 1,5% par transaction FamilyPay, prélevée automatiquement sur chaque paiement. Les virements sont effectués chaque lundi.',
   true, 2, true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text,
   'Protection des données (CNDP)',
   'Le partenaire s''engage à ne pas stocker les données personnelles des porteurs de carte et à traiter les informations conformément à la loi 09-08 sur la protection des données personnelles au Maroc.',
   true, 3, true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text,
   'Durée et résiliation',
   'Le contrat est conclu pour une durée d''un (1) an, renouvelable par tacite reconduction. Une résiliation avec préavis de 30 jours peut être effectuée par l''une ou l''autre des parties.',
   true, 4, true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text,
   'Affichage de l''acception FamilyPay',
   'Le partenaire s''engage à afficher le logo FamilyPay et les visuels fournis par ALTIVAX à l''entrée de son établissement et/ou à la caisse.',
   false, 5, true, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;
