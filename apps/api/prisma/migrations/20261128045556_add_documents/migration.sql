-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('REGISTRATION', 'INSURANCE', 'PUC', 'DRIVING_LICENCE', 'WARRANTY', 'ROADSIDE_ASSISTANCE', 'LOAN', 'SERVICE_INVOICE', 'PURCHASE_INVOICE', 'OTHER');

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "vehicle_id" UUID,
    "type" "DocumentType" NOT NULL,
    "name" TEXT NOT NULL,
    "number" TEXT,
    "issuer" TEXT,
    "issue_date" DATE,
    "expiry_date" DATE,
    "notes" TEXT,
    "reminder_days" INTEGER[] DEFAULT ARRAY[30, 7, 1]::INTEGER[],
    "remind_on" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_files" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "document_id" UUID,
    "key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "confirmed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "documents_user_id_vehicle_id_idx" ON "documents"("user_id", "vehicle_id");

-- CreateIndex
CREATE INDEX "documents_user_id_expiry_date_idx" ON "documents"("user_id", "expiry_date");

-- CreateIndex
CREATE UNIQUE INDEX "document_files_key_key" ON "document_files"("key");

-- CreateIndex
CREATE INDEX "document_files_user_id_document_id_idx" ON "document_files"("user_id", "document_id");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_files" ADD CONSTRAINT "document_files_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_files" ADD CONSTRAINT "document_files_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Checks the API also makes (docs/architecture/documents.md).
ALTER TABLE "documents"
  ADD CONSTRAINT "documents_expiry_after_issue" CHECK ("expiry_date" IS NULL OR "issue_date" IS NULL OR "expiry_date" >= "issue_date"),
  ADD CONSTRAINT "documents_reminders" CHECK (cardinality("reminder_days") <= 5);
ALTER TABLE "document_files"
  ADD CONSTRAINT "document_files_size" CHECK ("size" > 0 AND "size" <= 10485760);
