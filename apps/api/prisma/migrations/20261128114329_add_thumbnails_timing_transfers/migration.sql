-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');

-- AlterTable
ALTER TABLE "attachments" ADD COLUMN     "thumb_key" TEXT;

-- AlterTable
ALTER TABLE "document_files" ADD COLUMN     "thumb_key" TEXT;

-- AlterTable
ALTER TABLE "user_preferences" ADD COLUMN     "document_reminder_days" INTEGER[] DEFAULT ARRAY[30, 7, 1]::INTEGER[],
ADD COLUMN     "payment_reminder_days" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "service_lead_days" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "service_lead_km" INTEGER NOT NULL DEFAULT 1000;

-- CreateTable
CREATE TABLE "vehicle_transfers" (
    "id" UUID NOT NULL,
    "from_user_id" UUID NOT NULL,
    "vehicle_id" UUID,
    "vehicle_name" TEXT NOT NULL,
    "registration_number" TEXT NOT NULL,
    "to_email" TEXT NOT NULL,
    "to_user_id" UUID,
    "status" "TransferStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "decided_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vehicle_transfers_to_email_status_idx" ON "vehicle_transfers"("to_email", "status");

-- CreateIndex
CREATE INDEX "vehicle_transfers_from_user_id_status_idx" ON "vehicle_transfers"("from_user_id", "status");

-- AddForeignKey
ALTER TABLE "vehicle_transfers" ADD CONSTRAINT "vehicle_transfers_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_transfers" ADD CONSTRAINT "vehicle_transfers_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Thumbnails are stored objects too: queue them with their file (tables without the column,
-- such as trip_attachments, read null and queue only the key).
CREATE OR REPLACE FUNCTION "queue_storage_orphan"() RETURNS trigger AS $$
DECLARE
  thumb text := to_jsonb(OLD) ->> 'thumb_key';
BEGIN
  INSERT INTO "storage_orphans" ("key") VALUES (OLD."key") ON CONFLICT DO NOTHING;
  IF thumb IS NOT NULL THEN
    INSERT INTO "storage_orphans" ("key") VALUES (thumb) ON CONFLICT DO NOTHING;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
