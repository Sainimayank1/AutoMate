-- CreateEnum
CREATE TYPE "ServiceRecordType" AS ENUM ('ROUTINE_SERVICE', 'PREVENTIVE', 'INSPECTION', 'REPAIR', 'COMPONENT_REPLACEMENT', 'EMERGENCY_REPAIR', 'WARRANTY_REPAIR', 'MODIFICATION', 'OTHER');

-- CreateTable
CREATE TABLE "service_providers" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "service_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_records" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "type" "ServiceRecordType" NOT NULL,
    "title" TEXT NOT NULL,
    "category_key" TEXT NOT NULL,
    "service_date" DATE NOT NULL,
    "odometer_km" INTEGER,
    "provider_id" UUID,
    "technician" TEXT,
    "description" TEXT,
    "labour_amount" DECIMAL(12,2),
    "parts_amount" DECIMAL(12,2),
    "other_amount" DECIMAL(12,2),
    "tax_amount" DECIMAL(12,2),
    "discount_amount" DECIMAL(12,2),
    "total_amount" DECIMAL(12,2) NOT NULL,
    "payment_method" "PaymentMethod",
    "warranty_until" DATE,
    "warranty_notes" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "service_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_record_items" (
    "id" UUID NOT NULL,
    "record_id" UUID NOT NULL,
    "position" SMALLINT NOT NULL,
    "name" TEXT NOT NULL,
    "part_number" TEXT,
    "schedule_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "service_record_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_providers_user_id_idx" ON "service_providers"("user_id");

-- CreateIndex
CREATE INDEX "service_records_vehicle_id_service_date_idx" ON "service_records"("vehicle_id", "service_date");

-- CreateIndex
CREATE INDEX "service_records_provider_id_idx" ON "service_records"("provider_id");

-- CreateIndex
CREATE INDEX "service_record_items_schedule_id_idx" ON "service_record_items"("schedule_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_record_items_record_id_schedule_id_key" ON "service_record_items"("record_id", "schedule_id");

-- AddForeignKey
ALTER TABLE "service_providers" ADD CONSTRAINT "service_providers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_records" ADD CONSTRAINT "service_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_records" ADD CONSTRAINT "service_records_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_records" ADD CONSTRAINT "service_records_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "service_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_record_items" ADD CONSTRAINT "service_record_items_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "service_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_record_items" ADD CONSTRAINT "service_record_items_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "maintenance_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Invariants the database enforces (database.md: CHECK constraints in migration SQL)
CREATE UNIQUE INDEX "service_providers_user_name_key" ON "service_providers" ("user_id", lower("name"));

ALTER TABLE "service_records"
  ADD CONSTRAINT "service_records_amounts_check" CHECK (
    "total_amount" >= 0
    AND coalesce("labour_amount", 0) >= 0 AND coalesce("parts_amount", 0) >= 0
    AND coalesce("other_amount", 0) >= 0 AND coalesce("tax_amount", 0) >= 0
    AND coalesce("discount_amount", 0) >= 0),
  ADD CONSTRAINT "service_records_odometer_check" CHECK ("odometer_km" IS NULL OR "odometer_km" >= 0);
