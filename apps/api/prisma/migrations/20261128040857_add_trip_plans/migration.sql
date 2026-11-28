-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('DRAFT', 'PLANNED', 'COMPLETED', 'CANCELLED');

-- DropIndex
DROP INDEX "trips_user_id_date_idx";

-- AlterTable
ALTER TABLE "trips" ADD COLUMN     "est_accommodation" DECIMAL(12,2),
ADD COLUMN     "est_fuel_price" DECIMAL(7,2),
ADD COLUMN     "est_mileage" DECIMAL(5,2),
ADD COLUMN     "est_other" DECIMAL(12,2),
ADD COLUMN     "est_parking" DECIMAL(12,2),
ADD COLUMN     "est_toll" DECIMAL(12,2),
ADD COLUMN     "planned_distance_km" DECIMAL(6,1),
ADD COLUMN     "planned_duration_minutes" INTEGER,
ADD COLUMN     "status" "TripStatus" NOT NULL DEFAULT 'COMPLETED',
ALTER COLUMN "distance_km" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "trips_user_id_status_date_idx" ON "trips"("user_id", "status", "date");

-- Invariants the database enforces (database.md: CHECK constraints in migration SQL)
ALTER TABLE "trips"
  -- A done trip has its distance; a plan (draft, planned, cancelled) has none yet and no readings.
  ADD CONSTRAINT "trips_status_check" CHECK (
    ("status" = 'COMPLETED') = ("distance_km" IS NOT NULL)
    AND ("status" = 'COMPLETED' OR ("start_km" IS NULL AND "end_km" IS NULL))
  ),
  ADD CONSTRAINT "trips_estimates_check" CHECK (
    ("planned_distance_km" IS NULL OR "planned_distance_km" > 0)
    AND ("est_mileage" IS NULL OR "est_mileage" > 0)
    AND ("est_fuel_price" IS NULL OR "est_fuel_price" > 0)
    AND ("est_toll" IS NULL OR "est_toll" >= 0)
    AND ("est_parking" IS NULL OR "est_parking" >= 0)
    AND ("est_accommodation" IS NULL OR "est_accommodation" >= 0)
    AND ("est_other" IS NULL OR "est_other" >= 0)
  );
