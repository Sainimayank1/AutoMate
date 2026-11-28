-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "expense_id" UUID,
    "service_record_id" UUID,
    "component_id" UUID,
    "inspection_id" UUID,
    "key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "confirmed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_orphans" (
    "key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "storage_orphans_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "attachments_key_key" ON "attachments"("key");

-- CreateIndex
CREATE INDEX "attachments_expense_id_idx" ON "attachments"("expense_id");

-- CreateIndex
CREATE INDEX "attachments_service_record_id_idx" ON "attachments"("service_record_id");

-- CreateIndex
CREATE INDEX "attachments_component_id_idx" ON "attachments"("component_id");

-- CreateIndex
CREATE INDEX "attachments_inspection_id_idx" ON "attachments"("inspection_id");

-- CreateIndex
CREATE INDEX "attachments_confirmed_at_created_at_idx" ON "attachments"("confirmed_at", "created_at");

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_service_record_id_fkey" FOREIGN KEY ("service_record_id") REFERENCES "service_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "vehicle_components"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Exactly one owner per attachment.
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_one_owner" CHECK (
  num_nonnulls("expense_id", "service_record_id", "component_id", "inspection_id") = 1
);

-- Whatever deletes a file row (the owner's cascade, the account, the user), its stored object is
-- queued here; the storage sweep deletes the object, then the queued row.
CREATE FUNCTION "queue_storage_orphan"() RETURNS trigger AS $$
BEGIN
  INSERT INTO "storage_orphans" ("key") VALUES (OLD."key") ON CONFLICT DO NOTHING;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "document_files_queue_orphan" AFTER DELETE ON "document_files"
  FOR EACH ROW EXECUTE FUNCTION "queue_storage_orphan"();
CREATE TRIGGER "attachments_queue_orphan" AFTER DELETE ON "attachments"
  FOR EACH ROW EXECUTE FUNCTION "queue_storage_orphan"();
CREATE TRIGGER "trip_attachments_queue_orphan" AFTER DELETE ON "trip_attachments"
  FOR EACH ROW EXECUTE FUNCTION "queue_storage_orphan"();
