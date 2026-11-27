-- CreateEnum
CREATE TYPE "TripCostCategory" AS ENUM ('TOLL', 'PARKING', 'FOOD', 'ACCOMMODATION', 'OTHER');

-- AlterTable
ALTER TABLE "fuel_entries" ADD COLUMN     "trip_id" UUID;

-- CreateTable
CREATE TABLE "trip_costs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "category" "TripCostCategory" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "date" DATE NOT NULL,
    "vendor" TEXT,
    "payment_method" "PaymentMethod",
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "trip_costs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trip_costs_trip_id_idx" ON "trip_costs"("trip_id");

-- CreateIndex
CREATE INDEX "trip_costs_user_id_date_idx" ON "trip_costs"("user_id", "date");

-- CreateIndex
CREATE INDEX "fuel_entries_trip_id_idx" ON "fuel_entries"("trip_id");

-- AddForeignKey
ALTER TABLE "fuel_entries" ADD CONSTRAINT "fuel_entries_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_costs" ADD CONSTRAINT "trip_costs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_costs" ADD CONSTRAINT "trip_costs_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Invariants the database enforces (database.md: CHECK constraints in migration SQL)
ALTER TABLE "trip_costs" ADD CONSTRAINT "trip_costs_amount_check" CHECK ("amount" > 0);
