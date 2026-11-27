-- CreateEnum
CREATE TYPE "FuelType" AS ENUM ('PETROL', 'DIESEL', 'CNG', 'ELECTRIC', 'HYBRID');

-- CreateEnum
CREATE TYPE "Transmission" AS ENUM ('MANUAL', 'AMT', 'IMT', 'CVT', 'DCT', 'AUTOMATIC');

-- CreateEnum
CREATE TYPE "VehicleCategory" AS ENUM ('HATCHBACK', 'SEDAN', 'SUV', 'MUV', 'OTHER');

-- CreateEnum
CREATE TYPE "OwnershipType" AS ENUM ('OWNED', 'FINANCED');

-- CreateTable
CREATE TABLE "vehicles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "variant" TEXT,
    "manufacturing_year" SMALLINT NOT NULL,
    "category" "VehicleCategory" NOT NULL,
    "registration_number" TEXT NOT NULL,
    "registration_date" DATE,
    "fuel_type" "FuelType" NOT NULL,
    "transmission" "Transmission" NOT NULL,
    "engine_capacity_cc" INTEGER,
    "engine_configuration" TEXT,
    "fuel_tank_capacity_l" SMALLINT,
    "colour" TEXT,
    "ownership_type" "OwnershipType" NOT NULL,
    "purchase_date" DATE,
    "purchase_price" DECIMAL(12,2),
    "odometer_km" INTEGER NOT NULL,
    "vin" TEXT,
    "engine_number" TEXT,
    "fuel_specification" TEXT,
    "engine_oil_specification" TEXT,
    "tyre_size" TEXT,
    "battery_type" TEXT,
    "warranty_expiry_date" DATE,
    "warranty_km_limit" INTEGER,
    "notes" TEXT,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vehicles_user_id_archived_at_idx" ON "vehicles"("user_id", "archived_at");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_user_id_registration_number_key" ON "vehicles"("user_id", "registration_number");

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Invariants the database enforces (database.md: CHECK constraints in migration SQL)
ALTER TABLE "vehicles"
  ADD CONSTRAINT "vehicles_odometer_km_check" CHECK ("odometer_km" >= 0),
  ADD CONSTRAINT "vehicles_purchase_price_check" CHECK ("purchase_price" IS NULL OR "purchase_price" >= 0),
  ADD CONSTRAINT "vehicles_manufacturing_year_check" CHECK ("manufacturing_year" BETWEEN 1950 AND 2100),
  ADD CONSTRAINT "vehicles_engine_capacity_cc_check" CHECK ("engine_capacity_cc" IS NULL OR "engine_capacity_cc" > 0),
  ADD CONSTRAINT "vehicles_fuel_tank_capacity_l_check" CHECK ("fuel_tank_capacity_l" IS NULL OR "fuel_tank_capacity_l" > 0);
