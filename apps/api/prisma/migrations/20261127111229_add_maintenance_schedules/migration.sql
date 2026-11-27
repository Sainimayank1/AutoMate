-- CreateEnum
CREATE TYPE "MaintenancePriority" AS ENUM ('LOW', 'NORMAL', 'HIGH');

-- CreateTable
CREATE TABLE "maintenance_schedules" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category_key" TEXT NOT NULL,
    "interval_km" INTEGER,
    "interval_months" SMALLINT,
    "due_date" DATE,
    "due_km" INTEGER,
    "last_done_date" DATE,
    "last_done_km" INTEGER,
    "added_odometer_km" INTEGER NOT NULL,
    "reminders_enabled" BOOLEAN NOT NULL DEFAULT true,
    "lead_days" SMALLINT,
    "lead_km" INTEGER,
    "priority" "MaintenancePriority" NOT NULL DEFAULT 'NORMAL',
    "notes" TEXT,
    "paused_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "maintenance_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "maintenance_schedules_vehicle_id_idx" ON "maintenance_schedules"("vehicle_id");

-- AddForeignKey
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Invariants the database enforces (database.md: CHECK constraints in migration SQL)
ALTER TABLE "maintenance_schedules"
  -- Repeats (an interval) or happens once (a fixed due), never both or neither.
  ADD CONSTRAINT "maintenance_schedules_kind_check" CHECK (
    ("interval_km" IS NOT NULL OR "interval_months" IS NOT NULL)
    <> ("due_date" IS NOT NULL OR "due_km" IS NOT NULL)),
  -- "Last done" belongs to repeating schedules.
  ADD CONSTRAINT "maintenance_schedules_last_done_check" CHECK (
    ("last_done_date" IS NULL AND "last_done_km" IS NULL)
    OR "interval_km" IS NOT NULL OR "interval_months" IS NOT NULL),
  ADD CONSTRAINT "maintenance_schedules_interval_check" CHECK (
    ("interval_km" IS NULL OR "interval_km" > 0) AND ("interval_months" IS NULL OR "interval_months" > 0)),
  ADD CONSTRAINT "maintenance_schedules_odometer_check" CHECK (
    "added_odometer_km" >= 0 AND ("due_km" IS NULL OR "due_km" >= 0)
    AND ("last_done_km" IS NULL OR "last_done_km" >= 0)),
  ADD CONSTRAINT "maintenance_schedules_lead_check" CHECK (
    ("lead_days" IS NULL OR "lead_days" >= 0) AND ("lead_km" IS NULL OR "lead_km" >= 0));
