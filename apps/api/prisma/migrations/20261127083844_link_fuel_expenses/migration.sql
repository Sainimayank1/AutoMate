-- Fuel → Expenses (Expenses phase 2): every existing fill-up gets its linked expense, exactly the
-- fields toFuelExpense() (src/modules/fuel/fuel-expense.ts) writes for new and edited fill-ups.
-- Idempotent: ON CONFLICT on the (source, source_id) unique key.

-- Fuel's system categories. Migrations run before the seed on a first deploy, so make sure they
-- exist; the seed later upserts the same keys (ids are kept).
INSERT INTO "expense_categories" ("id", "key", "name", "icon", "cost_class", "sort_order", "updated_at")
VALUES (gen_random_uuid(), 'FUEL', 'Fuel', 'fuel', 'OPERATING', 0, now())
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "expense_categories" ("id", "key", "name", "icon", "parent_id", "sort_order", "updated_at")
SELECT gen_random_uuid(), item.key, item.name, 'fuel', parent."id", item.position, now()
FROM (
  VALUES ('FUEL.PETROL', 'Petrol', 0), ('FUEL.DIESEL', 'Diesel', 1),
         ('FUEL.CNG', 'CNG', 2), ('FUEL.EV_CHARGING', 'EV charging', 3)
) AS item ("key", "name", "position")
CROSS JOIN "expense_categories" parent
WHERE parent."key" = 'FUEL'
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "expenses" (
  "id", "user_id", "vehicle_id", "kind", "title", "amount", "date", "category_id", "subcategory_id",
  "payment_method", "vendor", "odometer_km", "description", "notes", "source", "source_id", "updated_at"
)
SELECT
  gen_random_uuid(), fill."user_id", fill."vehicle_id", 'EXPENSE',
  left(coalesce(fill."station_name", 'Fuel fill-up'), 120),
  fill."total_amount",
  (fill."filled_at" AT TIME ZONE 'Asia/Kolkata')::date,
  fuel."id", sub."id",
  fill."payment_method", fill."station_name", fill."odometer_km",
  trim_scale(fill."quantity") || ' ' || unit.label || ' at ₹' || trim_scale(fill."price_per_unit") || '/' || unit.label,
  fill."notes", 'FUEL', fill."id", now()
FROM "fuel_entries" fill
JOIN "expense_categories" fuel ON fuel."key" = 'FUEL'
JOIN "expense_categories" sub ON sub."key" = CASE fill."fuel_type"
  WHEN 'DIESEL' THEN 'FUEL.DIESEL'
  WHEN 'CNG' THEN 'FUEL.CNG'
  WHEN 'ELECTRIC' THEN 'FUEL.EV_CHARGING'
  ELSE 'FUEL.PETROL'
END
CROSS JOIN LATERAL (
  SELECT CASE fill."fuel_type" WHEN 'CNG' THEN 'kg' WHEN 'ELECTRIC' THEN 'kWh' ELSE 'L' END AS label
) unit
ON CONFLICT ("source", "source_id") DO NOTHING;
