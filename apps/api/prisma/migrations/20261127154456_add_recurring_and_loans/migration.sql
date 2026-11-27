-- CreateEnum
CREATE TYPE "RecurrenceUnit" AS ENUM ('DAY', 'WEEK', 'MONTH', 'YEAR');

-- CreateEnum
CREATE TYPE "RecurringStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LoanMethod" AS ENUM ('REDUCING', 'FLAT');

-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "loan_id" UUID;

-- CreateTable
CREATE TABLE "recurring_expenses" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "category_id" UUID NOT NULL,
    "subcategory_id" UUID,
    "payment_method" "PaymentMethod",
    "vendor" TEXT,
    "notes" TEXT,
    "every" INTEGER NOT NULL DEFAULT 1,
    "unit" "RecurrenceUnit" NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "reminder_days" INTEGER NOT NULL DEFAULT 3,
    "status" "RecurringStatus" NOT NULL DEFAULT 'ACTIVE',
    "active_from" DATE NOT NULL,
    "loan_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "recurring_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_occurrences" (
    "id" UUID NOT NULL,
    "recurring_id" UUID NOT NULL,
    "due_date" DATE NOT NULL,
    "postponed_to" DATE,
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "expense_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "recurring_occurrences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_loans" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "lender" TEXT NOT NULL,
    "account_number" TEXT,
    "principal" DECIMAL(12,2) NOT NULL,
    "annual_rate" DECIMAL(5,2) NOT NULL,
    "tenure_months" INTEGER NOT NULL,
    "first_emi_date" DATE NOT NULL,
    "method" "LoanMethod" NOT NULL DEFAULT 'REDUCING',
    "processing_fee" DECIMAL(12,2),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "vehicle_loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_rate_changes" (
    "id" UUID NOT NULL,
    "loan_id" UUID NOT NULL,
    "effective_from" DATE NOT NULL,
    "annual_rate" DECIMAL(5,2) NOT NULL,
    "keep_emi" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "loan_rate_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recurring_expenses_loan_id_key" ON "recurring_expenses"("loan_id");

-- CreateIndex
CREATE INDEX "recurring_expenses_user_id_vehicle_id_idx" ON "recurring_expenses"("user_id", "vehicle_id");

-- CreateIndex
CREATE UNIQUE INDEX "recurring_occurrences_expense_id_key" ON "recurring_occurrences"("expense_id");

-- CreateIndex
CREATE UNIQUE INDEX "recurring_occurrences_recurring_id_due_date_key" ON "recurring_occurrences"("recurring_id", "due_date");

-- CreateIndex
CREATE INDEX "vehicle_loans_user_id_vehicle_id_idx" ON "vehicle_loans"("user_id", "vehicle_id");

-- CreateIndex
CREATE UNIQUE INDEX "loan_rate_changes_loan_id_effective_from_key" ON "loan_rate_changes"("loan_id", "effective_from");

-- CreateIndex
CREATE INDEX "expenses_loan_id_idx" ON "expenses"("loan_id");

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "vehicle_loans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "vehicle_loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_occurrences" ADD CONSTRAINT "recurring_occurrences_recurring_id_fkey" FOREIGN KEY ("recurring_id") REFERENCES "recurring_expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_occurrences" ADD CONSTRAINT "recurring_occurrences_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_loans" ADD CONSTRAINT "vehicle_loans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_loans" ADD CONSTRAINT "vehicle_loans_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_rate_changes" ADD CONSTRAINT "loan_rate_changes_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "vehicle_loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Invariants the database keeps (docs/architecture/expenses.md §6).
ALTER TABLE "recurring_expenses"
  ADD CONSTRAINT "recurring_expenses_amount_positive" CHECK ("amount" > 0),
  ADD CONSTRAINT "recurring_expenses_every_positive" CHECK ("every" BETWEEN 1 AND 365),
  ADD CONSTRAINT "recurring_expenses_reminder_days" CHECK ("reminder_days" BETWEEN 0 AND 60),
  ADD CONSTRAINT "recurring_expenses_end_after_start" CHECK ("end_date" IS NULL OR "end_date" >= "start_date");

ALTER TABLE "vehicle_loans"
  ADD CONSTRAINT "vehicle_loans_principal_positive" CHECK ("principal" > 0),
  ADD CONSTRAINT "vehicle_loans_rate_range" CHECK ("annual_rate" >= 0 AND "annual_rate" <= 50),
  ADD CONSTRAINT "vehicle_loans_tenure_range" CHECK ("tenure_months" BETWEEN 1 AND 120),
  ADD CONSTRAINT "vehicle_loans_fee_not_negative" CHECK ("processing_fee" IS NULL OR "processing_fee" >= 0);

ALTER TABLE "loan_rate_changes"
  ADD CONSTRAINT "loan_rate_changes_rate_range" CHECK ("annual_rate" >= 0 AND "annual_rate" <= 50);
