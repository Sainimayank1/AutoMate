# Application Shell and Navigation

There is one shell for the whole product: `components/layout/AppShell` (shadcn `SidebarProvider` + `AppSidebar` + `SidebarInset` containing `AppHeader` and the routed page). Modules never render their own sidebar, header or navigation chrome. Auth and onboarding are the only routes outside the shell.

## Navigation structure

The navigation is driven by `apps/web/src/app/modules.ts`, the single registry for routes and the sidebar. The target grouping is below; update `NavGroup`, `NAV_GROUP_LABELS` and each module's `navGroup` when the shell is next touched.

| Group (overline label) | Items (icon)                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Overview**           | Dashboard (`LayoutDashboard`)                                                                                 |
| **My vehicles**        | Garage (`Car`)                                                                                                |
| **Management**         | Fuel (`Fuel`), Expenses (`ReceiptIndianRupee`), Maintenance (`Wrench`), Documents (`FileText`), Trips (`Map`) |
| **Intelligence**       | Analytics (`ChartNoAxesCombined`)                                                                             |
| **Personal**           | Notifications (`Bell`, with unread count), Settings (`Settings`), Backup & Export (`DatabaseBackup`)          |

The order is fixed. Keep it compact: no nested sub-menus in the sidebar. Sub-views are tabs inside the module.

## Desktop shell (md+)

```
┌──────────────┬────────────────────────────────────────────────────────┐
│ ◔ AutoMate   │ ☰ │ Garage › Victoris › Fuel   [⌕ Search… ⌘K]  ＋  🔔 ◐ (A) │  ← header h-14 (md:h-16), sticky, translucent
│ ┌──────────┐ ├────────────────────────────────────────────────────────┤
│ │▣ Victoris│ │ PageHeader: title · description          [Secondary][Primary] │
│ │HR 26 AB..│ │                                                        │
│ └──────────┘ │ page content (PageContainer, max-w-7xl)                 │
│ OVERVIEW     │                                                        │
│  Dashboard   │                                                        │
│ MY VEHICLES  │                                                        │
│  Garage      │                                                        │
│ MANAGEMENT … │                                                        │
└──────────────┴────────────────────────────────────────────────────────┘
```

**Sidebar** (`collapsible="icon"`, `SidebarRail`):

- **Header:** `BrandLogo`, then `VehicleSelector` below it. When collapsed, it shows the mark and the vehicle thumb.
- **Content:** the five groups with `SidebarGroupLabel` styled as overlines.
- **Footer:** nothing, or a compact plan/storage note later. The user menu lives in the header.
- **Active item:** use the primitive's `isActive` (sidebar-accent fill) with the icon in `text-primary`. Use only that one cue: no left bars plus glows plus bold.
- **Collapsed:** icons only, with tooltips (the primitive handles this). The collapse state persists in the cookie (already implemented).

**Header** (left → right):

1. `SidebarTrigger`.
2. `Breadcrumbs`.
3. Global search trigger: a `SearchInput`-looking button "Search records…" with a `⌘K` / `Ctrl K` hint, `max-w-sm`, hidden below `lg` (icon button there).
4. Spacer.
5. Quick add `Plus` (opens the QuickAdd menu).
6. Notifications `Bell` with an unread dot or count (cap "9+").
7. `ThemeToggle`.
8. `UserMenu`.

**PageHeader.** The title matches the nav label or the record name. The description is one line, optional on module roots. Actions are at most 1 primary + 1 secondary + an `Ellipsis` overflow. A `DateRangePicker` goes in the actions on analytical pages.

**Breadcrumbs.** Built from route `handle.title`, for example `Garage › Maruti Suzuki Victoris › Fuel history`. Shown on desktop only. The current page is not a link. Collapse middle crumbs into an ellipsis menu after 4 levels.

## Mobile shell (< md)

```
┌──────────────────────────────┐
│ ▣ Victoris ▾ HR 26…   ⌕ 🔔 (A)│  ← top-level page: vehicle switcher
│ ‹  Fuel entry           ⋯    │  ← detail page: back + title + overflow
├──────────────────────────────┤
│ content (px-4)               │
│                              │
├──────────────────────────────┤
│  ⊞      ⛽     (＋)    ₹    ≡  │  ← bottom nav h-16, safe-area padded
│ Home   Fuel   Add  Expenses More│
└──────────────────────────────┘
```

**Header** (`h-14`, `md:h-16` as in Stitch):

- On top-level routes, the left side shows the `VehicleSelector` trigger (thumb + model + chevron). On detail and sub-routes, it shows a back button (`ChevronLeft`, `aria-label="Back"`) and a truncated title.
- The right side has a search icon, the notifications bell and the avatar (`UserMenu`). `ThemeToggle` moves into the user menu on mobile.

**Bottom navigation** (new `components/layout/bottom-nav.tsx`, `md:hidden`, `z-20`):

- Five slots: **Dashboard** · **Fuel** · **Add** (centre, `bg-primary text-primary-foreground` circle `size-12`, opens `QuickAddSheet`) · **Expenses** · **More** (opens the sidebar drawer with the full grouped nav).
- Each slot is ≥ 48 px tall. The icon is `size-5` and the label is `text-xs`.
- The active slot has the icon and label in `text-primary`. The others are `text-muted-foreground`.
- Hide it on full-screen flows: forms and wizards, document preview. Those show their own sticky action bar.
- The page content gets `pb-20 md:pb-0` so nothing hides behind it.

**QuickAddSheet** (Stitch "Quick Add Sheet — Mobile"). A bottom `Sheet` (shadcn's, rounded top; a vaul `Drawer` would add drag-to-dismiss and a dependency) with a 2-column grid of large tiles (icon + label) and a "Cancel" button. The order is Fuel entry, Expense, Service record, Trip, Document, Reminder. Each opens the add form for the active vehicle. On desktop, the same list renders as the header `Plus` `DropdownMenu`.

**Drawer navigation.** "More" opens the shadcn sidebar's mobile `Sheet` (already implemented) with the same groups, `VehicleSelector` at the top and the user summary at the bottom.

## Vehicle context

- One **active vehicle** (persisted id in `stores/vehicle-store.ts`) scopes Dashboard, Fuel, Expenses, Maintenance, Documents and Trips.
- Switching is instant. Queries keyed by `vehicleId` refetch and show skeletons, and the URL keeps the current module. There is no toast and no confirmation.
- **"All vehicles"** is offered only where aggregation is meaningful: Analytics (comparison), the Expenses overview and Notifications. It is shown as the first option in the selector, labelled "All vehicles" with a `Layers` icon. Mixed data is never silent: when it applies, the page header shows the vehicle scope.
- Records always display their vehicle when the view spans more than one vehicle (`PlateBadge` or thumb in each row).

## Global search

- **Open with:** `⌘K` / `Ctrl K`, `/` (when not typing), the header search button, or the mobile header icon.
- **UI:** shadcn `Command` in a `Dialog` (`sm:max-w-xl`) on desktop; full-screen on mobile with the input autofocused.
- **Empty query:** shows Recent searches (last 5, clearable) and Quick actions (Add fuel entry, Add expense, Go to…).
- **Category filter chips** under the input: All · Vehicles · Fuel · Expenses · Service · Documents · Trips.
- **Results** are grouped by category, at most 5 per group with "Show all n" leading to the module list prefiltered with `?q=`. Each row has the module icon, a title, meta (date · amount or odometer · vehicle plate) and highlighted match text.
- **States:** searching (skeleton rows, debounce 250 ms), no results ("No matches for 'xyz'" plus suggestions), error (inline retry).
- Full keyboard navigation: arrow keys, `Enter` to open, `Esc` to close. Focus returns to the trigger on close.

## Notifications entry point

- **Desktop:** the bell opens a `Popover` (`w-96`) with the latest 6 items (unread first, with a cyan dot), "Mark all as read" and "View all" linking to `/notifications`.
- **Mobile:** the bell navigates to `/notifications`.
- Each item deep-links to its source record (see `module-design-guidelines.md`, Notifications).

## Profile menu

`UserMenu` contains:

- the name, email and avatar;
- Profile, Preferences, Appearance (Theme radio on mobile), Backup & Export;
- keyboard shortcuts (desktop);
- Sign out.

Sign out sits last, separated by a divider. It is not destructive-coloured.

## Routing conventions

- Module roots: `/dashboard`, `/garage`, `/fuel`, `/expenses`, `/maintenance`, `/documents`, `/trips`, `/analytics`, `/notifications`, `/settings`, `/backup`.
- **Detail pages** are `/<module>/:id`. Vehicle detail tabs are `/garage/:vehicleId/:tab` (`overview`, `specifications`, `fuel`, `expenses`, `maintenance`, `documents`, `trips`, `cost`), so tabs can be deep-linked and shared.
- Add and edit flows open as a `ResponsiveDialog` over the list for simple records (fuel, expense, trip). Multi-step flows (add vehicle, import, restore) get full routes (`/garage/new`, `/backup/import`).
- Filters, sort, date range and pagination live in URL search params.
- Each route sets `handle.title` (used for breadcrumbs and `<title>` as "Fuel · AutoMate").
