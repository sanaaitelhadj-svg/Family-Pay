-- Add PHONE_CHANGE to OtpPurpose enum
ALTER TYPE "OtpPurpose" ADD VALUE IF NOT EXISTS 'PHONE_CHANGE';

-- Create sponsor_cards table
CREATE TABLE IF NOT EXISTS "sponsor_cards" (
  "id"           TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "sponsorId"    TEXT NOT NULL,
  "maskedNumber" TEXT NOT NULL,
  "cardHolder"   TEXT NOT NULL,
  "expiryMonth"  INTEGER NOT NULL,
  "expiryYear"   INTEGER NOT NULL,
  "brand"        TEXT NOT NULL DEFAULT 'VISA',
  "isDefault"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sponsor_cards_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sponsor_cards_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "sponsors"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "sponsor_cards_sponsorId_idx" ON "sponsor_cards"("sponsorId");
