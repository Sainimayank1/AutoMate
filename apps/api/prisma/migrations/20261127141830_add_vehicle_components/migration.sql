-- CreateEnum
CREATE TYPE "ComponentCondition" AS ENUM ('NEW', 'GOOD', 'MONITORING', 'NEEDS_ATTENTION', 'REPLACE_SOON', 'FAILED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ComponentState" AS ENUM ('INSTALLED', 'REPLACED', 'REMOVED');

-- CreateEnum
CREATE TYPE "ComponentEventType" AS ENUM ('INSTALLED', 'INSPECTED', 'REPLACED', 'REMOVED');

-- AlterTable
ALTER TABLE "maintenance_schedules" ADD COLUMN     "component_id" UUID;

-- AlterTable
ALTER TABLE "service_record_items" ADD COLUMN     "component_id" UUID;

-- CreateTable
CREATE TABLE "vehicle_components" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT,
    "brand" TEXT,
    "part_number" TEXT,
    "installed_at" DATE,
    "installed_km" INTEGER,
    "provider_id" UUID,
    "install_record_id" UUID,
    "expected_life_km" INTEGER,
    "expected_life_months" SMALLINT,
    "warranty_until" DATE,
    "warranty_km" INTEGER,
    "condition" "ComponentCondition" NOT NULL DEFAULT 'UNKNOWN',
    "state" "ComponentState" NOT NULL DEFAULT 'INSTALLED',
    "removed_at" DATE,
    "removed_km" INTEGER,
    "replaced_by_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "vehicle_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "component_events" (
    "id" UUID NOT NULL,
    "component_id" UUID NOT NULL,
    "type" "ComponentEventType" NOT NULL,
    "date" DATE NOT NULL,
    "odometer_km" INTEGER,
    "condition" "ComponentCondition",
    "record_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "component_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_components_replaced_by_id_key" ON "vehicle_components"("replaced_by_id");

-- CreateIndex
CREATE INDEX "vehicle_components_vehicle_id_state_idx" ON "vehicle_components"("vehicle_id", "state");

-- CreateIndex
CREATE INDEX "vehicle_components_install_record_id_idx" ON "vehicle_components"("install_record_id");

-- CreateIndex
CREATE INDEX "component_events_component_id_date_idx" ON "component_events"("component_id", "date");

-- CreateIndex
CREATE INDEX "component_events_record_id_idx" ON "component_events"("record_id");

-- CreateIndex
CREATE INDEX "service_record_items_component_id_idx" ON "service_record_items"("component_id");

-- AddForeignKey
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "vehicle_components"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_record_items" ADD CONSTRAINT "service_record_items_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "vehicle_components"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_components" ADD CONSTRAINT "vehicle_components_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_components" ADD CONSTRAINT "vehicle_components_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_components" ADD CONSTRAINT "vehicle_components_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "service_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_components" ADD CONSTRAINT "vehicle_components_install_record_id_fkey" FOREIGN KEY ("install_record_id") REFERENCES "service_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_components" ADD CONSTRAINT "vehicle_components_replaced_by_id_fkey" FOREIGN KEY ("replaced_by_id") REFERENCES "vehicle_components"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "component_events" ADD CONSTRAINT "component_events_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "vehicle_components"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "component_events" ADD CONSTRAINT "component_events_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "service_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Invariants the database enforces (database.md: CHECK constraints in migration SQL)
ALTER TABLE "vehicle_components"
  ADD CONSTRAINT "vehicle_components_numbers_check" CHECK (
    ("installed_km" IS NULL OR "installed_km" >= 0) AND ("removed_km" IS NULL OR "removed_km" >= 0)
    AND ("expected_life_km" IS NULL OR "expected_life_km" > 0)
    AND ("expected_life_months" IS NULL OR "expected_life_months" > 0)
    AND ("warranty_km" IS NULL OR "warranty_km" >= 0)),
  -- Taken off (replaced or removed) ⇔ it has a removal date; only a replaced part has a successor.
  ADD CONSTRAINT "vehicle_components_state_check" CHECK (
    ("state" = 'INSTALLED') = ("removed_at" IS NULL)
    AND ("replaced_by_id" IS NULL OR "state" = 'REPLACED')),
  ADD CONSTRAINT "vehicle_components_not_self_check" CHECK ("replaced_by_id" IS NULL OR "replaced_by_id" <> "id");

ALTER TABLE "component_events"
  ADD CONSTRAINT "component_events_odometer_check" CHECK ("odometer_km" IS NULL OR "odometer_km" >= 0);
