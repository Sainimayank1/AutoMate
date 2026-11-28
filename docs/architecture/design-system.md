# Design system (`apps/web`)

What the code implements today. Layouts and screens come from the Stitch project **"AutoMate Design System Platform"**; colour, type, labels and the plate follow the **Night dash** theme below, which replaced Stitch's palette and fonts in code only. Stitch was not updated, so where the two disagree on colour, type, labels, glow or the plate, this doc wins. The rules for designing new screens, including generating a missing screen in Stitch first, are in the `automate-design` skill (`.claude/skills/automate-design/`).

**Night dash.** Indian car owners log fuel, spend, service, papers and trips per vehicle and see what the car really costs. The character is exact, unhurried and a little mechanical; the world is an instrument cluster at night: neutral graphite surfaces (no blue tint), off-white text, hairline borders, tabular numbers, one cyan accent used rarely, and the registration plate as the signature. Direction set with the unslop skill by Damir Sokolovsky, CC BY 4.0. It's built on **shadcn/ui (Radix base, Nova preset)** and **Tailwind CSS v4**. All tokens are CSS variables in `apps/web/src/styles/index.css`.

## Rules

- **Build from Stitch.** Every screen's layout starts from its Stitch design (desktop and mobile). If the screen doesn't exist, generate it in Stitch first. Take colour and type from this doc, not from the Stitch HTML. The `automate-design` skill has the workflow.
- **Never hardcode colours.** Use semantic tokens (`bg-card`, `text-muted-foreground`, `border`, `bg-primary`…). Light and dark mode then come for free.
- **Don't rebuild primitives.** Buttons, dialogs, menus, popovers, tooltips, tabs and so on come from `components/ui/`. If a primitive is missing, add it with `pnpm dlx shadcn@latest add <name>` (run in `apps/web`).
- **Extend, don't fork.** Pass `className` or variants to a primitive. Edit a file in `components/ui/` only for an app-wide change, and note why in the file. Current edits:
  - `input.tsx` and `textarea.tsx` render placeholders at 60%, so they never read as typed values.
  - `field.tsx` targets `has-data-[state=checked]` for choice cards, because Radix radios mark selection with `data-state`, not `data-checked`.
  - `hooks/use-mobile.ts` was rewritten with `useSyncExternalStore`.
- **Restraint.** No gradients or glows (the one exception is the fade under an area chart's line), no backdrop blur, no gratuitous animation, no oversized cards. Separate areas with tonal surface steps and 1px borders rather than heavy shadows.

## Colour tokens

Dark is the default theme. Values live in `index.css` (`:root` light, `.dark` dark).

| Token                            | Dark                              | Light                             | Use                                                                          |
| -------------------------------- | --------------------------------- | --------------------------------- | ---------------------------------------------------------------------------- |
| `background`                     | `#141415`                         | `#FAFAFA`                         | Page canvas                                                                  |
| `sidebar`                        | `#0F0F10`                         | `#F4F4F5`                         | Sidebar                                                                      |
| `card`                           | `#19191B`                         | `#FFFFFF`                         | Cards, panels                                                                |
| `elevated`                       | `#232325`                         | `#F4F4F5`                         | Raised areas inside a card                                                   |
| `popover`                        | `#1C1C1F`                         | `#FFFFFF`                         | Menus, popovers, selects                                                     |
| `muted` / `secondary` / `accent` | `#202022` / `#232325` / `#232325` | `#F4F4F5` / `#F4F4F5` / `#EFEFF1` | Quiet fills, secondary buttons, hover                                        |
| `foreground`                     | `#EDEDED`                         | `#171717`                         | Primary text                                                                 |
| `muted-foreground`               | `#A1A1A6`                         | `#5C5C63`                         | Secondary text, labels (placeholders at 60%)                                 |
| `primary`                        | `#EDEDED`, text `#141415`         | `#171717`, text `#FAFAFA`         | **Neutral:** the main button fill; `text-primary` links read as foreground   |
| `brand`                          | `#0EA5E9`                         | `#0369A1`                         | **The one accent**, used rarely (list below)                                 |
| `sidebar-primary` / `ring`       | `#0EA5E9`                         | `#0369A1`                         | Active nav icon / focus ring (both = `brand`)                                |
| `insight`                        | `#A1A1A6`                         | `#525252`                         | Neutral grey, for insights (rule-based) only                                 |
| `success`                        | `#4CC38A`                         | `#166534`                         | Good, valid                                                                  |
| `warning`                        | `#E5A54B`                         | `#92400E`                         | Due, expiring soon                                                           |
| `destructive`                    | `#F06B6E`                         | `#B91C1C`                         | Overdue, expired, errors, delete                                             |
| `info`                           | `oklch(0.74 0.08 250)`            | `oklch(0.5 0.1 250)`              | Upcoming, notices (a toned blue)                                             |
| `border` / `input`               | foreground at 8% / 13%            | foreground at 9% / 18%            | Hairlines and field borders                                                  |
| `chart-1` … `chart-5`            | `#0EA5E9`, then quiet hues        | `#0284C7`, then quiet hues        | `chart-1` leads; 2–5 are desaturated sand, sage, clay and grey               |
| `plate` / `plate-foreground`     | `#F4F4F1` / `#121212`             | same                              | `PlateBadge` only; constants in `@theme` (Indian plates are white in either) |

- **Where `brand` appears (and nowhere else):** the active nav icon (`sidebar-primary`), the selected-vehicle check, the odometer key figure on the dashboard hero, `chart-1`, the focus ring, the logo and the plate's strip. Light uses `#0369A1` because `#0EA5E9` is only 2.6:1 on white.
- **`primary` is not a colour.** It's the off-white (dark) or ink (light) button fill, so `text-primary` links and icons read as foreground. Don't reach for `primary` to highlight something.
- **Contrast:** text tokens pass WCAG AA on `background`, `card` and `muted` in both themes; the skill's `color-system.md` has the full table and the pairs that fall short (`destructive` text on the dark card and on `muted`, small status-badge text).

**Status colours and where they apply:**

- Maintenance:
  - Good → `success`
  - Upcoming → `info`
  - Due → `warning`
  - Overdue → `destructive`
- Documents:
  - Expiring within 30 days → `warning`
  - Expired → `destructive`

Status and priority colour lives on badges (`bg-success/15 text-success`, `StatusBadge`) and icon tiles, plus the 2px left accent on insight tiles and flagged inspection findings. Cards and rows keep neutral hairline borders: no coloured card borders, no tinted row or banner fills. Always pair the colour with an icon or label.

## Themes

- Dark (default), light and system, chosen from the theme menu in the header and on the auth pages.
- `next-themes` saves the choice to localStorage (`automate.theme`) and sets the `dark`/`light` class on `<html>`.
- A small script in `index.html` applies the saved theme before first paint, so there's no flash.
- Use the `dark:` variant only when a token can't express the difference.

## Typography

Two self-hosted families (Fontsource). Inter and Manrope are gone; Stitch's font choices no longer apply.

| Family              | Class                                    | Use                                                                                             |
| ------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Geist Variable      | `font-sans` (default) and `font-heading` | Everything: interface copy, headings, wordmark, metric values                                   |
| Geist Mono Variable | `font-mono`                              | Figures that read as machine output: number plates, VINs, odometer readouts, keyboard shortcuts |

`font-heading` still exists (it maps to Geist too), so headings keep the class and a font swap stays a one-line change.

| Role                             | Classes                                                       |
| -------------------------------- | ------------------------------------------------------------- |
| Display title (auth, onboarding) | `font-heading text-3xl font-medium`                           |
| Page title (h1, once per page)   | `font-heading text-2xl font-medium` (`PageHeader`)            |
| Section title (h2)               | `font-heading text-base font-medium` (`SectionHeader`)        |
| Stat value                       | `font-heading text-2xl font-medium tabular-nums` (`StatCard`) |
| Body / UI text                   | `text-sm`                                                     |
| Secondary text                   | `text-sm text-muted-foreground`                               |
| Label / group label              | `text-xs text-muted-foreground` (sentence case)               |
| Captions, hints                  | `text-xs text-muted-foreground`                               |

- **Weights 400 and 500 only.** Hierarchy comes from size and `foreground` / `muted-foreground`; there is no `font-semibold` or `font-bold`.
- **No uppercase tracked labels or overlines.** Labels are sentence case `text-xs text-muted-foreground`. No `uppercase`, `tracking-tight` or `tracking-wide*`.
- Use `tabular-nums` wherever figures line up or update.

## Spacing and layout

- **Base unit:** Tailwind's 4px scale. Common gaps: `gap-2` (inline), `gap-3`/`gap-4` (stacks), `gap-6` (page sections).
- **Page frame:** `PageContainer`, with `max-w-7xl`, gutters `px-4` → `md:px-6` → `lg:px-8`, `py-6` and `gap-6`.
- **Header:** `h-14` on phones and `md:h-16` (Stitch's 64px), sticky, solid `bg-background` (no backdrop blur; the bottom nav is solid `bg-card` too). `html` has `scroll-padding-top: 5rem`, so anchors and focused fields land below it.
- **Sidebar:** shadcn `Sidebar`, `collapsible="icon"`, grouped as Overview / My vehicles / Management / Intelligence / Personal. Group labels are sentence case. The active item gets the raised fill (`sidebar-accent`) and its icon in `sidebar-primary` (brand cyan); the label stays foreground. On phones it's an off-canvas drawer opened from the bottom navigation's "More": `BottomNav` (`components/layout/bottom-nav.tsx`, below `md`) holds Home · Fuel · Add · Expenses · More, and "Add" opens `QuickAddSheet` (`components/layout/quick-add.tsx`; on desktop the same shortcuts are the header's "+" menu). The phone header (below `md`) shows the vehicle switcher (`HeaderVehicleSelector`, the same menu as the sidebar's) on a module's main page and a back link to the parent route with the page title on inner pages; the sidebar trigger and theme switch move out of it (the theme is in the account menu, the full nav behind "More"). App-wide search is the header's "Search" (Ctrl/⌘ K; an icon below `lg`), `SearchCommand` in `components/layout/search-command.tsx`, over `GET /search` (records grouped by kind, recent searches, quick actions and "Go to" when empty). The shell pads content `pb-20` on phones; forms render outside the shell, so the bar never covers their actions. Money on chart axes uses `formatCurrencyCompact` (₹45K, ₹1.2L, ₹1.1Cr), never in tables or details.
- **Auth pages:** a 5/7 split (a plain `bg-card` brand panel + form column) on `lg+`, form only on phones (`features/auth/components/auth-layout.tsx`).

## Radius and shadows

- **Radius:** `--radius: 0.5rem`. That gives:
  - `rounded-sm` 4px for nested tiles;
  - `rounded-lg` 8px for buttons, inputs and small controls;
  - `rounded-xl` 12px for cards, popovers and dialogs;
  - `rounded-2xl` 16px for the vehicle hero image only.
  - Badges are `rounded-md`, not pills; `rounded-full` is for avatars, dots and switches.
- **Depth** comes from surface steps (`background → card → elevated → popover`) and 1px borders. Only floating layers carry the primitives' built-in shadows.

## Brand

- **Logo:** `components/layout/brand-logo.tsx`. `BrandMark` is a flat, single-colour `brand` "A" (crossbar in `brand` too) on a `secondary` graphite tile; `BrandLogo` adds the Geist wordmark (`font-medium`). The favicon (`public/favicon.svg`) is the same mark, cyan `#0EA5E9` on `#232325`.
- **Signature: the plate.** `PlateBadge` sets the registration like an Indian number plate: a white plate (`bg-plate` / `text-plate-foreground`) in either theme, Geist Mono letters, `rounded-sm`, and a thin `bg-brand` strip on the left. Use it wherever a vehicle is named by its plate (sidebar switcher, vehicle switcher items, dashboard hero, vehicle card, vehicle page) and nowhere else.
- **No glow.** The `hero-glow` utility and the `--glow` token were removed; hero panels and the `VehicleImage` fallback are plain graphite surfaces.
- **Copy:** no greeting headline. The dashboard h1 is "Dashboard" with the date ("Saturday, 28 Nov 2026"), the login title is "Log in", and the global search placeholder is just "Search".

## Interaction states

- **Focus:** a visible `ring` outline on every interactive primitive. Custom clickable areas (e.g. a linked `StatCard`) must reproduce it.
- **Disabled:** `opacity-50` and no pointer events. Show the action disabled with a reason rather than hiding it.
- **Invalid:** inputs style themselves from `aria-invalid`, which `FormField` sets.
- **Hover:** subtle fills only (`hover:bg-accent`).
- **Motion:** named transitions (`transition-colors`, `transition`, `transition-transform`), never `transition-all`. `@theme` sets the default to 150ms `cubic-bezier(0.22, 1, 0.36, 1)`.
- **Overlays:** dialogs and sheets dim the page with a solid `bg-black/60`, no backdrop blur.

## Responsive

| Breakpoint | Width   | Notes                                                                     |
| ---------- | ------- | ------------------------------------------------------------------------- |
| (base)     | < 640px | Phones. Design here first (Stitch mobile screens are 390px)               |
| `sm`       | 640px   |                                                                           |
| `md`       | 768px   | Sidebar docks; header grows to 64px; `useIsMobile()` uses this breakpoint |
| `lg`       | 1024px  | Auth pages split into two panels                                          |
| `xl`       | 1280px  | Stitch desktop screens are 1280px                                         |

Touch targets are at least 40px on phones, and there's no horizontal page scroll.

## Component inventory

**Primitives** (`components/ui/`, shadcn): accordion, alert, alert-dialog, avatar, badge, breadcrumb, button, calendar, card, chart (Recharts), checkbox, dialog, dropdown-menu, empty, field, input, input-group, label, popover, radio-group, select, progress, separator, sheet, sidebar, skeleton, sonner, spinner, switch, table, tabs, textarea, toggle, toggle-group, tooltip.

**App building blocks** (`components/common/`):

| Component                 | Purpose                                                                                             |
| ------------------------- | --------------------------------------------------------------------------------------------------- |
| `PageContainer`           | Page width, gutters, vertical rhythm                                                                |
| `PageHeader`              | h1 + description + page actions                                                                     |
| `SectionHeader`           | h2 + description + section actions                                                                  |
| `Breadcrumbs`             | Built from route `handle.title`s                                                                    |
| `SearchInput`             | Search field with icon and clear button (controlled)                                                |
| `NumberInput`             | Number with Indian grouping and a unit (₹ prefix, km/L suffix); spread a `FormField` render onto it |
| `Pager`                   | "Page 2 of 5" with previous/next; under `DataTable` (client paging) and server-paged lists          |
| `StatCard`                | Label, value, hint and icon; optional link to its module; loading skeleton                          |
| `DataTable`               | TanStack Table v8: sortable headers, pagination, loading and empty rows                             |
| `ConfirmDialog`           | Confirm/cancel with async pending state and a destructive variant                                   |
| `FormField` / `FormError` | react-hook-form field wiring (`optional` adds "(optional)" to the label) / form-level error         |
| `DatePicker`              | Popover + Calendar with month/year dropdowns (1950 → +15 years), shows DD/MM/YYYY                   |
| `PlateBadge`              | The registration as a white Indian plate with a `brand` strip, in Geist Mono: `HR-26-EV-4821`       |
| `VehicleImage`            | Vehicle visual; until photos are supported, the graphite-panel fallback (`panel` or 40px `thumb`)   |
| `UnsavedChangesGuard`     | Asks before leaving a dirty form (in-app navigation and closing the tab)                            |
| `StatusBadge`             | A status as tone + icon + label (`destructive`, `warning`, `info`, `success`, `neutral`)            |
| `Segmented`               | One joined radio track (Expenses kind, Maintenance priority and "Repeats / Once")                   |

**Layout** (`components/layout/`): `AppShell`, `AppSidebar` (with `VehicleSelector`, the active-vehicle switcher), `AppHeader`, `ThemeToggle`, `UserMenu`, `BrandLogo`/`BrandMark`, and `TaskPage` (full-page flows outside the shell: a focused header with back button, used by the add and edit vehicle pages).

**Feedback** (`components/feedback/`): `EmptyState`, `ErrorState` (safe message plus retry), `LoadingState`, `LoadingSkeleton`, `RouteError`/`NotFoundState`, `AppErrorFallback`.

**Feature-level:**

- Auth: `AuthLayout`, `PasswordInput` (show/hide toggle).
- Maintenance: `MaintenanceLayout` (header + tabs as routes), `ScheduleStatusBadge`, `DueSummary` (deciding track first, thin progress for repeating schedules), `ScheduleActions`, `SpendChart`, `ScheduleForm`, `RecordForm`, `FormSection` (numbered task-page section), `HistoryFilters`, `ComponentForm`, the inspect / remove component dialogs, `InspectionForm` (checklist by area; condition select tinted by `INSPECTION_CONDITION_META` tone), `WorkshopDialog` (add / edit a workshop).
- Garage: `VehicleCard`, `DetailList` ("Not added · Add" for missing values), `DeleteVehicleDialog` (type the plate to confirm), and the vehicle form sections. Their choice fields come in four styles: `cards` (radio + description), `tiles` (icon over label), `segmented` (one joined track), and `select` (the edit page's compact mode).

## Accessibility checklist

- One `<h1>` per page.
- The sidebar is a `<nav aria-label="Main">`.
- The page `<title>` updates on navigation, including the auth pages.
- Icon-only buttons have an `aria-label`; the password toggle also sets `aria-pressed`.
- Loading states use `role="status"`; errors use `role="alert"`.
- Sortable table headers set `aria-sort`.
- Colour is never the only signal.
