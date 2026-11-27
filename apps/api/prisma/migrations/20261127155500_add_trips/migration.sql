-- CreateEnum
CREATE TYPE "TripMethod" AS ENUM ('ODOMETER', 'DISTANCE');

-- CreateTable
CREATE TABLE "trip_categories" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "key" TEXT,
    "name" TEXT NOT NULL,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "trip_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trips" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "method" "TripMethod" NOT NULL,
    "title" TEXT,
    "date" DATE NOT NULL,
    "end_date" DATE,
    "start_time" TEXT,
    "end_time" TEXT,
    "start_km" INTEGER,
    "end_km" INTEGER,
    "distance_km" DECIMAL(6,1) NOT NULL,
    "origin" TEXT,
    "destination" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trip_categories_key_key" ON "trip_categories"("key");

-- CreateIndex
CREATE INDEX "trip_categories_user_id_idx" ON "trip_categories"("user_id");

-- CreateIndex
CREATE INDEX "trips_vehicle_id_date_idx" ON "trips"("vehicle_id", "date");

-- CreateIndex
CREATE INDEX "trips_user_id_date_idx" ON "trips"("user_id", "date");

-- CreateIndex
CREATE INDEX "trips_category_id_idx" ON "trips"("category_id");

-- AddForeignKey
ALTER TABLE "trip_categories" ADD CONSTRAINT "trip_categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "trip_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Invariants the database enforces (database.md: CHECK constraints in migration SQL)
ALTER TABLE "trips"
  ADD CONSTRAINT "trips_distance_check" CHECK ("distance_km" > 0),
  ADD CONSTRAINT "trips_odometer_check" CHECK (
    ("method" = 'ODOMETER') = ("start_km" IS NOT NULL AND "end_km" IS NOT NULL)
    AND ("start_km" IS NULL OR "end_km" IS NULL OR "end_km" > "start_km")
  ),
  ADD CONSTRAINT "trips_end_date_check" CHECK ("end_date" IS NULL OR "end_date" >= "date"),
  ADD CONSTRAINT "trips_time_check" CHECK (
    ("start_time" IS NULL OR "start_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
    AND ("end_time" IS NULL OR "end_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
  );

-- A system type has a key and no user; a user's own has neither.
ALTER TABLE "trip_categories"
  ADD CONSTRAINT "trip_categories_owner_check" CHECK (("user_id" IS NULL) = ("key" IS NOT NULL));
CREATE UNIQUE INDEX "trip_categories_user_name_key" ON "trip_categories" ("user_id", lower("name"))
  WHERE "user_id" IS NOT NULL;

-- The system trip types (SYSTEM_TRIP_CATEGORIES in @automate/shared).
INSERT INTO "trip_categories" ("id", "key", "name", "updated_at") VALUES
  (gen_random_uuid(), 'PERSONAL', 'Personal', now()),
  (gen_random_uuid(), 'COMMUTE', 'Commute', now()),
  (gen_random_uuid(), 'BUSINESS', 'Business', now()),
  (gen_random_uuid(), 'ROAD_TRIP', 'Road trip', now()),
  (gen_random_uuid(), 'ERRANDS', 'Errands', now()),
  (gen_random_uuid(), 'AIRPORT_RAILWAY', 'Airport / railway', now()),
  (gen_random_uuid(), 'OTHER', 'Other', now())
ON CONFLICT ("key") DO NOTHING;
