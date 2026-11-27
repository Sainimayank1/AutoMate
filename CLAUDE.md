# AutoMate — Car Ownership Assistant

Mobile-first app to manage vehicles, fuel, expenses, maintenance, documents, trips and total cost of ownership. Target market: India (INR, metric units, DD/MM/YYYY).

## Status
New project. No code yet. Tech stack not chosen — ask before picking one.

## Source of truth
`docs/MODULES.md` — full spec for all 12 modules, cross-module rules (§13), and build priority (§14). Read the relevant module section before working on it.

## Build order (do not build everything at once)
- **P0:** Garage (M2) → Fuel (M3) → Expenses (M4) → Dashboard (M1)
- **P1:** Maintenance (M5), Documents (M6), Notifications (M10)
- **P2:** Analytics (M8), Trips (M7)
- **P3:** AI Assistant (M9), Settings (M11), Backup & Export (M12)

## Rules that cut across every module
- Every record belongs to a user, and to a vehicle where applicable. No cross-user access.
- Fuel/service/insurance/trip records that create expenses must link back to their origin — never duplicate money entries.
- Loan principal is not an ownership expense; only interest is.
- Odometer readings are a single, consistent history; flag readings that go backwards.
- Mileage only from reliable full-tank sequences; partial fills roll into the next full fill.
- Maintenance is due on time OR distance, whichever comes first.
- Keep data model offline-sync ready (client-generated IDs, updated-at timestamps).
