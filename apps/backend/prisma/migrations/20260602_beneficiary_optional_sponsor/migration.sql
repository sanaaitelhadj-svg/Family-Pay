-- Migration: Beneficiary.sponsorId optional + dateOfBirth
ALTER TABLE "beneficiaries" ALTER COLUMN "sponsorId" DROP NOT NULL;
ALTER TABLE "beneficiaries" ADD COLUMN IF NOT EXISTS "dateOfBirth" TIMESTAMP(3);
