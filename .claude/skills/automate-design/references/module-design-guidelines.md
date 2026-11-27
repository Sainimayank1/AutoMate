# Module Design Guidelines

Every module uses the same shell, tokens and components (see `application-navigation.md`, `color-system.md` and `component-guidelines.md`), with a layout suited to its job. Read the module's section of `docs/MODULES.md` for the fields and rules. This file covers **how it looks and behaves**. Sample values come from `localization-and-sample-data.md`.

Each section gives the module's **job**, its **layout** (desktop → mobile), its **screens**, the **rules specific to the module** and its **states**. Every screen also needs the universal states in `interaction-patterns.md`.

---

## M01 · Dashboard

**Job:** answer "How is my car doing, what does it cost me, and what needs attention?" in 5 seconds.

**Layout (desktop, `lg:grid-cols-12`):**

1. **Greeting row.** "Good evening, Aarav" (page title style) with a caption showing today's date. Actions on the right: `DateRangePicker` (default: This month) and "Customise".
2. **Vehicle hero** (full width, `Card` + `hero-glow`):
   - Left: `VehicleImage` (hero aspect).
   - Right: an overline "ACTIVE VEHICLE", "Maruti Suzuki Victoris" (`text-2xl`), "LXI · Petrol · Manual" caption, `PlateBadge`, and the **hero metric** odometer `8,450 km`.
   - Below the metric: 3 compact tiles (`bg-elevated`): This month `1,020 km`, Avg mileage `17.8 km/L`, Health `GaugeRing sm`.
   - On mobile the hero stacks: image on top with the scrim, the name and plate over the scrim, the metric and tiles below.
3. **Instrument row** (`StatCard` ×4, 2×2 on mobile): Fuel spend (month) `₹5,539.24`, Total expenses (month), Cost per km `₹17.77`, Avg mileage, each with a trend vs the previous period.
4. **Main (col-span-8):** `ChartCard` Monthly expenses (stacked bars by category, last 6 months), then `ChartCard` Fuel efficiency (line, km/L per full-tank fill, with gaps where the sequence is partial).
5. **Aside (col-span-4):**
   - **Attention**: a combined list of upcoming maintenance and expiring documents, sorted by urgency, each with a `StatusBadge` and "in 1,550 km" / "in 43 days";
   - **Expense breakdown**: a donut with ≤ 5 segments plus a ranked list;
   - **Quick actions**: Add fuel, Add expense, Add service, Upload document.
6. **Recent activity:** `ActivityTimeline`, latest 8, "View all".

**Widgets** (all `Card`-based and customisable): Vehicle Health, Fuel Efficiency, Monthly Spending, Cost per KM, Upcoming Maintenance, Document Expiry, Recent Activity, Expense Breakdown.

**Customisation:** "Customise" opens a `Sheet` listing the widgets with `Switch` toggles and drag handles (`@dnd-kit`, planned) to reorder. The layout is saved per user, and "Reset to default" is available. The hero and greeting are fixed and can't be hidden.

**Rules:**

- Every number links to its module (the StatCard `href`).
- Use one date range for the whole page.
- The Attention list shows at most 5 items. When empty, show "All clear · Nothing due in the next 30 days" with `CircleCheck` in success.

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

**Expense overview (`/expenses`):**

- PageHeader with the action "Add expense", a DateRangePicker and vehicle scope (supports All vehicles).
- **Instruments:** This month, This year, Avg monthly, Cost per km.
- **Money separation panel** (a Card with 3 `bg-elevated` tiles, always present):
  1. **Operating expenses**: running and ownership costs, including loan **interest**;
  2. **Loan principal**: repayments of the loan itself, _not an ownership cost_;
  3. **Total cash outflow** = 1 + 2.

  Each tile has a one-line definition tooltip. Principal never appears inside operating totals or cost per km.

- **Category breakdown:** a donut (top 4 + Other) plus a ranked list with category icon, amount, % and a bar (`Progress h-1.5` in the category colour).
- **List:**
  - A `DataTable` with columns Date, Category (icon + label), Description, Payment, Amount, Source.
  - **Source** shows a link chip when the expense originates elsewhere: "Fuel entry", "Service record", "Insurance", "Trip". Editing such an expense redirects to the origin record ("Edit in Fuel") instead of allowing divergent edits.
  - Mobile: list rows.

**Categories** (one fixed icon and colour each, defined once in `EXPENSE_CATEGORY_META`): Fuel, Maintenance, Repairs, Insurance, EMI, Tolls, Parking, Washing, Accessories, Tyres, Battery, Fines & challans, Registration, Other.

**Add/Edit expense (`ResponsiveDialog`):**

- **Field order:** Category first, as a grid of icon tiles (3 columns on mobile, 4 on desktop); the selected tile gets a cyan ring. Then Amount (large `text-2xl` input with the ₹ prefix), Date, Vehicle, Payment method, Vendor (optional), Odometer (optional), Receipt, Notes.
- Choosing **Fuel** redirects to the Fuel form ("Fuel expenses are created from fuel entries").
- Choosing **EMI** shows the principal/interest split read-only, from the loan schedule.

**Expense details (`Sheet`):** the amount as a hero, the category badge, the fields, a source link, the receipt preview, and Edit and Delete.

**Analytics** (within the overview, or a link to M08): monthly stacked bars by category, and year-on-year comparison.

---

## M05 · Maintenance and service

**Job:** "Is my car healthy, and what's due next?" Emphasise urgency, due dates and odometer progress.

**Maintenance overview (`/maintenance`):**

- **Health header:** `GaugeRing lg` (health score) next to a summary of counts by status (Overdue 0 · Due 0 · Needs inspection 1 · Upcoming 2 · Good 9), as status-coloured numbers with labels.
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

**Documents overview (`/documents`):**

- **Expiry strip:** the documents expiring soonest as compact cards (type icon, name, "Expires in 43 days", `StatusBadge`). Example: Driving Licence, 09/01/2027.
- **Vault grid**, grouped by type: RC, Insurance, PUC, Driving Licence, Warranty, Roadside Assistance, Loan Documents, Service Invoices, Purchase Invoices, Other.
  - Each document card has a thumbnail (first page or image), the title, number (masked except the last 4 characters until revealed), validity dates and a status.
  - A `Lock` overline "Encrypted storage" in the page description reinforces trust. Make no claims beyond what the backend guarantees.
- Filter by type and status, plus search.

**Screens:**

- **Add/Edit document:** `FileUpload` first (large dropzone), then type (combobox), title, number, issue date, expiry date (hidden for types without expiry), vehicle (or "Personal" for a Driving Licence) and reminder lead times (multi-select chips: 30, 15, 7, 1 days).
- **Document details:** `DocumentPreview` (large), a metadata panel, the reminder list, and actions (Download, Replace file, Edit, Delete).
- **Reminders:** a list grouped by Overdue / This week / This month / Later. Each reminder has a title, linked document or record, due date, repeat setting and actions (Snooze, Mark done).
  - **Reminder creation:** title, type (document expiry / custom), date, repeat (none, monthly, yearly), lead time, linked record.
  - **Reminder details:** a `Sheet` with the reminder's history.
- **Reminder calendar:** the same component as the maintenance calendar, showing reminders.

---

## M07 · Trips and journey tracking

**Job:** understand where the distance goes and what journeys cost.

**Trips overview (`/trips`):**

- **Instruments:** Total trips, Total distance, This month distance, Avg trip distance, Trip expenses, Cost per km.
- **Trip type breakdown:** a horizontal stacked bar (Commute, Personal, Road trip, Business, Other).
- **History:** a timeline grouped by month on mobile and a `DataTable` on desktop (Date, Title, From → To, Type badge, Distance, Duration, Cost).

**Trip details:**

- **Route visualisation placeholder** (until maps are integrated): a `bg-elevated` panel, `aspect-[21/9]`, with an abstract route. Draw an SVG polyline with start and end dots (start `muted-foreground`, end `primary`), the "From" and "To" labels at the ends, and distance and duration centred. It must never look like a broken map.
- Stats: start and end odometer, distance, duration, average speed if available.
- Expenses linked to the trip (tolls, fuel, parking), with the total cost and cost per km.
- Notes and purpose (Business trips show a "Reimbursable" toggle state).

**Add/Edit trip:** title, type (segmented), start and end date-time, start and end odometer (end ≥ start, prefilled from the last reading), from and to (text), linked expenses (attach existing ones or add new), notes.

**Trip report:** the period summary (distance by type, cost by type, top trips), exportable as PDF or CSV (uses M12 export).

---

## M08 · Analytics and cost of ownership

**Job:** deep, trustworthy insight into what the car really costs.

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

## M09 · AI car assistant

**Job:** a premium automotive co-pilot grounded in the user's own records. Not a generic chatbot.

**Layout:**

- Desktop: a 2-pane layout. On the left, conversation history (`w-72`, search, grouped by Today / Previous 7 days / Older, "New conversation"). On the right, the conversation.
- Mobile: history in a `Sheet` from the header; the conversation is full screen.

**Empty state (new conversation):**

- `hero-glow`, a `Bot` icon in an `insight` tinted tile, "Ask about your Victoris" (display title) and the vehicle context chip (`PlateBadge` + odometer).
- **Suggested questions** as a 2-column grid of `outline` cards:
  - How is my car's mileage performing?
  - How much did I spend on fuel this month?
  - When is my next service due?
  - Show my maintenance history.
  - What is my cost per kilometre?
  - Compare this month with last month.
  - What should I check before a road trip?

**Conversation:**

- User messages are right-aligned, `bg-elevated`, `rounded-xl`, `max-w-[80%]`.
- Assistant responses are full-width blocks without a bubble, in `text-base leading-7`. They can contain:
  - **Metric cards:** a `StatCard` row sourced from real data;
  - **Charts:** `ChartCard`, compact;
  - **Tables:** a compact `Table`;
  - **Maintenance suggestions:** a list with a `StatusBadge` and a "Schedule" action;
  - **Record references:** chips with module icon + title, linking to the record ("Fuel entry · 19/11/2026");
  - **Action suggestions:** `outline` buttons ("Add reminder", "Open fuel history") that require a click and never auto-execute.
- **Recorded data vs AI advice (mandatory):**
  - Blocks built from the user's records carry a muted caption "From your records" with a `Database` icon and are rendered with normal surfaces.
  - AI-generated advice and general knowledge sit in a block with `border-l-2 border-l-insight bg-insight/5`, a `Sparkles` icon and the label "AI suggestion". Advice must never be styled as recorded data.
- **Streaming:** text streams in; structured blocks appear with a skeleton until complete. A "Stop generating" button replaces Send while streaming.
- **Composer:** a sticky bottom `Textarea` (auto-grow, max 6 lines) with a Send icon button (primary). `Enter` sends, `Shift+Enter` adds a new line. The vehicle context chip sits above the composer and can be switched.
- **Errors:** an inline "Couldn't get a response" with Retry on the failed message. The conversation is never lost.

**Other screens:**

- **Conversation details:** rename and delete from the header overflow.
- **Delete confirmation:** a destructive `ConfirmDialog` ("Delete this conversation? This can't be undone.").
- **AI preferences** (Settings sub-section or a dialog): response length, units, whether the assistant can use location, data access scope, and clear history.

---

## M10 · Notifications center

**Job:** one calm inbox for everything that needs attention.

**Layout:**

- PageHeader with "Mark all as read" and Preferences.
- Filter chips: All · Unread · Maintenance · Documents · Fuel · Expenses · Trips · AI insights.
- A list grouped by Today / This week / Earlier.

**Notification row:**

- A priority dot (High `destructive`, Medium `warning`, Low muted), the category icon tile, a title (`font-medium` if unread), a one-line body, the relative time and an unread cyan dot.
- Hover or swipe actions: Snooze (`AlarmClock`; options 1 day, 3 days, 1 week, custom), Dismiss (`X`), Mark read/unread.
- AI insight notifications use the `insight` tint and `Sparkles`.

**Categories:** Maintenance upcoming, Maintenance overdue, Insurance expiry, PUC expiry, Fuel efficiency change, Expense reminder, Trip reminder, Custom reminder, AI insight.

**Behaviour:**

- Clicking a notification deep-links to the record (a document, a maintenance item, a fuel trend) and marks it read.
- Snoozed items move to a "Snoozed" filter with their wake time.
- **Details (`Sheet`):** the full message, related record preview and actions.
- **Preferences:** a matrix with categories as rows and channels as columns (In-app, Email, Push later) using `Switch`es, plus lead times and quiet hours.
- **Empty:** "You're all caught up" with `BellOff`.

---

## M11 · Settings and personalisation

**Layout:**

- Desktop: a section nav on the left (`md:grid-cols-[12rem_1fr]`): Profile · Preferences · Appearance · Notifications · Security · Privacy · Account.
- Mobile: a list of sections that each push to a sub-page.
- Each section is a set of Cards with a title, a description and rows (label + description on the left, control on the right).

**Preferences:**

- Currency (₹ INR, locked for now, with an explanation), distance (km), fuel volume (L), fuel efficiency (km/L or L/100 km), date format (DD/MM/YYYY), timezone (Asia/Kolkata), language (English (India)), default vehicle, theme.
- Changes save immediately (`Switch`/`Select`) with a small "Saved" toast. Forms with text fields use an explicit Save.

**Appearance:** theme as 3 preview cards (Dark, recommended; Light; System), each a miniature of the shell in that theme. Density follows later.

**Security:** change password, active sessions list (device, location, last active, "Sign out"), 2FA later.

**Privacy:** data usage for AI, data export link (M12).

**Account:** a danger zone Card (`border-destructive/30`) containing "Delete account". The destructive confirmation explains what is deleted, offers "Export my data first" and requires typing `DELETE` plus the password.

---

## M12 · Backup, import and export

**Job:** make data portability and restoration **understandable and safe**.

**Backup overview (`/backup`):** cards for Export data, Import CSV, Backups (last backup time, "Back up now") and Restore, plus a Backup history table (date, size, type, status, Download / Restore).

**Export:**

- Choose the scope (vehicle(s), modules, date range) and the format: CSV per module, a PDF report (monthly or annual) or a complete account archive (ZIP).
- Show an estimate of the contents, then a progress state, then a ready-to-download state (toast plus a list entry).

**Import CSV:** a full-route stepper with 5 steps.

1. **Upload:** `FileUpload` with a CSV template download link.
2. **Map columns:** a two-column table (CSV header → AutoMate field `Select`), auto-matched with confidence badges. Required unmapped fields are highlighted.
3. **Validate:** a summary row of counts (Valid 120 · Warnings 4 · Errors 2), then a `DataTable` of problem rows with inline messages. Error rows are skipped; the user can download an error report.
4. **Duplicates:** suspected duplicates shown side by side (existing vs incoming), with Skip, Import anyway, or apply the choice to all.
5. **Confirm:** the final counts by module and a single primary "Import 120 records". Then progress, then the result.

**Restore:**

- Pick a backup, then a preview of what will change, then an explicit warning ("Restoring replaces current data for the selected scope. We'll create a backup of your current data first.") with a typed confirmation.
- **Progress:** a step list with live status (`Spinner` → `CircleCheck`).
- **Result:** success (counts) or partial failure (what failed and how to retry).
- Never start a destructive restore without an automatic pre-restore backup step.

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
