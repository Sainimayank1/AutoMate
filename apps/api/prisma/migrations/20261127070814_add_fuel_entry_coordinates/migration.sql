-- AlterTable
ALTER TABLE "fuel_entries" ADD COLUMN     "latitude" DECIMAL(9,6),
ADD COLUMN     "longitude" DECIMAL(9,6);

-- Coordinates are a pair inside the valid ranges (database.md: CHECK constraints in migration SQL)
ALTER TABLE "fuel_entries"
  ADD CONSTRAINT "fuel_entries_coordinates_pair_check" CHECK (("latitude" IS NULL) = ("longitude" IS NULL)),
  ADD CONSTRAINT "fuel_entries_latitude_check" CHECK ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90),
  ADD CONSTRAINT "fuel_entries_longitude_check" CHECK ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180);
