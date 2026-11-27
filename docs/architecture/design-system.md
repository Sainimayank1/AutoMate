# Design system (`apps/web`)

What the code implements today. The design source is the Stitch project **"AutoMate Design System Platform"** (design system "AutoMate Cockpit"). The rules for designing new screens, including generating a missing screen in Stitch first, are in the `automate-design` skill (`.claude/skills/automate-design/`).

AutoMate looks like a car's digital cockpit crossed with a fintech app: deep graphite surfaces, one ice-blue accent, hairline borders and tabular numbers. It's built on **shadcn/ui (Radix base, Nova preset)** and **Tailwind CSS v4**. All tokens are CSS variables in `apps/web/src/styles/index.css`, holding the Stitch hex values.

## Rules

- **Build from Stitch.** Every screen starts from its Stitch design (desktop and mobile). If the screen doesn't exist, generate it in Stitch first. The `automate-design` skill has the workflow.
- **Never hardcode colours.** Use semantic tokens (`bg-card`, `text-muted-foreground`, `border`, `bg-primary`…). Light and dark mode then come for free.
- **Don't rebuild primitives.** Buttons, dialogs, menus, popovers, tooltips, tabs and so on come from `components/ui/`. If a primitive is missing, add it with `pnpm dlx shadcn@latest add <name>` (run in `apps/web`).
- **Extend, don't fork.** Pass `className` or variants to a primitive. Edit a file in `components/ui/` only for an app-wide change, and note why in the file. Current edits:
  - `input.tsx` and `textarea.tsx` render placeholders at 60%, so they never read as typed values.
  - `field.tsx` targets `has-data-[state=checked]` for choice cards, because Radix radios mark selection with `data-state`, not `data-checked`.
  - `hooks/use-mobile.ts` was rewritten with `useSyncExternalStore`.
- **Restraint.** No decorative gradients (except `hero-glow`), no gratuitous animation, no oversized cards. Separate areas with tonal surface steps and 1px borders rather than heavy shadows.

## Colour tokens

Dark is the default theme. Each value's Stitch role is commented in `index.css`.

| Token                            | Dark                   | Light                  | Use                                             |
| -------------------------------- | ---------------------- | ---------------------- | ----------------------------------------------- |
| `background`                     | `#101419`              | `#F8F9FF`              | Page canvas                                     |
| `card` / `sidebar`               | `#181C22`              | `#F1F3FC`              | Cards, panels, sidebar                          |
| `elevated`                       | `#1C2026`              | `#EBEEF6`              | Raised areas inside a card                      |
| `popover`                        | `#262A30`              | `#E5E8F1`              | Menus, popovers, selects                        |
| `muted` / `secondary` / `accent` | `#1C2026` / `#262A30`  | `#EBEEF6` / `#E5E8F1`  | Quiet fills, secondary buttons, hover           |
| `foreground`                     | `#DFE2EB`              | `#181C22`              | Primary text                                    |
| `muted-foreground`               | `#BEC8D2`              | `#3E4850`              | Secondary text, labels (placeholders at 60%)    |
| `primary`                        | `#89CEFF`              | `#006591`              | Ice-blue accent: main action, active nav, links |
| `brand`                          | `#0EA5E9`              | `#0EA5E9`              | Logo chevron                                    |
| `insight`                        | `#4FDBC8`              | `#006B5F`              | Teal, for AI and insights only                  |
| `success`                        | `#5EE2A6`              | `#0F6D45`              | Good, valid                                     |
| `warning`                        | `#FFB86E`              | `#8A5100`              | Due, expiring soon                              |
| `destructive`                    | `#FFB4AB`              | `#BA1A1A`              | Overdue, expired, errors, delete                |
| `info`                           | `oklch(0.75 0.11 245)` | `oklch(0.53 0.13 245)` | Upcoming, notices (not in Stitch)               |
| `border` / `input`               | `#2D343C`              | `#BEC8D2`              | Hairlines and field borders                     |
| `ring`                           | `#0EA5E9`              | `#006591`              | Focus ring                                      |

- **Light focus ring:** Stitch's cyan reaches only 2.6:1 on light surfaces, below the 3:1 a focus indicator needs, so the light theme uses `primary` instead.
- **Contrast:** every text token passes WCAG AA on `background`, `card` and `muted` in both themes. The skill's `color-system.md` has the full table.

**Status colours and where they apply:**

- Maintenance:
  - Good → `success`
  - Upcoming → `info`
  - Due → `warning`
  - Overdue → `destructive`
- Documents:
  - Expiring within 30 days → `warning`
  - Expired → `destructive`

Show them as text, small badges (`bg-success/15 text-success`) or a 2px accent, never as large fills, and always with an icon or label.

## Themes

- Dark (default), light and system, chosen from the theme menu in the header and on the auth pages.
- `next-themes` saves the choice to localStorage (`automate.theme`) and sets the `dark`/`light` class on `<html>`.
- A small script in `index.html` applies the saved theme before first paint, so there's no flash.
- Use the `dark:` variant only when a token can't express the difference.

## Typography

Three self-hosted families (Fontsource), as in Stitch:

| Family              | Class                 | Use                                    |
| ------------------- | --------------------- | -------------------------------------- |
| Manrope Variable    | `font-heading`        | Headings, wordmark, metric values      |
| Inter Variable      | `font-sans` (default) | All interface copy                     |
| Geist Mono Variable | `font-mono`           | Number plates, VINs, odometer readouts |

| Role                             | Classes                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------ |
| Display title (auth, onboarding) | `font-heading text-3xl font-semibold tracking-tight`                           |
| Page title (h1, once per page)   | `font-heading text-2xl font-semibold tracking-tight` (`PageHeader`)            |
| Section title (h2)               | `font-heading text-base font-semibold` (`SectionHeader`)                       |
| Stat value                       | `font-heading text-2xl font-semibold tracking-tight tabular-nums` (`StatCard`) |
| Body / UI text                   | `text-sm`                                                                      |
| Secondary text                   | `text-sm text-muted-foreground`                                                |
| Overline / group label           | `text-xs font-semibold uppercase tracking-wider`                               |
| Captions, hints                  | `text-xs text-muted-foreground`                                                |

Use `tabular-nums` wherever figures line up or update.

## Spacing and layout

- **Base unit:** Tailwind's 4px scale. Common gaps: `gap-2` (inline), `gap-3`/`gap-4` (stacks), `gap-6` (page sections).
- **Page frame:** `PageContainer`, with `max-w-7xl`, gutters `px-4` → `md:px-6` → `lg:px-8`, `py-6` and `gap-6`.
- **Header:** `h-14` on phones and `md:h-16` (Stitch's 64px), sticky, translucent. `html` has `scroll-padding-top: 5rem`, so anchors and focused fields land below it.
- **Sidebar:** shadcn `Sidebar`, `collapsible="icon"`, grouped as Overview / My vehicles / Management / Intelligence / Personal. The active item gets the raised fill and `primary` text. On phones it's an off-canvas drawer; a bottom navigation bar is planned (see the skill's backlog).
- **Auth pages:** a 5/7 split (brand panel with `hero-glow` + form column) on `lg+`, form only on phones (`features/auth/components/auth-layout.tsx`).

## Radius and shadows

- **Radius:** `--radius: 0.5rem`. That gives:
  - `rounded-sm` 4px for nested tiles;
  - `rounded-lg` 8px for buttons, inputs and small controls;
  - `rounded-xl` 12px for cards, popovers and dialogs;
  - `rounded-2xl` 16px for the vehicle hero image only.
- **Depth** comes from surface steps (`background → card → elevated → popover`) and 1px borders. Only floating layers carry the primitives' built-in shadows.

## Brand

- **Logo:** `components/layout/brand-logo.tsx`, from the Stitch screens. `BrandMark` is a cyan chevron "A" with a teal crossbar on a graphite tile; `BrandLogo` adds the Manrope wordmark. The favicon (`public/favicon.svg`) is the same mark.
- **`hero-glow`:** the one ambient gradient (a cyan radial glow), allowed on hero panels such as the auth brand panel.

## Interaction states

- **Focus:** a visible `ring` outline on every interactive primitive. Custom clickable areas (e.g. a linked `StatCard`) must reproduce it.
- **Disabled:** `opacity-50` and no pointer events. Show the action disabled with a reason rather than hiding it.
- **Invalid:** inputs style themselves from `aria-invalid`, which `FormField` sets.
- **Hover:** subtle fills only (`hover:bg-accent`).

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

**Primitives** (`components/ui/`, shadcn): accordion, alert, alert-dialog, avatar, badge, breadcrumb, button, calendar, card, chart (Recharts), checkbox, dialog, dropdown-menu, empty, field, input, input-group, label, popover, radio-group, select, progress, separator, sheet, sidebar, skeleton, sonner, spinner, switch, table, tabs, textarea, tooltip.

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
| `PlateBadge`              | Registration chip in Geist Mono: `HR-26-EV-4821`                                                    |
| `VehicleImage`            | Vehicle visual; until photos are supported, the glow-panel fallback (`panel` or 40px `thumb`)       |
| `UnsavedChangesGuard`     | Asks before leaving a dirty form (in-app navigation and closing the tab)                            |

**Layout** (`components/layout/`): `AppShell`, `AppSidebar` (with `VehicleSelector`, the active-vehicle switcher), `AppHeader`, `ThemeToggle`, `UserMenu`, `BrandLogo`/`BrandMark`, and `TaskPage` (full-page flows outside the shell: a focused header with back button, used by the add and edit vehicle pages).

**Feedback** (`components/feedback/`): `EmptyState`, `ErrorState` (safe message plus retry), `LoadingState`, `LoadingSkeleton`, `RouteError`/`NotFoundState`, `AppErrorFallback`.

**Feature-level:**

- Auth: `AuthLayout`, `PasswordInput` (show/hide toggle).
- Garage: `VehicleCard`, `DetailList` ("Not added · Add" for missing values), `DeleteVehicleDialog` (type the plate to confirm), and the vehicle form sections. Their choice fields come in four styles: `cards` (radio + description), `tiles` (icon over label), `segmented` (one joined track), and `select` (the edit page's compact mode).

## Accessibility checklist

- One `<h1>` per page.
- The sidebar is a `<nav aria-label="Main">`.
- The page `<title>` updates on navigation, including the auth pages.
- Icon-only buttons have an `aria-label`; the password toggle also sets `aria-pressed`.
- Loading states use `role="status"`; errors use `role="alert"`.
- Sortable table headers set `aria-sort`.
- Colour is never the only signal.
