-- AlterTable
ALTER TABLE "merchants" ADD COLUMN     "attestationBancaire" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cguSignedAt" TIMESTAMP(3),
ADD COLUMN     "cguVersion" TEXT,
ADD COLUMN     "cinRepresentant" TEXT,
ADD COLUMN     "contactAdmin" JSONB,
ADD COLUMN     "contactFinance" JSONB,
ADD COLUMN     "contactOps" JSONB,
ADD COLUMN     "fiscalId" TEXT,
ADD COLUMN     "gpsLat" DOUBLE PRECISION,
ADD COLUMN     "gpsLng" DOUBLE PRECISION,
ADD COLUMN     "photos" JSONB,
ADD COLUMN     "rib" TEXT;
