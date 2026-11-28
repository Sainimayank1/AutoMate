-- CreateTable
CREATE TABLE "trip_attachments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "cost_id" UUID,
    "key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "confirmed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trip_attachments_key_key" ON "trip_attachments"("key");

-- CreateIndex
CREATE INDEX "trip_attachments_trip_id_created_at_idx" ON "trip_attachments"("trip_id", "created_at");

-- AddForeignKey
ALTER TABLE "trip_attachments" ADD CONSTRAINT "trip_attachments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_attachments" ADD CONSTRAINT "trip_attachments_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_attachments" ADD CONSTRAINT "trip_attachments_cost_id_fkey" FOREIGN KEY ("cost_id") REFERENCES "trip_costs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Up to 10 MB, as for document files.
ALTER TABLE "trip_attachments"
  ADD CONSTRAINT "trip_attachments_size" CHECK ("size" > 0 AND "size" <= 10485760);
