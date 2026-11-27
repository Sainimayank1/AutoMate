-- CreateEnum
CREATE TYPE "CostClass" AS ENUM ('OPERATING', 'OWNERSHIP', 'FINANCING', 'CAPITAL');

-- CreateEnum
CREATE TYPE "ExpenseSource" AS ENUM ('MANUAL', 'FUEL', 'MAINTENANCE', 'TRIP', 'RECURRING', 'IMPORT');

-- CreateEnum
CREATE TYPE "ExpenseKind" AS ENUM ('EXPENSE', 'REFUND');

-- CreateEnum
CREATE TYPE "RefundReason" AS ENUM ('REFUND', 'REIMBURSEMENT', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "parent_id" UUID,
    "key" TEXT,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "cost_class" "CostClass",
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "kind" "ExpenseKind" NOT NULL DEFAULT 'EXPENSE',
    "title" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "date" DATE NOT NULL,
    "category_id" UUID NOT NULL,
    "subcategory_id" UUID,
    "payment_method" "PaymentMethod",
    "vendor" TEXT,
    "odometer_km" INTEGER,
    "description" TEXT,
    "notes" TEXT,
    "source" "ExpenseSource" NOT NULL DEFAULT 'MANUAL',
    "source_id" UUID,
    "shared_group_id" UUID,
    "refund_of_id" UUID,
    "refund_reason" "RefundReason",
    "principal_amount" DECIMAL(12,2),
    "interest_amount" DECIMAL(12,2),
    "charges_amount" DECIMAL(12,2),
    "loan_reference" TEXT,
    "loan_outstanding" DECIMAL(12,2),
    "service_type" TEXT,
    "parts_replaced" TEXT,
    "parts_amount" DECIMAL(12,2),
    "labour_amount" DECIMAL(12,2),
    "warranty_until" DATE,
    "provider" TEXT,
    "policy_number" TEXT,
    "policy_start" DATE,
    "policy_end" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_key_key" ON "expense_categories"("key");

-- CreateIndex
CREATE INDEX "expense_categories_user_id_idx" ON "expense_categories"("user_id");

-- CreateIndex
CREATE INDEX "expense_categories_parent_id_idx" ON "expense_categories"("parent_id");

-- CreateIndex
CREATE INDEX "expenses_user_id_date_idx" ON "expenses"("user_id", "date");

-- CreateIndex
CREATE INDEX "expenses_vehicle_id_date_idx" ON "expenses"("vehicle_id", "date");

-- CreateIndex
CREATE INDEX "expenses_shared_group_id_idx" ON "expenses"("shared_group_id");

-- CreateIndex
CREATE INDEX "expenses_refund_of_id_idx" ON "expenses"("refund_of_id");

-- CreateIndex
CREATE UNIQUE INDEX "expenses_source_source_id_key" ON "expenses"("source", "source_id");

-- AddForeignKey
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "expense_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_refund_of_id_fkey" FOREIGN KEY ("refund_of_id") REFERENCES "expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Invariants the database enforces (database.md: CHECK constraints in migration SQL)

-- Category names are unique per owner and parent, case-insensitively (system rows have no owner).
CREATE UNIQUE INDEX "expense_categories_owner_parent_name_key"
  ON "expense_categories" ("user_id", "parent_id", lower("name")) NULLS NOT DISTINCT;

ALTER TABLE "expense_categories"
  -- A top-level category says which money views it counts in; subcategories inherit it.
  ADD CONSTRAINT "expense_categories_cost_class_check"
    CHECK (("parent_id" IS NULL) = ("cost_class" IS NOT NULL)),
  -- Only system categories have keys, and only they have no owner.
  ADD CONSTRAINT "expense_categories_system_check" CHECK (("user_id" IS NULL) = ("key" IS NOT NULL));

ALTER TABLE "expenses"
  ADD CONSTRAINT "expenses_amount_check" CHECK ("amount" > 0),
  ADD CONSTRAINT "expenses_odometer_km_check" CHECK ("odometer_km" IS NULL OR "odometer_km" >= 0),
  ADD CONSTRAINT "expenses_components_check" CHECK (
    coalesce("principal_amount", 0) >= 0 AND coalesce("interest_amount", 0) >= 0
    AND coalesce("charges_amount", 0) >= 0 AND coalesce("loan_outstanding", 0) >= 0
  ),
  -- A loan payment's split, when present, adds up to the amount.
  ADD CONSTRAINT "expenses_finance_split_check" CHECK (
    ("principal_amount" IS NULL AND "interest_amount" IS NULL AND "charges_amount" IS NULL)
    OR coalesce("principal_amount", 0) + coalesce("interest_amount", 0) + coalesce("charges_amount", 0) = "amount"
  ),
  ADD CONSTRAINT "expenses_parts_labour_check" CHECK (
    coalesce("parts_amount", 0) >= 0 AND coalesce("labour_amount", 0) >= 0
    AND coalesce("parts_amount", 0) + coalesce("labour_amount", 0) <= "amount"
  ),
  -- A refund points at its original and says why; an expense does neither.
  ADD CONSTRAINT "expenses_refund_shape_check" CHECK (
    ("kind" = 'REFUND') = ("refund_of_id" IS NOT NULL)
    AND ("kind" = 'REFUND') = ("refund_reason" IS NOT NULL)
  ),
  -- A linked record always names its source row.
  ADD CONSTRAINT "expenses_source_check" CHECK (("source" IN ('MANUAL', 'IMPORT')) OR "source_id" IS NOT NULL);
