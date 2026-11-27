-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('UPI', 'CARD', 'CASH', 'NET_BANKING', 'WALLET', 'OTHER');

-- CreateTable
CREATE TABLE "fuel_entries" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "filled_at" TIMESTAMPTZ(3) NOT NULL,
    "odometer_km" INTEGER NOT NULL,
    "fuel_type" "FuelType" NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "price_per_unit" DECIMAL(10,3) NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "is_full_tank" BOOLEAN NOT NULL,
    "missed_previous" BOOLEAN NOT NULL DEFAULT false,
    "station_name" TEXT,
    "location" TEXT,
    "payment_method" "PaymentMethod",
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "fuel_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fuel_entries_vehicle_id_filled_at_idx" ON "fuel_entries"("vehicle_id", "filled_at");

-- AddForeignKey
ALTER TABLE "fuel_entries" ADD CONSTRAINT "fuel_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_entries" ADD CONSTRAINT "fuel_entries_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Invariants the database enforces (database.md: CHECK constraints in migration SQL)
ALTER TABLE "fuel_entries"
  ADD CONSTRAINT "fuel_entries_odometer_km_check" CHECK ("odometer_km" >= 0),
  ADD CONSTRAINT "fuel_entries_quantity_check" CHECK ("quantity" > 0),
  ADD CONSTRAINT "fuel_entries_price_per_unit_check" CHECK ("price_per_unit" > 0),
  ADD CONSTRAINT "fuel_entries_total_amount_check" CHECK ("total_amount" > 0);
