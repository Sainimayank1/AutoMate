# Colour System

The palette is the **Night dash** theme (an instrument cluster at night): neutral graphite surfaces stepped by tone with no blue tint, off-white text, hairlines drawn from the foreground colour, a neutral `primary`, and one cyan accent (`brand`) used rarely. It replaced the Stitch "AutoMate Cockpit" palette in code; Stitch wasn't updated, so its ice blue and teal no longer apply. The dark theme is primary (and the default). The light theme is the daylight alternative with the same hierarchy.

## Token architecture

1. **Values** live in `apps/web/src/styles/index.css`, under `:root` (light) and `.dark`. That file is the source of truth; this page explains roles. The plate colours (`--color-plate`, `--color-plate-foreground`) are constants in `@theme`, the same in both themes.
2. **Exposure:** `@theme inline` maps each one to a Tailwind colour (`--color-card: var(--card)`).
3. **Use:** components only use the semantic classes (`bg-card`, `text-muted-foreground`, `border-border`, `ring-ring`, `fill-chart-1`).

**Forbidden in components and features:** hex/rgb/hsl/oklch literals, `[#…]` arbitrary colours, Tailwind palette classes (`zinc-*`, `slate-*`, `gray-*`, `cyan-*`, `teal-*`, `emerald-*`, `amber-*`, `red-*`…), `text-white`/`bg-black` (except the `bg-black/60` overlays already inside primitives) and inline `style={{ color }}`. The exception is a chart's `var(--chart-n)` reference.

Opacity modifiers on tokens are fine (`bg-success/15`, `border-plate-foreground/15`).

## Semantic tokens

| Token                            | Role                                                                                  | Dark                              | Light                             | Classes                                |
| -------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------- | --------------------------------- | -------------------------------------- |
| `background`                     | App canvas (level 0)                                                                  | `#141415`                         | `#FAFAFA`                         | `bg-background`                        |
| `sidebar`                        | Sidebar surface (darker than the page in dark)                                        | `#0F0F10`                         | `#F4F4F5`                         | `bg-sidebar`                           |
| `card`                           | Cards, panels, table containers (level 1)                                             | `#19191B`                         | `#FFFFFF`                         | `bg-card`                              |
| `elevated`                       | Raised areas inside cards: nested tiles, selected rows, hero inner panels (level 2)   | `#232325`                         | `#F4F4F5`                         | `bg-elevated`                          |
| `popover`                        | Menus, popovers, selects (level 3)                                                    | `#1C1C1F`                         | `#FFFFFF`                         | `bg-popover`                           |
| `muted` / `secondary` / `accent` | Quiet fills, secondary buttons, hover backgrounds                                     | `#202022` / `#232325` / `#232325` | `#F4F4F5` / `#F4F4F5` / `#EFEFF1` | `bg-muted`, `hover:bg-accent`          |
| `border` / `input`               | Hairlines, dividers / field borders (the foreground colour at low alpha)              | `#EDEDED` at 8% / 13%             | `#171717` at 9% / 18%             | `border`, `divide-y`                   |
| `foreground`                     | Primary text, key numbers                                                             | `#EDEDED`                         | `#171717`                         | `text-foreground`                      |
| `muted-foreground`               | Secondary text, labels, units, axes (placeholders use it at 60%)                      | `#A1A1A6`                         | `#5C5C63`                         | `text-muted-foreground`                |
| `primary`                        | **Neutral** main-button fill; as text it reads as foreground (links, selected states) | `#EDEDED`                         | `#171717`                         | `bg-primary`, `text-primary`           |
| `primary-foreground`             | Text on primary                                                                       | `#141415`                         | `#FAFAFA`                         | `text-primary-foreground`              |
| `brand`                          | **The one accent (cyan)**, used rarely: see "Where brand appears"                     | `#0EA5E9`                         | `#0369A1`                         | `text-brand`, `bg-brand`, `fill-brand` |
| `sidebar-primary`                | Active nav icon (= `brand`)                                                           | `#0EA5E9`                         | `#0369A1`                         | via the sidebar primitive              |
| `insight`                        | **Neutral grey:** insights (fixed rules over the user's records)                      | `#A1A1A6`                         | `#525252`                         | `text-insight`, `bg-insight/10`        |
| `success`                        | Good, valid, improved efficiency                                                      | `#4CC38A`                         | `#15803D`                         | `text-success`                         |
| `warning`                        | Due, expiring soon, needs inspection, odometer anomaly                                | `#E5A54B`                         | `#B45309`                         | `text-warning`                         |
| `destructive`                    | Overdue, expired, errors, delete                                                      | `#E5484D`                         | `#DC2626`                         | `text-destructive`                     |
| `info`                           | Upcoming, informational notices (a toned blue)                                        | `oklch(0.74 0.08 250)`            | `oklch(0.5 0.1 250)`              | `text-info`                            |
| `ring`                           | Focus ring (= `brand`)                                                                | `#0EA5E9`                         | `#0369A1`                         | `ring-ring`                            |
| `chart-1…5`                      | Data series (see Charts)                                                              | see CSS                           | see CSS                           | `fill-chart-1`, `var(--chart-1)`       |
| `plate` / `plate-foreground`     | The `PlateBadge` plate and letters only                                               | `#F4F4F1` / `#121212`             | same                              | `bg-plate`, `text-plate-foreground`    |

**Light brand:** `#0EA5E9` reaches only 2.6:1 on white, below the 3:1 a focus indicator needs, so the light theme's `brand`, `ring` and `sidebar-primary` use the darker `#0369A1` (5.7:1).

**Building from Stitch HTML:** Stitch still carries the old palette, so translate by role, not by value: `dark-surface-container-low` → `bg-card`, `dark-on-surface-variant` → `text-muted-foreground`, `dark-outline-variant` → `border`, `dark-tertiary` → `text-warning`, `dark-secondary` (teal) → `text-insight` (now grey). Stitch's ice-blue `primary` on text, icons, labels and borders becomes `foreground` or `muted-foreground`; on the main button it stays `bg-primary` (now neutral). Only the uses listed under "Where brand appears" become `brand`.

**Shadcn naming traps:** `accent` is a _hover fill_, not the brand accent, and `primary` is neutral. The one accent is `brand`. Never use `bg-accent` or `primary` to mean "highlighted".

## Usage rules

**Surfaces.** Build depth by stepping `background → card → elevated → popover`. Never put a card on a card with the same token: a nested panel uses `bg-elevated` or just a `border` divider. In dark mode, depth comes from surface steps and hairlines, not shadows.

**Text.** There are three levels only: `foreground` for content and values, `muted-foreground` for labels, units, meta and axes, and `muted-foreground/70` for de-emphasised meta (timestamps in dense lists). `text-primary` renders as foreground, so links rely on weight or underline, not colour.

**Where brand appears** (the complete list; well under 5% of a screen):

- the active nav item's icon (`sidebar-primary`);
- the check on the selected vehicle in the vehicle switcher;
- the odometer key figure on the dashboard hero;
- `chart-1`, the lead chart series;
- the focus ring;
- the logo;
- the plate's left strip in `PlateBadge`.

Never use cyan for buttons, headings, links, labels, card borders, icon tiles or status. `primary` (neutral) may fill **one** button per view region (the main action); it also marks selected segmented/tab states and progress fills.

**Insight (neutral grey)** is reserved for insights: the lightbulb tile of the rule-based insight cards and their labels. There are no AI features (the AI assistant module was dropped), so never use Sparkles or "AI" labels.

**Status colours** are always paired with an icon and a text label, never colour alone. They live on badges, icon tiles, a progress fill and the 2px left accent of an insight tile or flagged inspection finding. Cards and rows keep neutral hairline borders: no coloured card borders, no tinted row, banner or card fills.

### Status recipes

Badge (create once as `StatusBadge`):

```tsx
<Badge variant="outline" className="border-transparent bg-warning/15 text-warning">
  <TriangleAlert data-icon="inline-start" /> Due
</Badge>
```

Inline accent, only on an insight tile or a flagged inspection finding: `border-l-2 border-l-warning`. Not on cards, list rows or banners.
Progress fill: `[&>[data-slot=progress-indicator]]:bg-warning` (shadcn `Progress` exposes no indicator prop).

### Status mappings (use exactly these)

| Domain                | Value → token · Lucide icon                                                                                                                                                                                                                                                        |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Maintenance           | Good → `success` · `CircleCheck`; Upcoming → `info` · `Clock`; Due → `warning` · `CalendarClock`; Overdue → `destructive` · `CircleAlert`; Needs inspection → `warning` · `ScanSearch`; Replaced → neutral `secondary` · `PackageCheck`; Monitoring → neutral outline · `Activity` |
| Documents             | Valid → `success` · `ShieldCheck`; Expiring ≤ 30 days → `warning` · `Hourglass`; Expired → `destructive` · `CircleAlert`; No expiry → neutral · `FileCheck2`                                                                                                                       |
| Notification priority | High → `destructive` icon tile; Medium → `warning` icon tile; Low → muted tile; insight → `insight` · `Lightbulb`                                                                                                                                                                  |
| Mileage reliability   | Reliable → normal text; Partial sequence / insufficient data → `muted-foreground` · `CircleDashed` with an explanation (never warning red)                                                                                                                                         |
| Odometer              | Reading lower than the previous one → `warning` · `TriangleAlert` "Odometer went backwards"                                                                                                                                                                                        |
| Import validation     | Valid row → `success`; Warning (duplicate suspected) → `warning`; Error (will be skipped) → `destructive`                                                                                                                                                                          |

### Trends and deltas

Colour encodes **meaning, not direction**:

- Mileage ↑ is `success`; mileage ↓ by more than 10% is `warning`.
- Cost ↑ is `warning`; cost ↓ is `success`.
- Neutral metrics (distance, trip count) use `muted-foreground` with a `TrendingUp`/`TrendingDown` icon.

Never use `destructive` for a normal cost increase.

## Charts

| Series    | Dark                        | Light                  | Use                                                      |
| --------- | --------------------------- | ---------------------- | -------------------------------------------------------- |
| `chart-1` | cyan `#0EA5E9` (= brand)    | `#0284C7`              | Lead series: this vehicle, current period, Fuel category |
| `chart-2` | sand `oklch(0.78 0.06 85)`  | `oklch(0.62 0.07 80)`  | Second series; Maintenance & repairs                     |
| `chart-3` | sage `oklch(0.7 0.06 160)`  | `oklch(0.55 0.07 160)` | Insurance                                                |
| `chart-4` | clay `oklch(0.68 0.07 25)`  | `oklch(0.55 0.09 25)`  | Loan interest / EMI                                      |
| `chart-5` | grey `oklch(0.55 0.01 260)` | `oklch(0.62 0.01 260)` | Other / everything else                                  |

`chart-1` leads; 2–5 are quiet, desaturated hues so the lead series is the only bright one. Sage is a data colour here, not a status: it never means "good".

- **Fixed category mapping.** An expense category has the same colour in every chart, legend and chip across the app. Define it once (a `EXPENSE_CATEGORY_META` map with label, Lucide icon and chart token) when the Expenses module is built, and import it everywhere.
- **Group extra categories.** There are at most 5 coloured series. When there are more categories, show the top 4 and group the rest as **Other** (`chart-5`). The full breakdown goes in the table or legend list.
- **Comparison periods** ("last month") use `muted-foreground` at 40%, dashed. They are never a second bright colour.
- **Area fills** use the series colour as a vertical fade from 24% to 0% opacity. This is the only gradient in the app.
- **Gridlines** are horizontal only: `stroke: var(--border)`, dashed `3 3`. Axis text is `muted-foreground` at 12px. There are no axis lines.
- Status colours appear in charts only when they mean status (for example, overdue bars in the maintenance cost timeline).

## Implementation

The values live only in `apps/web/src/styles/index.css` (`:root` for light, `.dark` for dark), with `@theme inline` exposing them as Tailwind colours (the plate constants and the default transition sit there too). There is no `hero-glow` utility or `--glow` token any more. Don't copy the block into docs; change the CSS and update the tables here.

## Verified contrast (WCAG 2.x)

Computed from the values in `index.css`. Re-verify if you change any value.

| Pair                          | Dark: on bg / card / muted | Light: on bg / card / muted |
| ----------------------------- | -------------------------- | --------------------------- |
| foreground                    | 15.7 / 15.0 / 13.9         | 17.2 / 17.9 / 16.3          |
| muted-foreground              | 7.2 / 6.8 / 6.3            | 6.4 / 6.6 / 6.0             |
| brand (as text)               | 6.6 / 6.3 / 5.9            | 5.7 / 5.9 / 5.4             |
| insight                       | 7.2 / 6.8 / 6.3            | 7.5 / 7.8 / 7.1             |
| success                       | 8.3 / 7.9 / 7.3            | 6.8 / 7.1 / 6.5             |
| warning                       | 8.6 / 8.2 / 7.6            | 6.8 / 7.1 / 6.5             |
| destructive                   | 6.2 / 5.9 / 5.4            | 6.2 / 6.5 / 5.9             |
| info                          | 8.0 / 7.7 / 7.1            | 5.7 / 6.0 / 5.4             |
| primary-foreground on primary | 15.7                       | 17.2                        |
| ring on background            | 6.6                        | 5.7                         |
| plate-foreground on plate     | 17.0                       | 17.0                        |

Every text pair above passes AA (4.5:1), and so do the status badges (`bg-<status>/15 text-<status>` on a card, 4.5 or more in both themes). One known gap remains, to fix in the values rather than work around:

- `input` (13% / 18%) is about 1.4:1 against the card, below the 3:1 for a field boundary; the placeholder, label and focus ring carry the field.
