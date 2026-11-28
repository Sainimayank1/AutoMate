-- AlterEnum
ALTER TYPE "TripMethod" ADD VALUE 'ROUTE';

-- AlterTable
ALTER TABLE "trips" ADD COLUMN     "destination_lat" DECIMAL(9,6),
ADD COLUMN     "destination_lng" DECIMAL(9,6),
ADD COLUMN     "origin_lat" DECIMAL(9,6),
ADD COLUMN     "origin_lng" DECIMAL(9,6),
ADD COLUMN     "route_duration_minutes" INTEGER,
ADD COLUMN     "route_geometry" TEXT,
ADD COLUMN     "route_provider" TEXT;

-- CreateTable
CREATE TABLE "trip_stops" (
    "id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "arrival_time" TEXT,
    "departure_time" TEXT,
    "notes" TEXT,

    CONSTRAINT "trip_stops_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trip_stops_trip_id_position_key" ON "trip_stops"("trip_id", "position");

-- AddForeignKey
ALTER TABLE "trip_stops" ADD CONSTRAINT "trip_stops_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Invariants the database enforces (database.md: CHECK constraints in migration SQL)
ALTER TABLE "trips"
  ADD CONSTRAINT "trips_points_check" CHECK (
    ("origin_lat" IS NULL) = ("origin_lng" IS NULL)
    AND ("destination_lat" IS NULL) = ("destination_lng" IS NULL)
  ),
  -- A route is stored only for route trips, and a route trip always has its route.
  ADD CONSTRAINT "trips_route_check" CHECK (
    ("method" = 'ROUTE') = ("route_geometry" IS NOT NULL AND "route_provider" IS NOT NULL)
  );
ALTER TABLE "trip_stops"
  ADD CONSTRAINT "trip_stops_point_check" CHECK (("latitude" IS NULL) = ("longitude" IS NULL)),
  ADD CONSTRAINT "trip_stops_position_check" CHECK ("position" >= 0);
