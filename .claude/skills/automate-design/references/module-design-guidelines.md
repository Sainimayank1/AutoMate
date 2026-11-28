# Module Design Guidelines

Every module uses the same shell, tokens and components (see `application-navigation.md`, `color-system.md` and `component-guidelines.md`), with a layout suited to its job. Read the module's section of `docs/MODULES.md` for the fields and rules. This file covers **how it looks and behaves**. Sample values come from `localization-and-sample-data.md`.

Each section gives the module's **job**, its **layout** (desktop → mobile), its **screens**, the **rules specific to the module** and its **states**. Every screen also needs the universal states in `interaction-patterns.md`.

---

## M01 · Dashboard

**Job:** answer "How is my car doing, what does it cost me, and what needs attention?" in 5 seconds.

**Layout (desktop, `lg:grid-cols-12`):**

1. **Greeting row** (Stitch "Dashboard"): "Good afternoon, Arjun" and "27 Nov 2026 · Your vehicle ownership overview"; on the right the vehicle selector (the app's active vehicle; a compact model chip on phones), the period selector (This month by default; custom range shows two date pickers) and Refresh. "Customise" opens the customisation sheet (below).
2. **Vehicle hero** (`lg:col-span-8`): `VehicleImage` with the `PlateBadge` on it; overline "ACTIVE VEHICLE", the name, "LXI · 1.5L · Petrol · Manual · 2025", the ownership badge, the odometer, then **Quick actions** (Add fuel, Add expense, Add service record, Log trip, Update odometer, View in Garage). **Vehicle status** (`lg:col-span-4`) beside it, the action centre: facts from records the user keeps (insurance expiry from the insurance payment, warranty from the vehicle, due and overdue maintenance schedules; documents when built), most urgent first under "Up next". Each row: a state badge (Overdue, Due today, Due soon, Info), its source, the title and detail opening its record, and the action that resolves it ("Log service", "Add renewal"; none for information). The 3 most urgent show, the rest behind "Show N more" so the panel stays beside the hero. Titles: "Attention required", "Vehicle health information incomplete" (while maintenance or documents aren't tracked, saying which), "No issues recorded". **Never** a health score, gauge or "healthy".
3. **Metric strip** (5 cards, 2 across on phones, the last full width): Spent (net, loan principal excluded), Running cost / km, Average mileage (km/L, km/kg, km/kWh), Distance (from odometer readings), Fuel spend (with litres). Each compares like for like ("−6% vs 1–27 Oct": cost down `success`, up `warning`; mileage up `success`), says why when it can't ("Needs two full-tank fill-ups"), has an ⓘ popover with its definition, and the card opens its module.
4. **Smart insights** (built, below the metric strip): a full-width card, a `Lightbulb` in an `insight`-tinted tile, "Smart insights" and "From your own records · rules, not AI" (never `Sparkles`: these are not AI). Up to 4 tiles (`bg-elevated`, a 2px left border in the tone: `warning` for costs and worse running, `success` for improvements, muted for context), each with its topic icon, the title ("Fuel costs 16% more per km"), the explanation with the figures, a meta line ("vs 1–27 Oct · Medium confidence") and a "View … →" link (40px tall on phones). Too few records: "Insights compare this period with the one before. They appear once expenses and full-tank fill-ups cover both periods." Nothing notable: "Nothing stands out against 1–27 Oct."
5. **Spending** (built): "Monthly spending" (`lg:col-span-8`, stacked bars of the last 6 months, up to 12 for long periods, in the five fixed `SpendGroup` series with the legend on top; net, loan principal excluded) beside "Where it went · 1–27 Nov" (`lg:col-span-4`, categories largest first with icon, amount, % and a thin bar in the category colour, each opening its transactions for the vehicle and period). **Fuel & mileage** (built): "Mileage" (`lg:col-span-8`, the Fuel module's `MileageChart`, last 12 full-tank cycles with a dashed "Period avg" line) beside "Fuel this period" (average and latest mileage, fuel bought, fuel spend, average price, fuel cost per km, "View fuel history").
6. **Bottom row** (built, three equal cards): **Maintenance** ("1 overdue · 2 due soon", the 4 most urgent schedules with the Maintenance module's status badge and due summary, "Last service: …", Add service record · View maintenance), **Expiry dates** (the vehicle's documents with Expiring/Valid/Expired badges, soonest first; the insurance payment and vehicle warranty stand in until those documents exist, or "Not added"), **Driving** (odometer distance for the period, ~km per day, last reading; below a divider the period's TRIPS: count · avg · longest, a thin stacked bar by type with the top three, "N km logged in trips" kept apart from the odometer figure, Log trip · View trips; "No trips this period" / "No trips logged yet").
7. **Recent activity** (built): a full-width card below: fill-ups, expenses, refunds ("−₹140.00" in `success`) and service records, newest first, 8 per page with `Pager`; a table on desktop (Date, Event with its icon and detail, Odometer, Amount), a list on phones; each row opens its record.

**Widgets** (all `Card`-based and customisable): Vehicle status, Fuel Efficiency, Monthly Spending, Cost per KM, Upcoming Maintenance, Document Expiry, Recent Activity, Expense Breakdown.

**Customisation** (built, Stitch "Dashboard — Customise — Desktop / Mobile"): "Customise" (outline, `SlidersHorizontal`; icon-only on phones) after Refresh opens a `Sheet` (right on desktop, `max-w-md`; a bottom sheet up to 85% high on phones): "Customise dashboard", a SECTIONS list (`bg-elevated`, dividers) with a `Switch`, the name (muted when hidden) and up/down icon buttons (40px on phones; moves are announced), then KEY FIGURES checkboxes ("Choose at least one": the last can't be unticked), and a pinned footer: "Reset to default" (ghost), Cancel, Save. Saved per user. The greeting, the hero and the status panel are fixed and can't be hidden. Every section hidden: a dashed note "Every section is hidden. Use Customise to show them again."

**Rules:**

- Every number links to its module (the StatCard `href`).
- Use one date range for the whole page.
- "Up next" shows the 3 most urgent items; the rest are one tap away. With nothing due, never "All clear" while maintenance or documents are untracked: say what isn't tracked ("No issues recorded" only when everything is).

**States:**

- No vehicles: replace the whole dashboard with the Garage welcome (display title, "Add your first vehicle" primary button and three value bullets).
- Vehicle with no records: show the hero, and turn each instrument into a prompt ("Add a fill-up to see mileage").

---

## M02 · Garage / Vehicle management

**Job:** a beautiful, image-rich collection of the user's vehicles, and the hub for each vehicle. **Built** from the Stitch Garage, Vehicle Details, Add Vehicle (steps 1–5), Edit Vehicle, empty-state and delete-dialog screens (`features/garage`).

**Garage overview (`/garage`):** PageHeader "Your garage" with fleet totals and "Add vehicle"; filter chips from the data (All, Owned, Financed, each fuel type, Archived); a `lg:grid-cols-2` grid of `VehicleCard`s (Active vehicle / Standby / Archived badge, plate, odometer · fuel · ownership tiles, profile completion, Set active / Restore, View profile). The active vehicle has the primary border. First use shows the glow-panel empty state.

**Add vehicle wizard (`/garage/new`, task page outside the shell):** a five-segment step rail (labels hide on phones) and one card per step.

1. **Basic details:** manufacturer (free text with suggestions for common makes), model, variant, year, registration, category tiles.
2. **Specifications:** fuel type (segmented), transmission, colour; engine, configuration and tank hidden for electric.
3. **Ownership:** Owned / Financed cards, purchase date and price, current odometer.
4. **Vehicle info** (optional): registration & identity, maintenance specs, warranty, notes.
5. **Review:** a summary card per step with "Edit" to jump back.

Rules:

- "Back" never loses data, and leaving with input asks first (`UnsavedChangesGuard`).
- Only the final step creates the vehicle. On success it becomes active and the user lands on its detail page with a toast.
- A server error on a field (e.g. a registration already in the garage) jumps back to that field's step.

**Vehicle detail (`/garage/:id`):** a back button with name and plate, "Edit vehicle" and an overflow menu (Set as active, Archive / Restore, Delete); the hero (placeholder panel, profile completion, specs line, odometer, purchase and registration facts); tabs **Overview** (Registration & identity, Technical summary) and **Specifications** (every field grouped, "Not added · Add" links into the edit page). An archived vehicle shows a banner with Restore.

- **Add as modules ship:** Fuel History, Expenses, Maintenance, Documents, Trips and Ownership Cost tabs (reuse each module's list component, filtered to the vehicle); the activity timeline; mileage and service status on cards and the hero. Never show those figures before the data exists.

**Edit vehicle (`/garage/:id/edit`):** the same field groups as one sectioned page with a section index (desktop) and an "Unsaved changes" badge. Lowering the odometer shows a warning, not an error.

**Archive vs delete:**

- **Archive:** a `ConfirmDialog` (non-destructive): "Archive Hyundai Creta? It will be hidden from the switcher and dashboard. Records are kept and you can restore it anytime."
- **Delete:** a destructive dialog that says the deletion is permanent, offers "Archive it instead", and unlocks only after the registration is typed. When other modules hold records, list the counts ("This permanently deletes 42 fuel entries…").

**Not built (deliberately):** photos (until file storage), the grid/list toggle, Leased and Family ownership, loan details (Expenses/EMI), vehicle settings (default fuel, reminder lead times: Settings and Notifications).

---

## M03 · Fuel management

**Job:** log a fill-up in under 30 seconds, and see trustworthy mileage.

**Fuel overview (`/fuel`):**

- PageHeader "Fuel" with the action "Add fuel entry" and a DateRangePicker.
- **Instruments:** Avg mileage `17.8 km/L` (hint "From 12 full-tank fills"), Last mileage `18.2 km/L`, Fuel spend (period) `₹5,539.24`, Fuel purchased `58.40 L`, Avg price `₹94.85/L`, Fuel cost per km `₹5.33`. That is 6 instruments: 4 in the StatCard row and 2 as hint lines, or a 3×2 grid on `lg`.
- **Charts** (tabs within one ChartCard to avoid 4 stacked charts): Mileage trend (line), Monthly consumption (bars, L), Fuel price trend (line, ₹/L), Fuel expenditure (bars, ₹).
- **History:**
  - A `DataTable` with columns Date, Odometer, Quantity, ₹/L, Total, Fill (Full/Partial badge), Mileage, Station.
  - Mobile list rows: date and station on the left; total on the right; quantity · odometer · mileage as a caption.

**Add/Edit fuel (task page, Stitch "Add Fuel": `/fuel/new`, `/fuel/:vehicleId/:entryId/edit`):**

- **Field order:** Vehicle (prefilled with the active one), Date & time (now), Odometer (hint "Last reading: 8,450 km on 26/11/2026"), Fuel type (from the vehicle), Quantity (L), Price per litre (₹, last used), Total (₹), Fill type (Full / Partial cards, default Full), "I didn't log a fill-up before this one" (restarts the mileage sequence), Station (recent stations as suggestions), Payment method (select, last used), Location (automatic and read-only: the device position when the form opens, shown as its address, with Refresh and Remove; editing keeps the recorded one), Notes. Receipt (`FileUpload`) arrives with file storage (M6).
- Quantity × price fills the total; the total stays editable (pump rounding) and must be within ₹1 or 1% of quantity × price.
- The odometer must fit between the fill-ups before and after it (equal allowed). The API refuses an out-of-order reading and the message lands on the field ("Lower than 8,412 km, recorded on 24/11/2026. Check the reading or the date."). Never block silently.

**Fuel record detail (`Sheet`):**

- All fields, plus the computed mileage for the segment it closes, plus a link "Linked expense · ₹2,845.50", which opens the expense.
- The receipt preview.
- Edit and Delete. The delete confirmation mentions that the linked expense is deleted too.

**Mileage honesty (critical):**

- Mileage exists only for a full → full sequence. Partial fills roll into the next full fill.
- If the sequence is incomplete (a missed fill, a partial at the end, the first fill), the row's Mileage cell shows "—" with a `CircleDashed` muted icon and the tooltip "Partial sequence: mileage will be calculated at your next full-tank fill".
- **Charts:**
  - Draw gaps (`connectNulls={false}`) where a segment is unreliable. Never interpolate or use dashed estimates.
  - Annotate the gap with a caption below the chart: "2 fills excluded (partial sequence)".
- Avg mileage with fewer than 2 full fills shows "—" with the hint "Needs 2 full-tank fills".
- Never show `0.0 km/L` or a figure computed from partial data.

---

## M04 · Expense management

**Job:** every rupee spent on the vehicle, clearly categorised and never double-counted.

**Expense overview (`/expenses`, Stitch "Expenses — Desktop / Mobile", built):**

- Tabs Overview · Transactions · Recurring · Budgets · Ownership · Insights · Categories; a vehicle scope (supports All vehicles) and the IST month.
- **KPI strip** (5 `StatCard`s, two across on phones): Operating (Nov) with the change vs last month (cost ↑ `warning`, ↓ `success`), Operating (2026) with its months, Monthly average, Running cost / km with the km it's priced over, Loan EMI outflow "of ₹… paid this month". Then the one-line operating-cost definition.
- **Category breakdown:** this month's running cost per category, amount, % and a `Progress h-2` bar in the category colour.
- **Recent expenses:** 5 rows (table on desktop, list on phones), chips for the most used categories, "Showing 5 of N" and "View all" into Transactions with the same scope.
- **Monthly spending:** the last 12 months as stacked bars in the five chart groups (`SPEND_GROUP_SERIES`, the dashboard's colours; loan principal left out), a dashed muted "Same month last year" line where records cover it, the 12-month total in the header.
- **Upcoming payments:** the next 4 recurring payments and EMIs (overdue first) with a state badge, date and amount; "View all →" opens the Recurring tab.

**Ownership tab (`/expenses/ownership`, Stitch "Expenses — Ownership — Desktop / Mobile", built):** one vehicle (the scope, else the active one) and a Segmented period (This month · This year · Since purchase). Then the **money separation panel** "Three ways to count it" (a Card with 3 `bg-elevated` tiles, each with its one-line definition): Operating cost; Cash outflow, naming the loan principal inside it; Economic ownership cost with an "Estimate" badge when depreciation is in it. Loan principal never appears in operating or economic cost. Below, a 7/5 grid: "Where the economic cost goes" (rows with `Progress h-1.5`: Running cost, Insurance & legal, Loan interest & fees, Accessories & upgrades, Depreciation (estimate), then the total), and on the right the Per km / Per month tiles and a Depreciation card (bought for, on, lost so far, worth about; an "Estimate" badge and the IRDAI note; without a purchase price, a link to edit the vehicle).

**Insights tab (`/expenses/insights`, Stitch "Expenses — Insights — Desktop", built):** one card "What stands out" (a teal lightbulb tile, "From your own records · rules, not AI"; never Sparkles) with a 2-column grid of tiles like the dashboard's smart insights: `bg-elevated`, a 2px left border (`warning` for over a limit or the usual, muted for worth a look), a kind icon (Target, TrendingUp, Copy, ReceiptIndianRupee), title, explanation, the figure line and a link.

**Import and report:** "Import CSV" sits beside "Export CSV" on Transactions and opens Stitch "Import Expenses Dialog" (vehicle, file, four count tiles, a table of the rows that need a look with status badges, "Also import the N that look like duplicates", "Import N expenses"). "Printable report" on the Ownership tab opens Stitch "Expense Report": a light A4 sheet outside the shell with a toolbar (Back, period, "Print or save as PDF") that isn't printed.

**Budgets tab (`/expenses/budgets`, Stitch "Expenses — Budgets — Desktop / Mobile" and "Add Budget Dialog — Desktop", built):** the title and one-line rule, "Add budget", three count tiles (Over budget in `destructive`, Near the limit in `warning`, On track neutral; one compact row on phones), then a 2-column grid of cards: category icon (a car for "Everything on this vehicle"), name, a period chip ("November 2026" / "2026 (yearly)"), a state badge (on track is neutral, not green) and a kebab (Edit, Delete); "₹16,978.00 of ₹20,000.00" with the percent in the state colour, a `Progress h-2` in the state colour with a tick at the warning %, and "₹3,022.00 left · warns at 80%" or "Over by ₹100.00" in `destructive`. A muted note closes it. The dialog: Vehicle, Category ("Everything on this vehicle" first), Period (Monthly / Yearly), Limit (₹) and Warn me at (%); editing locks the vehicle and category.

**Recurring tab (`/expenses/recurring`, Stitch "Expenses — Recurring", built):** Upcoming / History payments (state badge, the EMI's principal and interest, "Record payment" opens a dialog with the amount filled in, a menu to skip, postpone or reset), a Loans section (a card per loan: outstanding, EMI, rate, end, progress "19 of 60 EMIs paid", "View schedule →") and a Schedules table (frequency, next due, status; pause, resume, cancel, delete). Loan details (`/expenses/loans/:id`): position tiles, rate changes and the amortisation table a page at a time, each row's state; EMIs before tracking read "Before tracking". Add/edit recurring payment and loan are task pages with numbered sections and a summary card.

- The **money separation panel** lives on the Ownership tab (below).
- **Category breakdown:** a donut (top 4 + Other) plus a ranked list with category icon, amount, % and a bar (`Progress h-1.5` in the category colour).
- **List:**
  - A `DataTable` with columns Date, Category (icon + label), Description, Payment, Amount, Source.
  - **Source** shows a link chip when the expense originates elsewhere: "Fuel entry", "Service record", "Insurance", "Trip". Editing such an expense redirects to the origin record ("Edit in Fuel") instead of allowing divergent edits.
  - Mobile: list rows.

**Categories**: 8 system groups with subcategories (`SYSTEM_EXPENSE_CATEGORIES` in `@automate/shared`): Fuel, Maintenance & servicing, Repairs, Insurance & legal, Finance, Daily usage, Accessories & upgrades, Other; plus custom ones. Colour by group (`categoryTone` in `features/expenses/constants.ts`): Fuel `chart-1`, Maintenance & Repairs `chart-2`, Insurance & legal `chart-3`, Finance `chart-4`, everything else `chart-5`.

**Add/Edit expense (task page, Stitch "Add Expense" / "Edit Expense": `/expenses/new`, `/expenses/:id/edit`; numbered sections with a summary card as the review step):**

- **Field order:** Category first, as a grid of icon tiles (3 columns on mobile, 4 on desktop); the selected tile gets a cyan ring. Then Amount (large `text-2xl` input with the ₹ prefix), Date, Vehicle, Payment method, Vendor (optional), Odometer (optional), Receipt, Notes.
- Choosing **Fuel** redirects to the Fuel form ("Fuel expenses are created from fuel entries").
- Choosing **EMI** shows the principal/interest split read-only, from the loan schedule.

**Expense details (`Sheet`):** the amount as a hero, the category badge, the fields, a source link, the receipt preview, and Edit and Delete.

**Analytics** (within the overview, or a link to M08): monthly stacked bars by category, and year-on-year comparison.

---

## M05 · Maintenance and service

**Job:** "What's due next, and is anything overdue?" Emphasise urgency, due dates and odometer progress. **Built** (phase 1) from the Stitch "Maintenance", "Maintenance Schedules", "Add Schedule" and "Schedule Details" screens (`features/maintenance`); plan in `docs/architecture/maintenance.md`.

**Maintenance overview (`/maintenance`):**

- **Status banner:** one line from the schedules (Overdue maintenance / Attention required / Upcoming maintenance / All caught up / Maintenance data incomplete). **No health score or gauge:** maintenance data can't show a vehicle is healthy.
- **Instruments:** maintenance spend for the period (from Expenses) with the previous window, overdue count, due & upcoming count, next service.
- **Next service card:** "Periodic service · due at 10,000 km or 14/03/2027, whichever comes first". Show two progress tracks:
  - distance: 8,450 / 10,000 km, "1,550 km left";
  - time: "107 days left".

  The **more urgent** track determines the status and is listed first.

- **Component grid** (`sm:grid-cols-2 lg:grid-cols-3`): one tile per component with the Lucide icon (Engine oil `Droplet`, Oil filter `Filter`, Air filter `Wind`, Cabin filter `Wind`, Spark plugs `Zap`, Coolant `Thermometer`, Brake pads `Disc3`, Brake fluid `Droplet`, Tyres `CircleDashed`, Battery `Battery`, Transmission fluid `Droplet`, Wipers `Wind`), the name, `StatusBadge`, last replaced, and the next due (km and date) with a thin progress bar. Sort by urgency.
- **Tabs:** Schedule · Service history · Calendar.

**Statuses:** Good, Upcoming, Due, Overdue, Needs inspection, Replaced, Monitoring. Map them exactly as in `color-system.md`. Due is the earlier of time and distance.

**Screens:**

- **Schedule:** a list of the component schedules with their intervals; "Add maintenance schedule" (component, interval km and/or months, last done at km and date, reminder lead).
- **Maintenance details (`Sheet`):** the interval, history of replacements and actions.
  - **Complete maintenance:** a dialog with date, odometer, cost (creates a linked expense), service record link and notes.
  - **Replace component:** the same as Complete, plus part brand, part number and warranty.
- **Service history:** an `ActivityTimeline`-style list of service records (workshop, odometer, total, items count).
  - Add service record (full form: workshop, date, odometer, service type, line items as a repeatable table of part/labour, qty and amount, totals, invoice upload, which components it resets).
  - Service details: line items table, totals, the invoice preview (`DocumentPreview`) and the linked expense.
- **Maintenance calendar:** a month grid (built from the `Calendar` primitive or a simple CSS grid) with status dots on due days, and the day's items in a side list. On mobile, an agenda list grouped by week.

---

## M06 · Documents and reminders

**Job:** a vault that feels **secure, organised and premium**, plus never missing an expiry.

**Built (Stitch "Documents Vault", "Add Document", "Document Details"; rules in `docs/architecture/documents.md`):**

- **Vault (`/documents`):** title and "Private storage for RC, insurance, PUC, licence and warranty records" (no encryption claims beyond the bucket's), "Add document"; four count tiles (Total · Valid in `success` · Expiring soon in `warning` · Expired in `destructive`); a row of type chips (All + every type, scrolling on phones) and a search (name, number, issuer); a 2-column grid of cards, expired and soonest first: a 40 px icon tile tinted by state, name, vehicle · plate (or issuer), a badge ("12 days", Valid, Expired, No expiry), and number + expiry date under a hairline (amber or red when due); a "Renewals" card on the right (expired, then expiring) with "Upload new" / "Renew".
- **Add / Edit (task page, `/documents/new`, `/documents/:id/edit`):** one card: name, type, vehicle (optional for a driving licence), number (labelled by type: Policy no., Certificate no.…), issue and expiry dates, issued by; a dropzone with "Choose files" and "Scan with camera" (`capture="environment"`), each file sent straight to storage with a spinner, then size or the reason it failed; "Remind me 30, 7 and 1 days before it expires" plus "Also remind me on"; notes; Cancel / "Save to vault". `?renew=1` starts a renewal (new dates and copy).
- **Details (`/documents/:id`):** header (tinted tile, name, badge, type · vehicle, Edit and a kebab with Delete); a 7/5 grid: the preview (PDF in the browser's viewer, photos inline, through a 5-minute link) and the files (select, open, download), then Details and Reminders with "Renew".
- **Dashboard:** expired and expiring documents in the action centre (Renew), the expiry card lists the vehicle's documents, "Added …" in recent activity, and "Add document" in the hero's quick actions.

**Not built yet:** reminder inbox, snooze and calendar (Notifications, M10), number masking and document thumbnails in the grid.

---

## M07 · Trips and journey tracking

**Job:** understand where the distance goes and what journeys cost.

**Trips overview (`/trips`):**

- **Instruments:** Total trips, Total distance, This month distance, Avg trip distance, Trip expenses, Cost per km.
- **Trip type breakdown:** a horizontal stacked bar (Commute, Personal, Road trip, Business, Other).
- **History:** a timeline grouped by month on mobile and a `DataTable` on desktop (Date, Title, From → To, Type badge, Distance, Duration, Cost).

**Trip details:**

- **Journey** (until maps are integrated): a vertical From → To timeline (start dot `muted-foreground`, end dot `primary`, the distance between them, dates and times), and "Route maps arrive later; no route is drawn without real route data." Never an invented route line.
- Stats: start and end odometer, distance, duration, average speed if available.
- Expenses linked to the trip (tolls, fuel, parking), with the total cost and cost per km.
- Notes and purpose (Business trips show a "Reimbursable" toggle state).

**Add/Edit trip:** title, type (segmented), start and end date-time, start and end odometer (end ≥ start, prefilled from the last reading), from and to (text), linked expenses (attach existing ones or add new), notes.

**Trip report:** the period summary (distance by type, cost by type, top trips), exportable as PDF or CSV (uses M12 export).

---

## M08 · Analytics and cost of ownership

**Job:** deep, trustworthy insight into what the car really costs.

**Built (Stitch "Analytics & TCO — Desktop / Mobile"; rules in `docs/architecture/analytics.md`):** `/analytics` is one page across the active vehicles: PageHeader "Total cost of ownership" with a Segmented period (This month · This year · Lifetime: the ownership periods, not a financial year) and "Export report" (the Expenses printable report for the active vehicle); four tiles (Spent, True cost / km in `primary` with depreciation included, Average mileage weighted by full-tank cycles and only across one unit, Estimated resale value labelled as an estimate); the dashboard's `SpendingSection` (monthly chart in the five groups + where it went) across vehicles; and a Vehicle comparison table (name opening its Ownership tab, plate · fuel, odometer, mileage, cost / km, service spend, total cost) with the cost-model note. Trip charts stay in Trips (linked). The tabbed layout below is the longer-term target; the three tiers live on the Expenses Ownership tab.

**Layout:** PageHeader with a DateRangePicker, a vehicle scope (single vehicle or All/Compare) and Export (PDF/CSV). Tabs: Overview · Fuel · Expenses · Usage · Maintenance · Ownership cost · Compare · Reports.

**Overview:**

- **Hero metric:** total cost of ownership.
- **The three-tier cost model.** Always present it in this order, with definitions:

| Tier                           | Includes                                                                                                             | Sample (since 14/03/2026) |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| 1. **Cash outflow**            | Everything paid out, including loan principal (excluding the down payment)                                           | ₹2,36,680.90              |
| 2. **Operating cost**          | Fuel, insurance, maintenance, repairs, tolls, parking, washing, accessories, loan _interest_; **excludes** principal | ₹1,49,975.90              |
| 3. **Economic ownership cost** | Operating cost + depreciation (on-road price − resale estimate)                                                      | ₹3,19,975.90              |

Use a vertical stepped layout or 3 tiles connected by "+"/"−" operators so the relationship is visible. Never show these as unlabelled interchangeable "totals".

- Instruments: Cost per km (operating) `₹17.77`, Total distance `8,438 km`, Avg monthly cost, Fuel cost per km `₹5.33`.
- **Ownership cost breakdown:** horizontal bars by component (fuel, insurance, maintenance, repairs, loan interest, depreciation…), with amount and %.
- **Depreciation and resale estimate:** a line from the on-road price (₹12,10,000) to the current estimate (₹10,40,000). Label the estimate "Estimate", with its method in a tooltip.

**Other tabs:**

- **Fuel, Expenses, Usage and Maintenance** each get 2–3 `ChartCard`s plus a supporting table. Don't build a wall of charts.
- **Compare:** pick 2–3 vehicles, then show a metric table (rows are metrics, columns are vehicles, the best value is highlighted with a `text-success` subtle mark) and paired bar charts. Each vehicle uses `chart-1`/`chart-2`/`chart-3` consistently.
- **Reports:** monthly and annual report previews (a document-like layout on `bg-card`, `max-w-3xl`), with "Export PDF" and "Export CSV".

**Chart quality bar:** clear titles that state the insight ("Fuel spend rose 8% vs October"), formatted tooltips, ≤ 5 series, fixed heights and an accessible summary (see `accessibility.md`).

---

## M10 · Notifications center

**Job:** one calm inbox for everything that needs attention.

**As built** (`/notifications`, from the Stitch "Notifications", "Notifications — Reminders", "Add Reminder Dialog" and "Notifications Popover" screens; rules in `docs/architecture/notifications.md`):

- **Layout:** `max-w-4xl`; PageHeader ("N unread", Preferences link to Settings, "Mark all as read") and two tabs, Inbox and Reminders.
- **Inbox:** chips (`ToggleGroup`) All · Unread · Maintenance · Documents · Expenses · Fuel · Trips · Reminders · Snoozed, kept in the URL; grouped Today / This week / Earlier (snoozed ones on their own, with when they come back).
- **Card:** the category icon on a tile tinted by priority (High `destructive`, Medium `warning`, Low muted), a priority border while unread, the title (semibold with the cyan dot while unread), the body, the vehicle and relative time; "Open" goes to the record and marks it read; the menu marks read/unread, snoozes (1 day, 3 days, 1 week) or dismisses.
- **Reminders tab:** Open / Done `Segmented`; rows with a calendar tile tinted by state, a `StatusBadge` ("Due in 2 days", "Overdue", "Upcoming"), date · lead · vehicle, "Mark done" and a menu (Edit, Delete with confirmation). The dialog: what, date, "Remind me" (on the day … 1 month before), vehicle (optional), notes.
- **Bell** (header): the unread count ("9+" past nine); desktop opens a `w-96` popover with the latest six, "Mark all as read" and "View all notifications"; phones go to the inbox.
- **Empty:** "You're all caught up" with `BellOff`; reminders: "No reminders yet" with `BellPlus`.

**Not built:** the details `Sheet` (the card holds the whole message), per-item action buttons ("Renew", "Upload PUC": they live on the record "Open" leads to), a preferences matrix with channels and quiet hours (the switches are in Settings; push and email aren't built), swipe actions.

---

## M11 · Settings and personalisation

**As built** (`/settings`, from the Stitch "Settings — Security & Preferences" screens; rules in `docs/architecture/settings.md`): one scrolling page of Cards in this order, `max-w-5xl`.

- **Profile:** avatar (photo or initials) with "Add/Change photo" and "Remove" links, name, email, member since, and "Edit profile" (a dialog; the current password field appears only when the email changes).
- **Preferences:** theme as a `Segmented` (Dark, Light, System) and the default vehicle `Select`, both saving immediately; below them a read-only regional format panel (₹, km, L/kg/kWh, DD/MM/YYYY, IST, English (India)) explaining it's fixed for India.
- **Reminders & alerts:** a master "Notifications" `Switch` in the header and one row per reminder (label + description left, `Switch` right). Off: the rows disable and a line says no reminders are sent.
- **Security:** a "Change password" row (dialog), then signed-in devices (device name, "This device" badge, last active, signed-in date, per-device "Sign out") with `Pager` and "Sign out of all other devices".
- **Your data:** a link to Backup & Export.
- **Account:** a danger-zone Card (`border-destructive/40`) with "Sign out" and "Delete account"; the confirmation says what is deleted, suggests backing up first and requires the password plus `DELETE`.

**Not built:** per-section sub-pages on mobile (the single page stacks), preview cards for themes, biometric lock / PIN (mobile app), privacy settings.

---

## M12 · Backup, import and export

**Job:** make data portability and restoration **understandable and safe**.

**As built** (`/backup`, from the Stitch "Backup & Export" screens; rules in `docs/architecture/backup.md`): one page, `max-w-5xl`, with the vehicle `Select` in the page header.

- **Export:** a Card of rows (icon tile, title, one-line description, outline button on the right; full width under the text on phones): fuel, expenses, service history and vehicle details as CSV, trip history (links to Trips, which owns its CSV), the ownership report (links to the printable report) and the vehicle archive (JSON). Each button shows "Preparing…" while it fetches.
- **Full backup:** a Card with what's included (and that document files aren't) and the one primary "Download backup".
- **Restore a backup:** a dashed drop zone (icon, "Choose an AutoMate backup file (.json, up to 10 MB)", "Choose file"). After choosing: a preview panel with "Backup from <date, time>" and the file name, one row per vehicle (name, plate in mono, counts, a `StatusBadge`: "Will be restored", "Already in your garage, skipped", "Can't be read"), an expandable warning row "N rows can't be restored" listing "Fill-up 12: <reason>", and Cancel / "Restore N vehicles" in the panel's footer. Restoring shows "Restoring… don't close this page"; success shows "Restored N vehicles" with links to them.
- **Data management:** links to the Garage (archive or delete a vehicle) and Settings (delete the account, in destructive text).

**Not built:** CSV import for modules other than Expenses and Trips (they have their own dialogs), a backup history, replacing current data on restore (restore only adds vehicles that aren't there), ZIP archives with files.

---

## Global screens

### Authentication (outside the shell)

Built from the Stitch screens "Login — Desktop/Mobile" and "Register — Desktop/Mobile" (`features/auth`).

- **Layout** (`AuthLayout`):
  - Desktop (`lg+`): a 5/7 split. On the left, a brand panel: `bg-card` with `hero-glow`, `BrandLogo size="lg"`, an overline, a headline and three highlights with icons (`primary`, or `insight` for the AI one). On the right, the form column (`max-w-md`) with the theme switch top-right and a short footer line.
  - Mobile: the form only, with the logo and theme switch on top.
  - Stitch's panel uses a vehicle photograph; it is replaced by `hero-glow` until a licensed photo is added to the repo.
- **Built screens:**
  - **Sign in** (`/login`): email, password (reveal toggle), "Keep me signed in on this device" (on by default: a 30-day session; off: ends with the browser session). Wrong credentials show one form-level message ("Incorrect email or password."), never revealing whether the email exists.
  - **Create account** (`/register`): full name, email, password (hint: at least 8 characters with a letter and a number) and a required terms checkbox. A taken email is shown on the email field (registration can't hide it until email verification exists).
- **Deliberately left out of the Stitch screens:** Google and mobile-OTP sign-in, the mobile number field (it only served OTP) and the "Forgot password?" link (no reset flow yet).
- **Not built yet** (generate the Stitch screens first, then build): forgot password → "If an account exists, we've sent a link", reset password, email verification (code or link, with resend and a countdown). They need an email provider (Resend in the tech stack).
- After sign-in the user returns to the page they asked for; after registration they land on the dashboard with a welcome toast. Visiting `/login` while signed in redirects to the dashboard.

### Onboarding (after first sign-in, outside the shell)

A full-screen stepper with progress dots and "Skip for now" where allowed.

1. **Welcome:** `hero-glow`, a display title ("Let's set up your garage") and 3 value points with icons.
2. **Add first vehicle:** make and model.
3. **Vehicle information:** variant, fuel, transmission, registration.
4. **Set odometer:** large numeric input, the photo upload optional.
5. **Configure preferences:** units, defaults and notifications, prefilled with Indian defaults.
6. **Completion:** a summary, a single `GaugeRing` needle-sweep animation (motion-safe), and "Go to dashboard".

### Global UI elements

| Element                                 | Pattern                                                                                                                     |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Confirmation / delete / archive dialogs | `ConfirmDialog` (AlertDialog). Copy rules are in `interaction-patterns.md`.                                                 |
| Success / error dialogs                 | Use them rarely. Prefer toasts and inline states. A dialog is only for blocking outcomes (restore finished, import failed). |
| Date pickers                            | `DatePicker`, `DateRangePicker`                                                                                             |
| Vehicle selectors                       | `VehicleSelector`                                                                                                           |
| Filter panels                           | `FilterBar` (a `Drawer` on mobile)                                                                                          |
| File upload                             | `FileUpload` inside a `ResponsiveDialog`                                                                                    |
| Receipt and PDF previews                | `DocumentPreview`                                                                                                           |
| Notification popover                    | See `application-navigation.md`                                                                                             |
| Profile dropdown                        | `UserMenu`                                                                                                                  |
| Mobile bottom sheets                    | `Drawer` via `ResponsiveDialog` / `QuickAddSheet`                                                                           |
