-- CreateEnum
CREATE TYPE "ThemePreference" AS ENUM ('DARK', 'LIGHT', 'SYSTEM');

-- AlterTable
ALTER TABLE "user_preferences" ADD COLUMN     "default_vehicle_id" UUID,
ADD COLUMN     "notify_documents" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notify_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notify_maintenance" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notify_monthly_summary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notify_payments" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notify_trips" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "theme" "ThemePreference" NOT NULL DEFAULT 'DARK';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatar_key" TEXT;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_default_vehicle_id_fkey" FOREIGN KEY ("default_vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
