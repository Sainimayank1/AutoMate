-- CreateEnum
CREATE TYPE "InspectionKind" AS ENUM ('SELF_CHECK', 'PROFESSIONAL');

-- CreateEnum
CREATE TYPE "InspectionCondition" AS ENUM ('GOOD', 'NORMAL', 'MONITOR', 'ATTENTION', 'REPLACE_SOON', 'REPLACED', 'NOT_INSPECTED');

-- CreateTable
CREATE TABLE "inspections" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "kind" "InspectionKind" NOT NULL,
    "template_key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "odometer_km" INTEGER,
    "inspector" TEXT,
    "provider_id" UUID,
    "follow_up_date" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_items" (
    "id" UUID NOT NULL,
    "inspection_id" UUID NOT NULL,
    "position" SMALLINT NOT NULL,
    "area" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "condition" "InspectionCondition" NOT NULL,
    "notes" TEXT,
    "recommended_action" TEXT,
    "component_id" UUID,
    "follow_up_schedule_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "inspection_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inspections_vehicle_id_date_idx" ON "inspections"("vehicle_id", "date");

-- CreateIndex
CREATE INDEX "inspections_provider_id_idx" ON "inspections"("provider_id");

-- CreateIndex
CREATE INDEX "inspection_items_inspection_id_idx" ON "inspection_items"("inspection_id");

-- CreateIndex
CREATE INDEX "inspection_items_component_id_idx" ON "inspection_items"("component_id");

-- CreateIndex
CREATE INDEX "inspection_items_follow_up_schedule_id_idx" ON "inspection_items"("follow_up_schedule_id");

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "service_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_items" ADD CONSTRAINT "inspection_items_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_items" ADD CONSTRAINT "inspection_items_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "vehicle_components"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_items" ADD CONSTRAINT "inspection_items_follow_up_schedule_id_fkey" FOREIGN KEY ("follow_up_schedule_id") REFERENCES "maintenance_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Invariants the database enforces (database.md: CHECK constraints in migration SQL)
ALTER TABLE "inspections"
  ADD CONSTRAINT "inspections_odometer_check" CHECK ("odometer_km" IS NULL OR "odometer_km" >= 0),
  ADD CONSTRAINT "inspections_follow_up_check" CHECK ("follow_up_date" IS NULL OR "follow_up_date" >= "date");
