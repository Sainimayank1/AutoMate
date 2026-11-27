# Interaction Patterns

## Universal screen states

Every data-driven screen and section implements all of these.

| State | Pattern |
| --- | --- |
| **Loading** | A `Skeleton` layout matching the final shape (same grid, card heights and row count of about 5). Sections load independently, so one slow query doesn't blank the page. `LoadingState` (spinner) only for small inline areas. No skeleton flash: rely on TanStack Query's cached data, and use `placeholderData: keepPreviousData` for filter and page changes so the old data stays visible with a subtle `opacity-60`. |
| **Empty: first use** | `EmptyState` with the module icon, a factual title, one sentence of value and the primary action. "No fuel entries yet" / "Add your first fill-up to start tracking mileage." / [Add fuel entry] |
| **Empty: filtered** | "No results for these filters" + "Clear filters". Never show the first-use CTA when filters hide data. |
| **Empty: insufficient data** | For calculated metrics and charts: "—" plus what's needed ("Needs 2 full-tank fills"). |
| **Error** | `ErrorState` with a safe message and Retry, scoped to the failed section. Page-level failures use `RouteError`. Never show raw error text or codes. |
| **Success** | Toast for mutations, the list updates (query invalidation), and the new item is briefly highlighted (`bg-primary/5` fading over 1.5 s, motion-safe). After creating a primary object (vehicle), navigate to it. |
| **Disabled** | Show the control disabled, with the reason in a tooltip or caption ("Add a vehicle first"). Don't hide actions the user expects. |
| **Pending** | The button keeps its label with a spinner ("Saving…"), the form is disabled, and double submission is prevented. |
| **Confirmation** | `ConfirmDialog` before destructive or irreversible actions (see below). |
| **Offline / slow** | A global `sonner` toast on network errors (existing `query-client`), with the inline retry kept. |

## Feedback rules

- Show feedback within 100 ms of any action (pressed state, pending state).
- **Optimistic updates** are only for trivial, reversible toggles (mark notification read, pin a widget). **Never be optimistic about calculated numbers:** mileage, totals and cost per km always come from the API response.
- A toast is one line, past tense: "Fuel entry added", "Vehicle archived", "Reminder snoozed until 30/11/2026". Undo is offered for deletes and archives where the API supports it.
- Validation errors go inline at the field, never in a toast. Server field errors map to fields via `applyServerErrors`.
- **Unsaved changes:** forms with dirty state block navigation with "Discard changes?" (React Router `useBlocker` + `AlertDialog`).

## Destructive actions

| Action | Dialog | Copy rules |
| --- | --- | --- |
| Delete simple record | `ConfirmDialog` destructive | Title "Delete fuel entry?" · Body names the record ("19/11/2026 · 30.00 L · ₹2,845.50") and **linked effects** ("The linked expense will also be deleted.") · Buttons "Cancel" / "Delete fuel entry" |
| Archive | `ConfirmDialog` default | Explain that it is reversible and where to find it later |
| Delete vehicle / account / restore backup | Destructive with typed confirmation | List the counts of what is affected; offer the safer alternative (Archive, Export first, auto-backup) |

The confirm button is always verb + object, and never focused by default for destructive dialogs (focus goes to Cancel).

## Key flows

**Vehicle switching.** Selector → pick a vehicle. The vehicle store updates, vehicle-scoped queries refetch, skeletons show in place, and the current route and filters stay (except record-detail routes, which go to the module root). The header and selector update instantly.

**Add vehicle.** See the wizard in `module-design-guidelines.md` (M02). Progress is visible, back is safe, the review step is required, and you land on the vehicle detail page.

**Add fuel (≤ 30 s).**
1. Bottom nav "Add", then "Fuel entry". The form opens with the vehicle, date, fuel type, last price and station prefilled.
2. The user enters the odometer, then any two of quantity, price and total.
3. Save, see the toast "Fuel entry added · 18.2 km/L" (the mileage from the API response, if available), and the drawer closes.

**Add expense.** Category tile, amount, then save. Everything else is optional or prefilled. Fuel and EMI redirect to their origin flows.

**Complete maintenance.** From a component tile or a notification, choose "Mark as completed". The dialog is prefilled with today and the last odometer and asks for cost and notes. Saving updates the status to Good, recomputes the next due (from the API), and creates the linked expense, mentioned in the toast.

**Upload documents.** Drop or pick a file, see upload progress, then fill the metadata form alongside the preview. Expiry dates create reminders automatically, shown as a caption ("Reminders set for 30, 15, 7 and 1 days before").

**Create trip.** Type, odometer start (prefilled) and end, then save, which shows the distance computed. Linked expenses can be attached afterwards.

**Filtering records.**
- Filters live in URL params, and active filters show as chips with an × and "Clear all".
- Result counts are shown ("42 entries").
- The date range applies page-wide.

**Global search.** See `application-navigation.md`. Selecting a result navigates and closes. Recent searches are stored locally.

**Theme switching.** `ThemeToggle` (Light / Dark / System) applies instantly with no transition flash (`disableTransitionOnChange` is already set). It is persisted in `automate.theme`.

**Navigating related records.** Every record that originates from or links to another shows a link chip with the module icon and a title, for example "From fuel entry · 19/11/2026", "Linked expense · ₹2,845.50" or "Invoice · Service at 5,000 km". The chips open the related record (a Sheet if it's in the same module, otherwise a route). Back returns to the origin.

## Motion

| What | Duration | Easing | Notes |
| --- | --- | --- | --- |
| Hover and focus colour changes | 150 ms | ease-out | `transition-colors` |
| Popover, menu, tooltip | 150 ms | primitive defaults (`tw-animate-css`) | fade + 2–4 px slide/zoom |
| Dialog, sheet, drawer | 200–250 ms | ease-out in, ease-in out | primitive defaults |
| Gauge or progress value change | 400 ms | ease-out | motion-safe only |
| New-item highlight | 1.5 s fade | linear | motion-safe only |
| Skeleton | pulse (primitive) | — | — |

Rules:
- Wrap non-essential motion in `motion-safe:`. Respect `prefers-reduced-motion`.
- **Banned:** bounce, spring overshoot, parallax, auto-playing carousels, count-up numbers, animated gradients, hover lift and shadow on cards, page-transition animations.
- Animate only `opacity` and `transform` (plus SVG `stroke-dashoffset` for gauges), never layout properties.

## Keyboard shortcuts (desktop)

| Keys | Action |
| --- | --- |
| `⌘K` / `Ctrl K`, `/` | Global search |
| `N` then `F` / `E` / `S` / `T` | New fuel entry / expense / service record / trip (only when not typing) |
| `Esc` | Close the overlay |
| `⌘B` / `Ctrl B` | Toggle the sidebar (primitive) |

These are listed in the user menu under "Keyboard shortcuts".
