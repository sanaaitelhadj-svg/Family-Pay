-- AlterEnum
ALTER TYPE "OtpPurpose" ADD VALUE 'PASSWORD_RESET';

-- AlterTable
ALTER TABLE "otp_codes" ADD COLUMN     "email" TEXT;

-- CreateTable
CREATE TABLE "password_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "password_history_userId_idx" ON "password_history"("userId");

-- CreateIndex
CREATE INDEX "otp_codes_email_idx" ON "otp_codes"("email");

-- AddForeignKey
ALTER TABLE "password_history" ADD CONSTRAINT "password_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
