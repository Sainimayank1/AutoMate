-- CreateEnum
CREATE TYPE "ProviderType" AS ENUM ('AUTHORISED', 'INDEPENDENT', 'TYRES', 'BATTERY', 'BODY_SHOP', 'DETAILING', 'ROADSIDE', 'OTHER');

-- AlterTable
ALTER TABLE "service_providers" ADD COLUMN     "address" TEXT,
ADD COLUMN     "archived_at" TIMESTAMPTZ(3),
ADD COLUMN     "city" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "preferred" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "type" "ProviderType" NOT NULL DEFAULT 'OTHER';
