-- AlterTable
ALTER TABLE "sponsors" ADD COLUMN IF NOT EXISTS "phoneVerifiedAt" TIMESTAMP(3);
