# Expenses (M4): money rules and design

The financial layer of AutoMate. Product scope: [MODULES.md M4](../MODULES.md#module-4--expense-management); API contract: [api-conventions.md](api-conventions.md); data rules: [database.md](database.md).

**Ownership:** the module that owns an operational record stays its source of truth (Fuel owns fill-ups, Maintenance will own service records). Expenses owns the _financial_ view: one expense row per money movement, linked back to its source by `(source, sourceId)`, which is unique, so nothing is counted twice.

## 1. Cost classes and the three money views

Every top-level category has a **cost class**; subcategories inherit it. The class decides which view an expense counts in.

| Cost class  | Examples                                                   | Operating cost | Cash outflow  | Economic ownership cost   |
| ----------- | ---------------------------------------------------------- | -------------- | ------------- | ------------------------- |
| `OPERATING` | Fuel, maintenance, repairs, tolls, parking, washing, other | yes            | yes           | yes                       |
| `OWNERSHIP` | Insurance, PUC, registration, road tax, permits, fines     | no             | yes           | yes                       |
| `FINANCING` | EMI and other loan payments                                | no             | the whole EMI | interest and charges only |
| `CAPITAL`   | Accessories and upgrades                                   | no             | yes           | yes                       |

- **Operating cost** (running cost): what using the vehicle costs. **Cost per km** = operating cost ÷ km driven in the period (from odometer readings; not shown with fewer than two readings).
- **Cash outflow**: everything actually paid, including the full EMI. Excludes the purchase / down payment (shown separately) and unpaid scheduled payments.
- **Economic ownership cost**: operating + ownership + financing charges (interest, processing and prepayment fees) + capital + **depreciation**, always labelled as an estimate (standard Indian motor-insurance depreciation schedule on the purchase price).
- **Loan principal** is cash outflow only: it reduces the loan, it isn't a cost.
- **Refunds** reduce whichever views their original counts in. **Months** are IST calendar months.

## 2. Records

| Rule            | How                                                                                                                                                                                                                                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Money           | `Decimal(12, 2)` in the database, decimal strings in the API, exact integer paise in shared code (`toPaise`, `fromPaise`, `splitEqually`). Never floats.                                                                                                                                              |
| Categories      | System tree in `SYSTEM_EXPENSE_CATEGORIES` (`@automate/shared`), seeded by key (`prisma:seed`, idempotent). Users add custom categories and subcategories (unique names among siblings, ignoring case); a used custom category can be disabled but not deleted. Fuel accepts no custom subcategories. |
| Fuel            | No manual fuel expenses: fuel comes from fill-ups (phase 2 links them).                                                                                                                                                                                                                               |
| Loan payments   | A `FINANCING` expense must carry principal, interest and charges that add up to the amount (checked in shared code, the API and a database CHECK). Finance subcategories preset the split (Loan interest = all interest, Part-prepayment = all principal); a Vehicle EMI is entered split.            |
| Shared expenses | Explicit, never assumed: one row per vehicle with a common `sharedGroupId`, split equally (to the paisa, the first vehicles take the spare paise) or by custom shares that must add up. Edited and deleted as one. No odometer, loan split or parts/labour on shared expenses.                        |
| Refunds         | Their own row (`kind REFUND`, `refundOfId`, reason Refund / Reimbursement / Adjustment); the original is never changed. Total refunds can't exceed the original; a refund can't be dated before it; loan payments aren't refundable. Refunds follow their original to a new vehicle or category.      |
| Linked records  | `source` FUEL / MAINTENANCE / TRIP rows are read-only here (409 "Edit it there"); their module creates, updates and deletes them in its own transaction. Bulk actions skip them.                                                                                                                      |
| Vehicles        | Every write locks the vehicles it touches (in id order) and refuses archived ones. An expense's odometer reading raises the vehicle's, like fuel.                                                                                                                                                     |
| Duplicates      | The web sends a client-generated id with every new expense, so a retried save can't create a second row.                                                                                                                                                                                              |
| Audit           | Every create, update, delete, refund and bulk change writes a structured log line (no amounts or personal data beyond ids).                                                                                                                                                                           |

## 3. API

| Route                                                                  | Notes                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /expenses`                                                        | Paginated. `vehicleId` (omit for all vehicles), `from`/`to`, `categoryId` (category or subcategory), `paymentMethod`, `source`, `kind`, `minAmount`/`maxAmount`, `search`, `sort` (`date_desc`, `date_asc`, `amount_desc`, `amount_asc`). |
| `POST /expenses`, `GET/PATCH/DELETE /expenses/:id`                     | PATCH merges onto the stored record and re-checks it whole; a shared expense's new amount needs its allocation.                                                                                                                           |
| `POST /expenses/:id/refunds`                                           | Returns the original with its refunds.                                                                                                                                                                                                    |
| `POST /expenses/bulk/delete`, `POST /expenses/bulk/category`           | Up to 100 ids; returns `{ affected, skipped }`.                                                                                                                                                                                           |
| `GET/POST /expense-categories`, `PATCH/DELETE /expense-categories/:id` | Paginated tree (top-level categories with subcategories and usage counts).                                                                                                                                                                |

## 4. Phases

Built: **1 · Core** (categories, add / edit / delete / duplicate, transactions with filters, sorting, paging and CSV export, details, shared expenses, refunds, bulk actions, manual loan split).

Next, one at a time, each after approval: 2 · Fuel link (fill-ups create their expense; backfill), 3 · Overview, 4 · Recurring payments and the Vehicle Loan (amortisation schedule, reducing balance by default, flat optional, prepayments and RBI-style rate changes), 5 · Budgets, 6 · Ownership cost, 7 · Insights, 8 · CSV import and the printable report. Receipt attachments and receipt scanning are out of scope (no file storage in this project).
