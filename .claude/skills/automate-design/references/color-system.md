# Colour System

The palette comes from the Stitch design system **"AutoMate Cockpit"**: deep graphite surfaces stepped by tone, one ice-blue accent, and a teal kept for intelligence features. The dark theme is primary (and the default). The light theme is the daylight alternative with the same hierarchy.

## Token architecture

1. **Values** live in `apps/web/src/styles/index.css`, under `:root` (light) and `.dark`, as the Stitch hex tokens. That file is the source of truth; this page explains roles.
2. **Exposure:** `@theme inline` maps each one to a Tailwind colour (`--color-card: var(--card)`).
3. **Use:** components only use the semantic classes (`bg-card`, `text-muted-foreground`, `border-border`, `ring-ring`, `fill-chart-1`).

**Forbidden in components and features:** hex/rgb/hsl/oklch literals, `[#…]` arbitrary colours, Tailwind palette classes (`zinc-*`, `slate-*`, `gray-*`, `cyan-*`, `teal-*`, `emerald-*`, `amber-*`, `red-*`…), `text-white`/`bg-black` (except `bg-black/50` overlays already inside primitives) and inline `style={{ color }}`. The exception is a chart's `var(--chart-n)` reference.

Opacity modifiers on tokens are fine (`bg-primary/10`, `border-border/60`).

## Semantic tokens

| Token                            | Role                                                                                           | Dark                              | Light                             | Classes                          |
| -------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------- | --------------------------------- | -------------------------------- |
| `background`                     | App canvas (level 0)                                                                           | `#101419`                         | `#F8F9FF`                         | `bg-background`                  |
| `sidebar`                        | Sidebar surface                                                                                | `#181C22`                         | `#F1F3FC`                         | `bg-sidebar`                     |
| `card`                           | Cards, panels, table containers (level 1)                                                      | `#181C22`                         | `#F1F3FC`                         | `bg-card`                        |
| `elevated`                       | Raised areas inside cards: nested tiles, selected rows, hero inner panels (level 2)            | `#1C2026`                         | `#EBEEF6`                         | `bg-elevated`                    |
| `popover`                        | Menus, popovers, selects (level 3)                                                             | `#262A30`                         | `#E5E8F1`                         | `bg-popover`                     |
| `muted` / `secondary` / `accent` | Quiet fills, secondary buttons, hover backgrounds                                              | `#1C2026` / `#262A30` / `#262A30` | `#EBEEF6` / `#E5E8F1` / `#E5E8F1` | `bg-muted`, `hover:bg-accent`    |
| `border` / `input`               | Hairlines, dividers, field borders                                                             | `#2D343C`                         | `#BEC8D2`                         | `border`, `divide-y`             |
| `foreground`                     | Primary text, key numbers                                                                      | `#DFE2EB`                         | `#181C22`                         | `text-foreground`                |
| `muted-foreground`               | Secondary text, labels, units, axes (placeholders use it at 60%)                               | `#BEC8D2`                         | `#3E4850`                         | `text-muted-foreground`          |
| `primary`                        | **Brand accent (ice blue):** primary buttons, active nav, selection, focus chart series, links | `#89CEFF`                         | `#006591`                         | `bg-primary`, `text-primary`     |
| `primary-foreground`             | Text on primary                                                                                | `#00344D`                         | `#FFFFFF`                         | `text-primary-foreground`        |
| `brand`                          | Brand cyan: the logo chevron only                                                              | `#0EA5E9`                         | `#0EA5E9`                         | `fill-brand`                     |
| `insight`                        | **Teal:** AI-generated content, insights, AI Assistant UI                                      | `#4FDBC8`                         | `#006B5F`                         | `text-insight`, `bg-insight/10`  |
| `success`                        | Good, valid, improved efficiency                                                               | `#5EE2A6`                         | `#0F6D45`                         | `text-success`                   |
| `warning`                        | Due, expiring soon, needs inspection, odometer anomaly (Stitch "tertiary")                     | `#FFB86E`                         | `#8A5100`                         | `text-warning`                   |
| `destructive`                    | Overdue, expired, errors, delete                                                               | `#FFB4AB`                         | `#BA1A1A`                         | `text-destructive`               |
| `info`                           | Upcoming, informational notices (not in Stitch)                                                | `oklch(0.75 0.11 245)`            | `oklch(0.53 0.13 245)`            | `text-info`                      |
| `ring`                           | Focus ring                                                                                     | `#0EA5E9`                         | `#006591` (see below)             | `ring-ring`                      |
| `glow`                           | Ambient light for `hero-glow` only                                                             | cyan at 14%                       | cyan at 8%                        | via utility                      |
| `chart-1…5`                      | Data series (see Charts)                                                                       | see CSS                           | see CSS                           | `fill-chart-1`, `var(--chart-1)` |

**Light focus ring:** Stitch uses brand cyan for focus in both themes, but on light surfaces it reaches only 2.6:1, below the 3:1 a focus indicator needs. The light theme uses `primary` (`#006591`, 6.1:1) instead.

Stitch names (`surface-container-low`, `on-surface-variant`, `tertiary`…) map to these tokens as shown; the comment next to each value in `index.css` names its Stitch role. When building from Stitch HTML, translate `dark-surface-container-low` → `bg-card`, `dark-on-surface-variant` → `text-muted-foreground`, `dark-outline-variant` → `border`, `dark-tertiary` → `text-warning`, `dark-secondary` → `text-insight`, and so on.

**Shadcn naming trap:** `accent` is a _hover fill_, not the brand accent. The brand accent is `primary`. Never use `bg-accent` to mean "highlighted".

## Usage rules

**Surfaces.** Build depth by stepping `background → card → elevated → popover`. Never put a card on a card with the same token: a nested panel uses `bg-elevated` or just a `border` divider. In dark mode, depth comes from surface steps and hairlines, not shadows.

**Text.** There are three levels only: `foreground` for content and values, `muted-foreground` for labels, units, meta and axes, and `muted-foreground/70` for de-emphasised meta (timestamps in dense lists). Don't use primary for body text. Primary text is for links and interactive values only.

**Accent budget** (Stitch: about 5–10% of a screen).

- `primary` may fill **one** button per view region (the main action).
- Other places it appears: the active nav item icon, selected segmented/tab state, focus rings, progress fills, the focus chart series, links.
- Never use cyan for headings, borders around every card, icon backgrounds on every card, or as a status colour.

**Insight (teal)** is reserved for AI and insights. Use it for the AI Assistant accents, "AI insight" labels and badges, AI-generated cards (`border-insight/30 bg-insight/5`) and insight notifications. Using it anywhere else breaks the "recorded data vs AI advice" distinction.

**Status colours** are always paired with an icon and a text label, never colour alone. Use them as text, a small badge, a 2px left accent or a progress fill, never as large background fills.

### Status recipes

Badge (create once as `StatusBadge`):

```tsx
<Badge variant="outline" className="border-transparent bg-warning/15 text-warning">
  <TriangleAlert data-icon="inline-start" /> Due
</Badge>
```

Inline accent for a list row or card: `border-l-2 border-l-warning pl-3`.
Progress fill: `[&>[data-slot=progress-indicator]]:bg-warning` (shadcn `Progress` exposes no indicator prop).

### Status mappings (use exactly these)

| Domain                | Value → token · Lucide icon                                                                                                                                                                                                                                                        |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Maintenance           | Good → `success` · `CircleCheck`; Upcoming → `info` · `Clock`; Due → `warning` · `CalendarClock`; Overdue → `destructive` · `CircleAlert`; Needs inspection → `warning` · `ScanSearch`; Replaced → neutral `secondary` · `PackageCheck`; Monitoring → neutral outline · `Activity` |
| Documents             | Valid → `success` · `ShieldCheck`; Expiring ≤ 30 days → `warning` · `Hourglass`; Expired → `destructive` · `CircleAlert`; No expiry → neutral · `FileCheck2`                                                                                                                       |
| Notification priority | High → `destructive` dot; Medium → `warning` dot; Low → `muted-foreground` dot; AI insight → `insight` · `Sparkles`                                                                                                                                                                |
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

| Series    | Dark                           | Light                  | Use                                                       |
| --------- | ------------------------------ | ---------------------- | --------------------------------------------------------- |
| `chart-1` | ice blue `#89CEFF` (= primary) | `#006591`              | Focus series: this vehicle, current period, Fuel category |
| `chart-2` | indigo `oklch(0.70 0.13 275)`  | `oklch(0.52 0.15 275)` | Second series; Maintenance & repairs                      |
| `chart-3` | teal `#4FDBC8`                 | `#006B5F`              | Insurance                                                 |
| `chart-4` | orchid `oklch(0.72 0.13 330)`  | `oklch(0.58 0.15 340)` | Loan interest / EMI                                       |
| `chart-5` | outline grey `#88929B`         | `#6E7881`              | Other / everything else                                   |

Stitch defines no chart palette; series 1, 3 and 5 reuse Stitch tones, 2 and 4 fill the gaps. Teal here is a data colour, not the AI accent: in charts it only ever means "Insurance".

- **Fixed category mapping.** An expense category has the same colour in every chart, legend and chip across the app. Define it once (a `EXPENSE_CATEGORY_META` map with label, Lucide icon and chart token) when the Expenses module is built, and import it everywhere.
- **Group extra categories.** There are at most 5 coloured series. When there are more categories, show the top 4 and group the rest as **Other** (`chart-5`). The full breakdown goes in the table or legend list.
- **Comparison periods** ("last month") use `muted-foreground` at 40%, dashed. They are never a second bright colour.
- **Area fills** use the series colour as a vertical gradient from 24% to 0% opacity. This is the only gradient allowed in charts.
- **Gridlines** are horizontal only: `stroke: var(--border)`, dashed `3 3`. Axis text is `muted-foreground` at 12px. There are no axis lines.
- Status colours appear in charts only when they mean status (for example, overdue bars in the maintenance cost timeline).

## Implementation

The values live only in `apps/web/src/styles/index.css` (`:root` for light, `.dark` for dark), with `@theme inline` exposing them as Tailwind colours and the `hero-glow` utility defined below them. Don't copy the block into docs; change the CSS and update the tables here.

## Verified contrast (WCAG 2.x)

Computed from the values in `index.css`. Re-verify if you change any value.

| Pair                          | Dark: on bg / card / muted | Light: on bg / card / muted              |
| ----------------------------- | -------------------------- | ---------------------------------------- |
| foreground                    | 14.3 / 13.2 / 12.6         | 16.3 / 15.4 / 14.7                       |
| muted-foreground              | 10.9 / 10.1 / 9.6          | 8.9 / 8.4 / 8.0                          |
| primary (as text)             | 10.9 / 10.0 / 9.6          | 6.1 / 5.8 / 5.5                          |
| insight                       | 10.8 / 10.0 / 9.6          | 6.1 / 5.8 / 5.5                          |
| success                       | 11.4 / 10.5 / 10.1         | 6.1 / 5.8 / 5.5                          |
| warning                       | 10.9 / 10.0 / 9.6          | 6.1 / 5.8 / 5.6                          |
| destructive                   | 10.9 / 10.1 / 9.6          | 6.1 / 5.8 / 5.6                          |
| info                          | 8.4 / 7.8 / 7.4            | 5.0 / 4.7 / 4.5                          |
| primary-foreground on primary | 7.7                        | 6.4                                      |
| ring on background            | 6.7                        | 6.1 (`primary`; brand cyan would be 2.6) |

Every text pair passes AA (4.5:1). Light `info` on `muted` sits exactly at 4.5, so keep it at `font-medium` and don't lighten it.
