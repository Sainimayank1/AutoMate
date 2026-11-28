-- CreateEnum
CREATE TYPE "BudgetPeriod" AS ENUM ('MONTH', 'YEAR');

-- CreateTable
CREATE TABLE "expense_budgets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "category_id" UUID,
    "period" "BudgetPeriod" NOT NULL DEFAULT 'MONTH',
    "amount" DECIMAL(12,2) NOT NULL,
    "alert_percent" INTEGER NOT NULL DEFAULT 80,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "expense_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "expense_budgets_user_id_vehicle_id_idx" ON "expense_budgets"("user_id", "vehicle_id");

-- CreateIndex
CREATE UNIQUE INDEX "expense_budgets_vehicle_id_category_id_key" ON "expense_budgets"("vehicle_id", "category_id");

-- AddForeignKey
ALTER TABLE "expense_budgets" ADD CONSTRAINT "expense_budgets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_budgets" ADD CONSTRAINT "expense_budgets_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_budgets" ADD CONSTRAINT "expense_budgets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Checks the API also makes (docs/architecture/expenses.md §7).
ALTER TABLE "expense_budgets"
  ADD CONSTRAINT "expense_budgets_amount_positive" CHECK ("amount" > 0),
  ADD CONSTRAINT "expense_budgets_alert_percent" CHECK ("alert_percent" BETWEEN 1 AND 100);
