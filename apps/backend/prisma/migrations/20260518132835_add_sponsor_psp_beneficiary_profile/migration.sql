-- AlterTable
ALTER TABLE "beneficiaries" ADD COLUMN     "profilePhoto" TEXT,
ADD COLUMN     "relationship" TEXT;

-- AlterTable
ALTER TABLE "sponsors" ADD COLUMN     "maskedCardReference" TEXT,
ADD COLUMN     "pspCustomerReference" TEXT;
