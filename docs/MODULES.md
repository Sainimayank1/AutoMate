# AutoMate — Complete Module Specification

Product requirements document · Modules, features, and functional scope

**Product:** AutoMate — Car Ownership Assistant

**Objective:** Build a comprehensive car ownership application that helps users manage their vehicles, fuel consumption, maintenance, expenses, documents, trips, and overall cost of ownership from one platform.

This document contains the 12 product modules and their functional requirements, plus cross-module requirements and development priority.

## Contents

1. [Dashboard](#module-1--dashboard)
2. [Garage / Vehicle Management](#module-2--garage--vehicle-management)
3. [Fuel Management](#module-3--fuel-management)
4. [Expense Management](#module-4--expense-management)
5. [Maintenance & Service Management](#module-5--maintenance--service-management)
6. [Documents & Reminders](#module-6--documents--reminders)
7. [Trips & Journey Tracking](#module-7--trips--journey-tracking)
8. [Analytics & Cost of Ownership](#module-8--analytics--cost-of-ownership)
9. [AI Car Assistant](#module-9--ai-car-assistant)
10. [Notifications Center](#module-10--notifications-center)
11. [Settings & Personalization](#module-11--settings--personalization)
12. [Backup, Import & Export](#module-12--backup-import--export)
13. [Cross-module requirements](#13-cross-module-requirements)
14. [Product development priority](#14-product-development-priority)

---

## Module 1 — Dashboard

The dashboard provides a quick overview of the selected vehicle, its usage, expenses, and upcoming tasks.

### Features

- Vehicle summary card
- Vehicle switcher for multiple vehicles
- Vehicle image and basic details
- Current odometer reading
- Monthly fuel expenses
- Monthly total expenses
- Average mileage
- Cost per kilometre
- Total distance driven this month
- Upcoming maintenance
- Upcoming document expiry
- Recent activities
- Fuel consumption trends
- Expense summary
- Quick action shortcuts

### Quick actions

- Add fuel
- Add expense
- Record service
- Add trip
- Update odometer
- Add reminder

### Dashboard behaviour

- All data should be based on the currently selected vehicle.
- Date range should be configurable where applicable.
- Dashboard cards should navigate to their relevant module.
- Support loading, empty, and error states.
- Users should be able to customize or rearrange dashboard widgets in a future version.

---

## Module 2 — Garage / Vehicle Management

The Garage manages all vehicles owned or tracked by the user.

### Vehicle profile

- Manufacturer
- Model
- Variant
- Manufacturing year
- Registration date
- Registration number
- Fuel type
- Transmission type
- Engine displacement
- Engine configuration
- Vehicle category
- Current odometer
- Purchase date
- Purchase price
- Ownership type
- Vehicle image
- VIN/chassis number (optional)
- Engine number (optional)

### Vehicle configuration

- Fuel tank capacity
- Fuel specification
- Tyre size
- Engine oil specification
- Battery type
- Service interval configuration
- Manufacturer-recommended maintenance schedules
- Warranty details
- Vehicle-specific reminders

### Features

- Add vehicle
- Edit vehicle
- Delete vehicle
- Archive vehicle
- Set active vehicle
- Switch between vehicles
- View complete vehicle history
- Manage multiple vehicles
- Vehicle profile completion indicator

### Ownership types

- Owned
- Financed
- Leased (future)
- Family vehicle (future)

---

## Module 3 — Fuel Management

Manage fuel refills, consumption, mileage, and fuel-related analytics.

### Fuel record

- Vehicle
- Date and time
- Odometer reading
- Fuel type
- Fuel quantity
- Price per litre/unit
- Total amount
- Full tank / partial tank
- Fuel station name
- Location (optional)
- Payment method
- Receipt photo
- Notes

### Features

- Add fuel entry
- Edit fuel entry
- Delete fuel entry
- Fuel history
- Search and filter
- Full-tank tracking
- Partial fill tracking
- Fuel expense synchronization
- Fuel station history
- Fuel receipt management

### Calculations

- Mileage (km/L)
- Distance between fill-ups
- Average fuel price
- Fuel cost per kilometre
- Monthly fuel expenditure
- Monthly fuel consumption
- Average fuel efficiency
- Fuel usage trends
- Best and worst recorded mileage

### Analytics

- Mileage graph
- Fuel expenditure graph
- Monthly consumption
- Price trends
- Fuel efficiency comparison
- City vs highway fuel efficiency (when manually categorized)

### Validation

- Odometer cannot be lower than a previous valid reading without correction handling.
- Mileage calculations must account for partial fill-ups.
- Mileage should only be calculated from reliable fill-up sequences.
- Invalid or incomplete records should not produce misleading mileage statistics.

---

## Module 4 — Expense Management

Track all financial expenses related to vehicle ownership.

### Expense categories

- Fuel
- Maintenance
- Repairs
- Insurance
- EMI
- Tolls
- Parking
- Washing and cleaning
- Accessories
- Tyres
- Batteries
- Fines and challans
- Registration
- Other

### Expense record

- Vehicle
- Category
- Subcategory
- Amount
- Date
- Description
- Payment method
- Vendor/service provider
- Receipt or invoice
- Notes
- Recurring expense flag

### Features

- Add expense
- Edit expense
- Delete expense
- Expense history
- Search
- Filters by category, month, date, and amount
- Recurring expenses
- Receipt attachments
- Monthly summaries
- Yearly summaries
- Category breakdown
- Payment method breakdown

### Integrations with other modules

- Fuel entries automatically create fuel expenses.
- Service records can create maintenance expenses.
- Trip expenses can be linked to a trip.
- Insurance records can create insurance expenses.
- EMI records can be associated with vehicle loans.

### Analytics

- Total expenses
- Monthly expenses
- Annual expenses
- Category totals
- Monthly comparison
- Average monthly expenses
- Expense trends
- Cost per kilometre

### Financial accuracy

- Avoid duplicate expenses when records originate from other modules.
- Support expense origin and linked record references.
- Allow principal and interest to be distinguished in loan payments.
- Do not treat loan principal as an economic expense in ownership-cost reporting.

---

## Module 5 — Maintenance & Service Management

Manage scheduled maintenance, component life, service history, and repair records.

### A. Maintenance schedule

Each maintenance task should support:

- Task/component name
- Description
- Maintenance category
- Interval in kilometres
- Interval in months
- Last completed date
- Last completed odometer
- Next due date
- Next due odometer
- Reminder configuration
- Priority
- Status
- Notes

### B. Vehicle components

Track components including:

- Engine oil
- Oil filter
- Air filter
- Cabin filter
- Spark plugs
- Coolant
- Brake pads
- Brake fluid
- Tyres
- Battery
- Transmission fluid
- Wipers
- Other components

### C. Maintenance statuses

- Good
- Upcoming
- Due
- Overdue
- Needs inspection
- Replaced
- Monitoring

### D. Service records

- Service title
- Service date
- Odometer
- Service centre/workshop
- Service type
- Labour charges
- Parts charges
- Total amount
- Parts replaced
- Work performed
- Invoice attachments
- Warranty information
- Notes

### E. Features

- Create maintenance schedules
- Edit schedules
- Complete maintenance task
- Record component replacement
- Add service history
- View service timeline
- Track repair history
- Attach invoices
- Track part warranty
- Reminders based on date or distance
- Maintenance cost analytics
- Upcoming maintenance list
- Overdue maintenance list

### F. Maintenance rules

- Maintenance can be based on time, distance, or both.
- If both are configured, whichever occurs first should trigger the due status.
- Schedule intervals must be configurable per vehicle.
- Manufacturer recommendations should be preferred over generic defaults.
- Completing a task updates its maintenance history and next due calculation.
- Maintenance status should update when odometer readings change.

---

## Module 6 — Documents & Reminders

Manage vehicle documents, their details, digital copies, and expiration reminders.

### Document types

- Registration Certificate (RC)
- Insurance
- Pollution Under Control (PUC)
- Driving licence
- Warranty
- Roadside assistance
- Loan documents
- Service invoices
- Purchase invoices
- Other documents

### Document fields

- Document name
- Document type
- Vehicle
- Document number
- Issuer/provider
- Issue date
- Expiry date
- File attachment
- Notes

### Features

- Upload PDF
- Upload images
- Scan documents using camera
- Preview documents
- Download documents
- Edit document metadata
- Delete document
- Search documents
- Categorize documents
- Secure file storage

### Reminders

- Expiry reminders
- Custom reminder intervals
- 30-day reminder
- 7-day reminder
- 1-day reminder
- User-defined reminder dates

### Document intelligence (future AI)

- Extract document information from PDFs and images.
- Identify document type.
- Extract expiry date.
- Extract document number.
- Extract insurer/provider details.
- Extract policy coverage.
- Require user confirmation before saving extracted information.

---

## Module 7 — Trips & Journey Tracking

Record trips, journeys, travel costs, and driving history.

### Trip record

- Trip name
- Vehicle
- Starting location
- Destination
- Start date and time
- End date and time
- Starting odometer
- Ending odometer
- Total distance
- Trip type
- Route
- Fuel estimate
- Toll charges
- Parking charges
- Other expenses
- Notes
- Photos

### Trip categories

- Daily commute
- Personal
- Road trip
- Business
- Other

### Features

- Create trip
- Edit trip
- Complete trip
- Cancel trip
- Trip history
- Trip detail view
- Map route (future)
- Attach trip expenses
- Attach photos
- Trip notes

### Analytics

- Total trips
- Total distance
- Average distance per trip
- Longest trip
- Trip expenses
- Monthly travel
- Travel categories
- Trip cost per kilometre

### Future enhancements

- GPS trip tracking
- Automatic trip detection
- Route history
- Navigation integration
- Trip sharing

---

## Module 8 — Analytics & Cost of Ownership

Provide a complete understanding of the cost, usage, and ownership economics of the vehicle.

### A. Fuel analytics

- Average mileage
- Mileage trends
- Fuel consumption
- Monthly fuel expenditure
- Fuel price trends
- Fuel cost/km
- City/highway comparison

### B. Expense analytics

- Monthly expense totals
- Yearly expense totals
- Category breakdown
- Expense trends
- Highest spending month
- Average monthly spending
- Recurring expenses
- Expense comparisons

### C. Vehicle usage analytics

- Total kilometres driven
- Monthly distance
- Yearly distance
- Average daily usage
- Average trip distance
- Driving frequency

### D. Cost of ownership

- Purchase price
- Down payment
- Loan amount
- Loan principal paid
- Loan interest paid
- Fuel costs
- Maintenance
- Repairs
- Insurance
- Taxes/fees
- Tolls
- Parking
- Accessories
- Depreciation
- Estimated resale value

### E. Calculations

- Total ownership cash outflow
- Operating cost
- Running cost/km
- Total ownership cost/km
- Average monthly cost
- Yearly cost
- Cost excluding loan principal
- Depreciation estimate
- Projected yearly cost

### F. Reporting

- Monthly report
- Annual report
- Vehicle ownership report
- Fuel report
- Maintenance report
- Expense report
- Export to CSV
- Export to PDF

---

## Module 9 — AI Car Assistant

An AI assistant that understands the user's vehicle, actual records, driving history, expenses, and maintenance schedules.

### A. General car assistance

- Explain vehicle features.
- Explain dashboard warning lights.
- Explain automotive terminology.
- Answer general car maintenance questions.
- Explain service procedures at a high level.
- Help prepare checklists.

### B. Personal vehicle intelligence

- Analyze fuel history.
- Analyze mileage trends.
- Summarize maintenance records.
- Summarize expenses.
- Answer questions about vehicle history.
- Compare spending across months.
- Identify unusual changes in recorded data.

### C. Planning

- Road-trip preparation.
- Upcoming maintenance planning.
- Vehicle maintenance budget.
- Fuel budget estimates.
- Long-trip checklist.
- Seasonal vehicle preparation.

### D. AI tools

The assistant may have controlled access to backend tools such as:

- Get vehicle profile
- Get fuel history
- Calculate mileage
- Get expenses
- Calculate monthly costs
- Get service history
- Get upcoming maintenance
- Get documents and expiry dates
- Get trips
- Get ownership analytics

### E. AI behaviour

- Use actual records for personal-data answers.
- Never invent user records.
- Perform calculations through backend functions.
- Explain uncertainty.
- Ask clarification when records are insufficient.
- Never provide definitive mechanical diagnoses.
- Never make changes without user confirmation.
- Keep conversations organized.
- Support conversational context.
- Allow conversation history and deletion.

---

## Module 10 — Notifications Center

Centralized notifications for all AutoMate modules.

### Notification types

- Maintenance upcoming
- Maintenance overdue
- Document expiring
- Insurance renewal
- PUC renewal
- Fuel efficiency change
- Expense reminders
- Trip reminders
- Custom reminders
- AI-generated insights (future)

### Features

- Notification inbox
- Read/unread
- Priority levels
- Notification category
- Date and time
- Related vehicle
- Related record
- Deep links
- Snooze
- Dismiss
- Delete
- Notification preferences

### Channels

- In-app notifications
- Push notifications
- Local notifications

---

## Module 11 — Settings & Personalization

Manage user preferences, application configuration, and security.

### User profile

- Name
- Email
- Profile photo
- Account details

### Preferences

- Currency
- Distance units
- Fuel units
- Date format
- Timezone
- Language
- Theme
- Default vehicle
- Dashboard preferences

### Notification settings

- Enable/disable notifications
- Maintenance reminders
- Document reminders
- Expense reminders
- Custom reminder settings
- Notification timing

### Security

- Password management
- Sessions
- Biometric app lock
- App PIN
- Logout
- Account deletion
- Privacy settings

---

## Module 12 — Backup, Import & Export

Data portability and backup management.

### Export capabilities

- Fuel history CSV
- Expense CSV
- Service history CSV
- Trip history CSV
- Vehicle details
- Ownership report PDF
- Complete vehicle archive

### Backup

- Backup vehicle records
- Backup expenses
- Backup maintenance history
- Backup fuel records
- Backup trip records
- Backup documents and attachments

### Restore

- Restore backup
- Validate imported data
- Detect duplicates
- Preview import
- Confirm restore

### Data management

- Archive vehicle
- Delete vehicle
- Transfer ownership
- Delete specific records
- Export all user data
- Delete account and associated data

---

## 13. Cross-module requirements

These requirements apply to the entire application rather than a single module.

- **Vehicle isolation** — All records must belong to a user and a vehicle where applicable. Users must not access other users' data.
- **Unified activity history** — Fuel entries, expenses, service records, trips, documents, and reminders should contribute to a unified vehicle activity timeline.
- **Data consistency** — When a record is created, edited, or deleted, related analytics and records must update consistently.
- **Duplicate prevention** — Records originating from fuel, service, insurance, or trips should not create duplicate financial entries.
- **Search** — Provide global or vehicle-level search for records, documents, service history, expenses, and trips.
- **Attachments** — Support images and PDFs where relevant, with secure storage and proper access control.
- **Odometer management** — Maintain a consistent odometer history and flag conflicting or suspicious readings.
- **Multi-vehicle support** — The user should be able to switch vehicles without mixing records or analytics.
- **Responsive UI** — Mobile-first design, with tablet support and future web dashboard compatibility.
- **Offline readiness** — Architecture should allow offline record creation and later synchronization in a future phase.
- **Localization** — Support Indian currency, metric units, Indian date conventions, and localization-ready text.

---

## 14. Product development priority

Do not implement all modules at once. Follow this priority.

| Priority | Modules         | Purpose                           |
| -------- | --------------- | --------------------------------- |
| P0       | Garage          | Establish vehicle data            |
| P0       | Fuel            | Track real mileage                |
| P0       | Expenses        | Track ownership costs             |
| P0       | Dashboard       | Present core information          |
| P1       | Maintenance     | Prevent missed servicing          |
| P1       | Documents       | Keep vehicle documents organized  |
| P1       | Notifications   | Timely reminders                  |
| P2       | Analytics       | Deeper ownership insights         |
| P2       | Trips           | Journey tracking                  |
| P3       | AI assistant    | Personalized vehicle intelligence |
| P3       | Settings        | Advanced personalization          |
| P3       | Backup & Export | Portability and ownership reports |
