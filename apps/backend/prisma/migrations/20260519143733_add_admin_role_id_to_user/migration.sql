-- AlterTable
ALTER TABLE "users" ADD COLUMN     "adminRoleId" VARCHAR(30);

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_adminRoleId_fkey" FOREIGN KEY ("adminRoleId") REFERENCES "admin_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
