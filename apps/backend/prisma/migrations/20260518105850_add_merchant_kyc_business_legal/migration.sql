-- AlterTable
ALTER TABLE "merchants" ADD COLUMN     "allowedProducts" JSONB,
ADD COLUMN     "businessHours" JSONB,
ADD COLUMN     "cguClauses" JSONB,
ADD COLUMN     "contactLegal" JSONB,
ADD COLUMN     "riskLevel" TEXT;
