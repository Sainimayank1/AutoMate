# Design system (`apps/web`)

AutoMate should feel like a premium automotive SaaS product: minimal, calm and precise. It's built on **shadcn/ui (Radix base, Nova preset)** and **Tailwind CSS v4**. All tokens are CSS variables in `apps/web/src/styles/index.css`.

## Rules

- **Never hardcode colours.** Use semantic tokens (`bg-background`, `text-muted-foreground`, `border`, `bg-primary`…). Light and dark mode then come for free.
- **Don't rebuild primitives.** Buttons, dialogs, menus, popovers, tooltips, tabs and so on come from `components/ui/`. If a primitive is missing, add it with `pnpm dlx shadcn@latest add <name>` (run in `apps/web`).
- **Extend, don't fork.** Pass `className` or variants to a primitive. Edit a file in `components/ui/` only for an app-wide change, and note why in the file.
- **Restraint.** No decorative gradients, no gratuitous animation, no oversized cards. Separate areas with whitespace and thin borders rather than heavy shadows.

## Colour tokens

Base palette: shadcn **neutral**, using OKLCH values.

| Token                                          | Use                                                                                                        |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `background` / `foreground`                    | Page surface and body text                                                                                 |
| `card`, `popover` (+ `-foreground`)            | Raised surfaces                                                                                            |
| `primary` (+ `-foreground`)                    | Main actions; near-black in light mode, near-white in dark                                                 |
| `secondary`, `muted`, `accent`                 | Quiet surfaces, hovers, subdued text (`muted-foreground`)                                                  |
| `destructive`                                  | Delete actions and errors                                                                                  |
| `success`, `warning`, `info` (+ `-foreground`) | Status colours, added for AutoMate (see below)                                                             |
| `border`, `input`, `ring`                      | Lines, field borders, focus ring                                                                           |
| `sidebar-*`                                    | Sidebar surfaces                                                                                           |
| `chart-1…5`                                    | Chart series. Still the neutral defaults: define a real palette with the first chart (Dashboard/Analytics) |

**Status colours and where they apply:**

- Maintenance:
  - Good → `success`
  - Upcoming → `info`
  - Due → `warning`
  - Overdue → `destructive`
- Documents:
  - Expiring within 30 days → `warning`
  - Expired → `destructive`

Use them as text, small badges or a 2px accent, not as large fills. For example: `<Badge className="bg-success/15 text-success">Good</Badge>`.

## Themes

- Light, dark and system modes, chosen from the header theme menu.
- `next-themes` saves the choice to localStorage (`automate.theme`) and sets the `light`/`dark` class on `<html>`.
- A small script in `index.html` applies the saved theme before first paint, so there's no flash.
- Dark-mode styles use the `dark:` variant, which is tied to the `.dark` class.

## Typography

- **Font:** Geist Variable, self-hosted via `@fontsource-variable/geist` so there are no third-party font requests. `font-heading` currently uses the same family.
- **Numbers:** use `tabular-nums` wherever figures line up or update (stat cards, tables, odometer).

| Role                           | Classes                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------ |
| Page title (h1, once per page) | `font-heading text-2xl font-semibold tracking-tight` (`PageHeader`)            |
| Section title (h2)             | `font-heading text-base font-semibold` (`SectionHeader`)                       |
| Stat value                     | `font-heading text-2xl font-semibold tracking-tight tabular-nums` (`StatCard`) |
| Body / UI text                 | `text-sm`                                                                      |
| Secondary text                 | `text-sm text-muted-foreground`                                                |
| Captions, hints                | `text-xs text-muted-foreground`                                                |

## Spacing and layout

- **Base unit:** Tailwind's 4px scale. Common gaps: `gap-2` (8px, inline controls), `gap-3`/`gap-4` (stacks), `gap-6` (page sections).
- **Page frame:** every page renders inside `PageContainer`:
  - maximum width `max-w-7xl`;
  - gutters `px-4` on phones, `md:px-6` on tablets, `lg:px-8` on desktop;
  - `py-6` vertical padding and `gap-6` between sections.
- **Header:** 56px (`h-14`), sticky, translucent `bg-background/80` with blur.
- **Sidebar:** shadcn `Sidebar` with `collapsible="icon"`. On phones it becomes an off-canvas drawer.

## Radius and shadows

- `--radius: 0.625rem` (10px). The scale derives from it: `rounded-sm` 6px, `rounded-md` 8px, `rounded-lg` 10px, `rounded-xl` 14px.
  - Cards use `rounded-xl`.
  - Inputs and buttons use `rounded-lg`/`rounded-md`, as the primitives define.
- **Shadows:** keep them minimal. Cards have no shadow, only a 1px hairline (`ring-1 ring-foreground/10`). Only floating layers (popovers, menus, dialogs, toasts) get real shadows, which the primitives already include.

## Interaction states

- **Focus:** every interactive primitive shows a visible `ring` focus outline (`focus-visible:ring-*`). Don't remove outlines. Custom clickable areas (e.g. a linked `StatCard`) must reproduce the ring.
- **Disabled:** primitives use `disabled:opacity-50 disabled:pointer-events-none`. Don't hide disabled actions that explain why something can't be done; show them disabled.
- **Invalid:** inputs show error styling from `aria-invalid`, which `FormField` sets for you.
- **Hover:** subtle background shifts only (`hover:bg-muted`/`accent`).

## Responsive

| Breakpoint | Width   | Notes                                                                            |
| ---------- | ------- | -------------------------------------------------------------------------------- |
| (base)     | < 640px | Phones. Design here first                                                        |
| `sm`       | 640px   |                                                                                  |
| `md`       | 768px   | Sidebar switches from drawer to docked; `useIsMobile()` uses the same breakpoint |
| `lg`       | 1024px  |                                                                                  |
| `xl`       | 1280px  |                                                                                  |

- **Touch targets:** at least 40px on phones. Header icon buttons and sidebar items use `size-10 md:size-8` / `h-10 md:h-8`.
- **No horizontal page scroll:** wide content (tables) scrolls inside its own container.

## Component inventory

**Primitives** (`components/ui/`, shadcn): accordion, alert, alert-dialog, avatar, badge, breadcrumb, button, calendar, card, checkbox, dialog, dropdown-menu, empty, field, input, input-group, label, popover, radio-group, select, separator, sheet, sidebar, skeleton, sonner, spinner, switch, table, tabs, textarea, tooltip.

**App building blocks** (`components/common/`):

| Component                 | Purpose                                                                    |
| ------------------------- | -------------------------------------------------------------------------- |
| `PageContainer`           | Page width, gutters, vertical rhythm                                       |
| `PageHeader`              | h1 + description + page actions                                            |
| `SectionHeader`           | h2 + description + section actions                                         |
| `Breadcrumbs`             | Built from route `handle.title`s                                           |
| `SearchInput`             | Search field with icon and clear button (controlled)                       |
| `StatCard`                | Label, value, hint and icon; optional link to its module; loading skeleton |
| `DataTable`               | TanStack Table v8: sortable headers, pagination, loading and empty rows    |
| `ConfirmDialog`           | Confirm/cancel with async pending state and a destructive variant          |
| `FormField` / `FormError` | react-hook-form field wiring / form-level error                            |
| `DatePicker`              | Popover + Calendar, shows DD/MM/YYYY                                       |

**Feedback** (`components/feedback/`): `EmptyState`, `ErrorState` (safe message plus retry), `LoadingState` (spinner, `role=status`), `LoadingSkeleton`, `RouteError`/`NotFoundState`, `AppErrorFallback`.

## Accessibility checklist

- One `<h1>` per page (`PageHeader`).
- The sidebar is a `<nav aria-label="Main">`.
- The page `<title>` updates on navigation.
- Icon-only buttons have an `aria-label`.
- Loading states use `role="status"`; errors use `role="alert"` (field errors, `FormError`).
- Sortable table headers set `aria-sort`.
- Colour is never the only signal: status badges also carry text.
