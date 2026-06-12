-- AlterTable
ALTER TABLE "allocations" ADD COLUMN     "thresholdAutoSuspend" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "thresholdPeriod" TEXT,
ADD COLUMN     "thresholdType" TEXT,
ADD COLUMN     "thresholdValue" DECIMAL(12,2);
