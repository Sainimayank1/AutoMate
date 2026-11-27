# Trips (M7)

Keeps each vehicle's journeys: where, when, how far, what kind of trip, and (in later phases) what it cost, the route and the plan. Product scope: [MODULES.md M7](../MODULES.md#module-7--trips--journey-tracking); money rules: [expenses.md](expenses.md); look: the Stitch "Trips Overview", "Log Trip Form", "Trip Details" and "Trip Types Dialog" screens through the `automate-design` skill.

**Ownership:** Trips owns journeys, their distance and trip types. The vehicle's odometer is Garage's; trips add readings to its **one odometer history** (below). Mileage stays Fuel's: Trips never calculates efficiency. Money (phase 3) goes through `LinkedExpensesService` with source `TRIP`.

## 1. Rules

- **Two ways to know the distance:** `ODOMETER` (start and end readings; distance = end − start, end above start) or `DISTANCE` (entered; shown as "Distance entered"). The distance is always computed or checked on the server (`tripDistance` in `@automate/shared`); a trip without one isn't saved.
- **Dates and times:** a start date, an optional end date (overnight and multi-day trips) and optional start and end times ("HH:MM", India time). The duration exists only when both times are known (`tripDurationMinutes`, across days); a missing value is "—", never 0.
- **The one odometer history** (`OdometerHistoryService`, vehicles module): expenses' readings (fill-ups through their expenses), service records and trips (the start on its first day, the end on its last). A trip's start can't be below a reading from an earlier day, its end can't be above one from a later day (409 on the field), and two trips of a vehicle can't cover the same km. Historical trips are fine whatever the vehicle shows now. Maintenance and Expenses check against the same history.
- **The vehicle's odometer:** a higher end reading raises it; lowering or deleting a trip's reading corrects it down to the highest reading left anywhere in the history (`VehiclesService.correctOdometer`). Never rolled back past a newer reading.
- **Unusual distance:** more than 1,500 km a day (`TRIP_DAY_KM_NOTICE`) shows a warning on the form; it's never refused.
- **Trip types:** 7 system types (`SYSTEM_TRIP_CATEGORIES`, inserted by the migration) and each user's own (unique per user ignoring case, not a system name). The user's own can be renamed and archived (out of the picker; trips keep theirs); the system's can't. A trip's type is never deleted.
- **Vehicle:** a trip stays with its vehicle (delete and log it again to move it); archived vehicles' trips are read-only.

## 2. API

Every list is paginated; everything is the signed-in user's.

| Route                                                     | Notes                                                                                                                                                                                                              |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /trips/overview`                                     | `vehicleId` (optional: all vehicles), `period` / `from` / `to` (shared periods, plus this week, last 6 months, all time), `granularity` (day, week, month; chosen by length otherwise). Aggregated in the database |
| `GET /trips`                                              | `vehicleId`; newest first                                                                                                                                                                                          |
| `POST /trips`, `GET/PATCH/DELETE /trips/:id`              | Client-generated `id`; PATCH merges and re-checks the whole trip (not the vehicle)                                                                                                                                 |
| `GET/POST /trip-categories`, `PATCH /trip-categories/:id` | The system types first (fixed order), then the user's own; archived last                                                                                                                                           |
| `POST /trip-categories/:id/archive`, `…/restore`          | The user's own only; idempotent                                                                                                                                                                                    |

**Overview figures:** trips and distance by start date in the period; average; longest (with its label); driving time over trips with both times (and how many); trips per week over periods of a week or more; km and trips per type; the distance series with empty buckets filled (all time starts at the first trip); the 5 latest trips.

## 3. Phases

1 · Foundation, recording and overview (with the shared odometer history and dashboard wiring) → 2 · History → 3 · Costs and the Expenses and Fuel links → 4 · Maps and routes (free OpenStreetMap stack) → 5 · Planner → 6 · Road trips → 7 · Analytics and insights → 8 · Remaining integrations → 9 · Import, export and reports → 10 · Attachments and polish. Each phase is approved before the next.

**Built:** phase 1 (trips and trip types, the odometer and entered-distance methods, the shared odometer history used by Maintenance and Expenses too, the overview API and page, log / edit / duplicate / delete, trip details, the trip types dialog, the dashboard's Driving card trips summary, trips in recent activity and the "Log trip" quick action; Stitch "Trips Overview", "Log Trip Form", "Trip Details", "Trip Types Dialog", "Dashboard — Driving & Trips Card").

## 4. Pending integrations

| Needs                   | Trips part waiting                                                                                                  | Until then                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Notifications (M10)** | Planned-trip and road-trip reminders, plan changes, trip-expense reminders; preferences, snooze, deep links         | Nothing is sent; planned trips (phase 5) are listed in the app |
| **AI Assistant (M9)**   | Trip figures as assistant tools: the overview query (period, vehicle) and the trip list; never its own calculations | —                                                              |
| **File storage (M6)**   | Trip photos and receipts through the one `StorageProvider` (free tier, e.g. R2 or Supabase, chosen when it's built) | No attachments                                                 |

**Left out on purpose** (add when asked): GPS tracking or live location, renaming system trip types, moving a trip to another vehicle.
