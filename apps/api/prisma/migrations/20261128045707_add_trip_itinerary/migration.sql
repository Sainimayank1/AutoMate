-- AlterTable
ALTER TABLE "trip_stops" ADD COLUMN     "day" INTEGER,
ADD COLUMN     "overnight" BOOLEAN NOT NULL DEFAULT false;

-- A stop's day starts at 1 (the trip's start date).
ALTER TABLE "trip_stops" ADD CONSTRAINT "trip_stops_day_check" CHECK ("day" IS NULL OR "day" >= 1);
