# Component Guidelines

## Decision ladder (follow in order)

1. **A shadcn primitive in `components/ui/`.** Use it with `className` or variants.
2. **An app building block** in `components/common/`, `components/feedback/` or `components/layout/`.
3. **A shadcn primitive that isn't installed yet.** Add it with `pnpm dlx shadcn@latest add <name>` (run in `apps/web`). Likely ones: `chart`, `drawer`, `command`, `progress`, `toggle-group`, `scroll-area`, `hover-card`, `collapsible`.
4. **A feature component** in `features/<id>/components/`.
5. **A new shared component** in `components/common/`, only when a second module needs it. Move it up; don't copy it.

Never:

- create a second version of an existing component (`StatCard2`, `MyButton`);
- fork a primitive per feature;
- add another component library (MUI, Chakra, Mantine, Headless UI);
- add an icon set other than Lucide.

Edit `components/ui/*` only for an app-wide change, with a comment explaining why.

## Existing inventory

| Component                                                        | Path                                      | Notes                                                                                |
| ---------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------ |
| `PageContainer`                                                  | `common/page-container.tsx`               | Page frame. Every page uses it.                                                      |
| `PageHeader`                                                     | `common/page-header.tsx`                  | h1, description, actions. At most 1 primary + 1 secondary action + an overflow menu. |
| `SectionHeader`                                                  | `common/section-header.tsx`               | h2, description, actions ("View all" as a `ghost` button or link)                    |
| `Breadcrumbs`                                                    | `common/breadcrumbs.tsx`                  | Built from route `handle.title`; desktop only                                        |
| `SearchInput`                                                    | `common/search-input.tsx`                 | Controlled, with a clear button; used in filter bars                                 |
| `StatCard`                                                       | `common/stat-card.tsx`                    | KPI tile: label, value, hint, icon, optional `href`, `loading`                       |
| `DataTable`                                                      | `common/data-table.tsx`                   | TanStack Table: sort, pagination, loading and empty rows                             |
| `ConfirmDialog`                                                  | `common/confirm-dialog.tsx`               | Async pending state, destructive variant                                             |
| `FormField` / `FormError`                                        | `common/form-field.tsx`, `form-error.tsx` | RHF wiring, `aria-invalid`, error text                                               |
| `DatePicker`                                                     | `common/date-picker.tsx`                  | Popover + Calendar, DD/MM/YYYY                                                       |
| `EmptyState`, `ErrorState`, `LoadingState`, `LoadingSkeleton`    | `feedback/`                               | All states (see `interaction-patterns.md`)                                           |
| `AppShell`, `AppSidebar`, `AppHeader`, `ThemeToggle`, `UserMenu` | `layout/`                                 | The one shell                                                                        |

## Planned shared components

Build each one **once**, when the first module needs it, to these specs.

### StatCard: extend it, don't add a MetricCard

A "MetricCard" is `StatCard` with two optional props:

- `trend?: { value: ReactNode; tone: "positive" | "negative" | "neutral" }` renders as a caption with a `TrendingUp`/`TrendingDown` icon, coloured by meaning (see the trends section in `color-system.md`);
- `chart?: ReactNode` is a sparkline slot (Recharts, `h-10`, no axes, `chart-1` stroke).

The value can show an unreliable state: `value="—"` with a hint explaining why.

### MetricValue

Renders a number plus a muted unit (see the split-units rule in `typography.md`). Props: `value`, `unit`, `size: "hero" | "lg" | "md"`. Used inside the hero, StatCard and vehicle tiles.

### StatusBadge

`<StatusBadge domain="maintenance" status="overdue" />`. It takes the token, icon and label from the single mapping in `color-system.md`, so features never pick status colours themselves. Variants: `badge` (default) and `dot` (a 8 px `rounded-full` dot plus text, for dense lists).

### PlateBadge

The theme's signature (`components/common/plate-badge.tsx`): the registration set like an Indian number plate. A white plate in either theme (`bg-plate`, `text-plate-foreground`, constant tokens in `@theme`), `rounded-sm` with a `border-plate-foreground/15` edge, Geist Mono `text-xs font-medium tabular-nums` letters, and a thin `w-1 bg-brand` strip on the left (the IND band, in the accent). Use it wherever a vehicle is named by its plate (the sidebar switcher, the vehicle switcher items, the dashboard hero, the vehicle card, the vehicle page) and nowhere else: not in table cells, search results or plain text, where the plate is `font-mono` text. It formats with hyphens, as in Stitch: `HR-26-EV-4821` (`formatRegistration`; plates are stored normalised as `HR26EV4821`).

### VehicleImage

`components/common/vehicle-image.tsx`. Photos aren't supported yet (they arrive with secure file storage), so it always renders the fallback panel from `brand-identity.md`. Props: `make`, `model`, `variant: "panel" | "thumb"`, `showLabel`, and children for overlays (badges, plate). The thumb is `size-10 rounded-md`.

### VehicleCard

Garage grid item:

- `VehicleImage` (card aspect) with a "Primary" badge top-left when it is the default vehicle;
- body: make and model (`text-sm font-medium`), variant · fuel · transmission (caption), `PlateBadge`;
- footer row of 3 tiles: odometer, mileage, this month's spend.

States: default, hover (`bg-elevated`), active vehicle (a neutral `border-primary/50` plus the "Active vehicle" badge), archived (`opacity-60` plus an "Archived" badge, hidden behind a filter by default), loading skeleton with the same shape. The whole card is a link to `/garage/:id`, and the overflow menu (`Ellipsis`) opens Edit, Set as active, Archive and Delete.

### VehicleSelector

Shows the active vehicle everywhere; backed by `stores/vehicle-store.ts`.

- **Trigger:** `VehicleImage` thumb, model name (`text-sm font-medium`), `PlateBadge`, `ChevronsUpDown`.
- **Content** (`components/layout/vehicle-selector.tsx`): a `DropdownMenu` (inside the mobile sidebar drawer on phones). It lists vehicles with thumb, name and `PlateBadge`, a `text-brand` check on the active one, archived vehicles hidden, and footer actions "Add vehicle" and "Manage garage". The choice is per device (`stores/vehicle-store.ts`, `useActiveVehicle()`); a missing or archived choice falls back to the first vehicle.
- **States:** loading (skeleton trigger), no vehicles (the trigger becomes "Add your first vehicle").
- **Placement:** the desktop sidebar header (collapses to the thumb only), and the mobile header on top-level pages.

### ChartCard

Card containing a `CardHeader` (title, optional description, right slot for a period `ToggleGroup` or a legend), a chart body with a fixed height (`h-56 md:h-72`) and an optional footer insight line.

- Build it on the shadcn `chart` component (`ChartContainer`, `ChartTooltip`) with a `ChartConfig` that maps series to `var(--chart-n)`.
- States: loading (`Skeleton` at the same height), empty (a small inline `EmptyState` inside the body: "Not enough data yet · Add 2 full-tank fills to see mileage"), error (an inline `ErrorState` with retry).
- Accessibility: see `accessibility.md`.

### GaugeRing

SVG arc (270°, open at the bottom), with a track in `stroke-muted` and the value in `stroke-primary` (neutral) or a status token, plus the centred value via `MetricValue`. Sizes are `sm` 64 px and `lg` 160 px. It has `role="img"` and an `aria-label` ("Vehicle health 86 out of 100"). Animate the stroke from its previous value in 400 ms, ease-out, motion-safe only.

### FilterBar

A row of `SearchInput`, filter `Select`/`Popover` triggers, a `DateRangePicker` and a "Clear filters" ghost button. Active filters show as removable chips beneath it.

- Filters live in URL search params so they survive reloads and links can be shared.
- On mobile, only the search field and a "Filters (n)" button remain visible; the button opens a bottom `Drawer` with all filters and "Apply".

### DateRangePicker

Extends `DatePicker` with `Calendar mode="range"` and presets: This month, Last month, Last 3 months, This year, Last 12 months, All time, Custom. The trigger shows "01/11/2026 – 27/11/2026" or the preset name. One instance per page, in the PageHeader actions or the FilterBar.

### ActivityTimeline

Vertical list grouped by date ("Today", "Yesterday", then DD/MM/YYYY). Each item has a module icon on a `bg-elevated` `size-8 rounded-md` tile, a title, meta (odometer · amount) and a link to the source record. A 1 px `border-l` connects the items. Used for dashboard recent activity, the vehicle detail overview and the trip history mobile view.

### FileUpload

Built on `react-dropzone` (a planned dependency).

- **Dropzone:** a dashed `border-input` box, `rounded-xl`, with an `Upload` icon, the copy "Drop a photo or PDF, or browse", and the limits (types and size) in a caption.
- **States:** idle, drag-over (`border-primary`, neutral), uploading (a `Progress` per file with a cancel button), done (file row with thumbnail, name, size and remove), error (destructive caption with retry).
- On mobile, the "browse" button offers the camera through `accept="image/*,application/pdf"` with `capture` left unset, so the OS lets the user choose.

### DocumentPreview

Images use a zoomable `<img>` with `object-contain` on `bg-elevated`. PDFs use `react-pdf` (planned), with page navigation, a zoom `ToggleGroup` and download. It opens in a full-screen `Dialog` (desktop) or `Drawer` (mobile). Metadata (type, number, issue and expiry dates, status) sits in a side panel or below.

### ResponsiveDialog

Renders `Dialog` at `md+` and a bottom `Drawer` below it, sharing the header, body and footer slots. Use it for every form or detail overlay instead of picking one per feature. `ConfirmDialog` stays an `AlertDialog` at every width.

### QuickAddSheet and BottomNav

See `application-navigation.md`.

## Primitive usage rules

**Button**

- `default` (the neutral `primary`: off-white in dark, ink in light) is the main action, one per region. Buttons are never cyan.
- `outline` and `secondary` are for alternatives.
- `ghost` is for toolbars, "View all" and icon buttons.
- `destructive` appears only inside confirmations and the Settings danger zone.
- `link` is for inline text actions.
- **Loading:** keep the label, prepend `<Spinner />`, set `disabled` and change the label to its present participle ("Saving…").
- Icon buttons use `size="icon"` and `className="size-10 md:size-8"` for touch.

**Badge.** Only for status, counts and short metadata (Primary, Archived, Partial fill). It is never decorative. Use `StatusBadge` for statuses. Badges are `rounded-md` (the primitive's shape), not pills, and they are where status colour lives, together with icon tiles; the card or row around them keeps a neutral hairline.

**Card.** Groups an instrument or a set of related content. It must have a title unless it's a single `StatCard`. No card-in-card.

**Tabs.** Switches views of the same object (vehicle detail tabs, analytics sections). Use `variant="line"` for page-level tabs if available; otherwise the default style with `TabsList` full width on mobile and horizontally scrollable.

**Select vs RadioGroup vs ToggleGroup**

- 2–4 short options that should all be visible use a segmented `ToggleGroup` (Full / Partial tank, Petrol / Diesel / CNG / EV, period selectors).
- Options needing descriptions use `RadioGroup` cards.
- 5 or more options use `Select`.
- Long or searchable lists use `Command` in a `Popover` (combobox).

**Switch vs Checkbox.** A `Switch` applies immediately (settings toggles). A `Checkbox` is submitted with a form or used for multi-select.

**Tooltip.** Use it for icon-only buttons, truncated text and metric definitions ("Cost per km = operating cost ÷ distance"). Never put essential information only in a tooltip on mobile.

**Toasts (`sonner`)**

- Show a success toast after mutations ("Fuel entry added").
- Deletes get an "Undo" action where the API supports it.
- API errors come from the global handler in `lib/query-client.ts`. Don't toast validation errors; show them inline.

**Skeleton.** Mirror the final layout (same heights and grid). Never show a lone centred spinner for page content.

## Inputs (forms)

- **Wiring:** use `FormField` with RHF and zod schemas from `@automate/shared`. Map server errors with `applyServerErrors` from `lib/forms.ts`.
- **Optional fields** say "(optional)" in the label. Don't use asterisks.
- **Units:**
  - Units go in an `InputGroup` addon: suffix `km`, `L`, `km/L`; prefix `₹`.
  - Numeric fields use `inputMode="decimal"` (or `numeric` for odometer) and `react-number-format` (planned) for Indian grouping while typing.
- **Context hints** sit below the field as a caption, for example "Last reading: 8,450 km on 26/11/2026".
- **Derived fields:** with any two of quantity, price per litre and total, the third is computed and shown read-only with the caption "Calculated". The API stays authoritative on save.
- **Validation timing:** first on blur, then live once the field is dirty. Show errors under the field and scroll to the first error on submit.
- **Defaults reduce typing:** today's date and time, the active vehicle, the last fuel type, the last station and the last payment method.
