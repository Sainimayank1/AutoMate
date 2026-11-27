# Colour System

The palette is called **Midnight Graphite**: cool, very dark graphite surfaces with one electric-cyan accent and a muted teal kept for intelligence features. The dark theme is primary. The light theme is an equal-quality alternative with the same hierarchy.

## Token architecture

1. **Values** live in `apps/web/src/styles/index.css`, under `:root` (light) and `.dark`, written in OKLCH.
2. **Exposure:** `@theme inline` maps each one to a Tailwind colour (`--color-card: var(--card)`).
3. **Use:** components only use the semantic classes (`bg-card`, `text-muted-foreground`, `border-border`, `ring-ring`, `fill-chart-1`).

**Forbidden in components and features:** hex/rgb/hsl/oklch literals, `[#…]` arbitrary colours, Tailwind palette classes (`zinc-*`, `slate-*`, `gray-*`, `cyan-*`, `teal-*`, `emerald-*`, `amber-*`, `red-*`…), `text-white`/`bg-black` (except `bg-black/50` overlays already inside primitives) and inline `style={{ color }}`. The exception is a chart's `var(--chart-n)` reference.

Opacity modifiers on tokens are fine (`bg-primary/10`, `border-border/60`).

## Semantic tokens

| Token | Role | Dark | Light | Classes |
| --- | --- | --- | --- | --- |
| `background` | App canvas (level 0) | graphite-black `#0b0d10` | cool off-white `#f9fafb` | `bg-background` |
| `sidebar` | Sidebar surface, between the canvas and cards | `#0e1114` | `#f5f7f9` | `bg-sidebar` |
| `card` | Cards, panels, table containers (level 1) | `#121519` | white | `bg-card` |
| `elevated` **(new)** | Raised areas inside cards: nested metric tiles, selected rows, hero inner panels (level 2) | `#1a1d22` | `#f6f7f9` | `bg-elevated` |
| `popover` | Menus, popovers, dialogs, sheets (level 3) | `#1a1d22` | white | `bg-popover` |
| `muted` / `secondary` / `accent` | Quiet fills, hover backgrounds, segmented-control track | `#22262b` | `#eef0f3` | `bg-muted`, `hover:bg-accent` |
| `border` | Hairlines and dividers | white at 8% | `#e1e3e6` | `border`, `divide-y` |
| `input` | Field borders | white at 12% | `#d5d8db` | primitive default |
| `foreground` | Primary text, key numbers | `#f2f3f5` | `#101419` | `text-foreground` |
| `muted-foreground` | Secondary text, labels, units, axes | `#9da2a9` | `#5e646b` | `text-muted-foreground` |
| `primary` | **Brand accent (electric cyan):** primary buttons, active nav, selection, focus ring, focus chart series, links | `#50d9ef` | `#00769c` | `bg-primary`, `text-primary` |
| `primary-foreground` | Text on primary | `#071117` | near-white | `text-primary-foreground` |
| `insight` **(new)** | **Secondary accent (muted teal):** AI-generated content, insights, AI Assistant UI | `#66ccba` | `#087970` | `text-insight`, `bg-insight/10` |
| `success` | Good, valid, improved efficiency | `#48cd8c` | `#007748` | `text-success` |
| `warning` | Due, expiring soon, needs inspection, odometer anomaly | `#fabb41` | `#a55800` | `text-warning` |
| `destructive` | Overdue, expired, errors, delete | `#f75d5c` | `#cc272e` | `text-destructive` |
| `info` | Upcoming, informational notices | `#6fb5ef` | `#0a71b1` | `text-info` |
| `ring` | Focus ring (cyan; the primitives apply `/50`) | = primary | = primary | `ring-ring` |
| `glow` **(new)** | Ambient light for `hero-glow` only | cyan at 14% | cyan at 8% | via utility |
| `chart-1…5` | Data series (see Charts) | see CSS | see CSS | `fill-chart-1`, `var(--chart-1)` |

Hex values are for orientation only. The OKLCH values in the CSS block below are the source of truth.

**Shadcn naming trap:** `accent` is a *hover fill*, not the brand accent. The brand accent is `primary`. Never use `bg-accent` to mean "highlighted".

## Usage rules

**Surfaces.** Build depth by stepping `background → card → elevated → popover`. Never put a card on a card with the same token: a nested panel uses `bg-elevated` or just a `border` divider. In dark mode, depth comes from surface steps and hairlines, not shadows.

**Text.** There are three levels only: `foreground` for content and values, `muted-foreground` for labels, units, meta and axes, and `muted-foreground/70` for de-emphasised meta (timestamps in dense lists). Don't use primary for body text. Primary text is for links and interactive values only.

**Accent budget.**
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

| Domain | Value → token · Lucide icon |
| --- | --- |
| Maintenance | Good → `success` · `CircleCheck`; Upcoming → `info` · `Clock`; Due → `warning` · `CalendarClock`; Overdue → `destructive` · `CircleAlert`; Needs inspection → `warning` · `ScanSearch`; Replaced → neutral `secondary` · `PackageCheck`; Monitoring → neutral outline · `Activity` |
| Documents | Valid → `success` · `ShieldCheck`; Expiring ≤ 30 days → `warning` · `Hourglass`; Expired → `destructive` · `CircleAlert`; No expiry → neutral · `FileCheck2` |
| Notification priority | High → `destructive` dot; Medium → `warning` dot; Low → `muted-foreground` dot; AI insight → `insight` · `Sparkles` |
| Mileage reliability | Reliable → normal text; Partial sequence / insufficient data → `muted-foreground` · `CircleDashed` with an explanation (never warning red) |
| Odometer | Reading lower than the previous one → `warning` · `TriangleAlert` "Odometer went backwards" |
| Import validation | Valid row → `success`; Warning (duplicate suspected) → `warning`; Error (will be skipped) → `destructive` |

### Trends and deltas

Colour encodes **meaning, not direction**:
- Mileage ↑ is `success`; mileage ↓ by more than 10% is `warning`.
- Cost ↑ is `warning`; cost ↓ is `success`.
- Neutral metrics (distance, trip count) use `muted-foreground` with a `TrendingUp`/`TrendingDown` icon.

Never use `destructive` for a normal cost increase.

## Charts

| Series | Dark | Light | Use |
| --- | --- | --- | --- |
| `chart-1` | cyan `oklch(0.82 0.12 210)` | `oklch(0.55 0.12 222)` | Focus series: this vehicle, current period, Fuel category |
| `chart-2` | indigo `oklch(0.70 0.13 275)` | `oklch(0.52 0.15 275)` | Second series; Maintenance & repairs |
| `chart-3` | teal `oklch(0.76 0.09 175)` | `oklch(0.58 0.09 175)` | Insurance |
| `chart-4` | orchid `oklch(0.72 0.13 330)` | `oklch(0.58 0.15 340)` | Loan interest / EMI |
| `chart-5` | silver `oklch(0.72 0.01 255)` | `oklch(0.62 0.01 255)` | Other / everything else |

- **Fixed category mapping.** An expense category has the same colour in every chart, legend and chip across the app. Define it once (a `EXPENSE_CATEGORY_META` map with label, Lucide icon and chart token) when the Expenses module is built, and import it everywhere.
- **Group extra categories.** There are at most 5 coloured series. When there are more categories, show the top 4 and group the rest as **Other** (`chart-5`). The full breakdown goes in the table or legend list.
- **Comparison periods** ("last month") use `muted-foreground` at 40%, dashed. They are never a second bright colour.
- **Area fills** use the series colour as a vertical gradient from 24% to 0% opacity. This is the only gradient allowed in charts.
- **Gridlines** are horizontal only: `stroke: var(--border)`, dashed `3 3`. Axis text is `muted-foreground` at 12px. There are no axis lines.
- Status colours appear in charts only when they mean status (for example, overdue bars in the maintenance cost timeline).

## Implementation block

Replace the colour variables in `apps/web/src/styles/index.css` with the following. Keep the radius and every other existing variable.

```css
/* @theme inline: add these three lines; the rest already exists */
--color-elevated: var(--elevated);
--color-insight: var(--insight);
--color-insight-foreground: var(--insight-foreground);

:root {
  --background: oklch(0.985 0.002 255);
  --foreground: oklch(0.19 0.012 255);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.19 0.012 255);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.19 0.012 255);
  --elevated: oklch(0.977 0.003 255);
  --primary: oklch(0.52 0.12 225);
  --primary-foreground: oklch(0.99 0 0);
  --secondary: oklch(0.955 0.004 255);
  --secondary-foreground: oklch(0.19 0.012 255);
  --muted: oklch(0.955 0.004 255);
  --muted-foreground: oklch(0.5 0.014 255);
  --accent: oklch(0.955 0.004 255);
  --accent-foreground: oklch(0.19 0.012 255);
  --destructive: oklch(0.55 0.2 25);
  --success: oklch(0.5 0.12 158);
  --success-foreground: oklch(0.99 0 0);
  --warning: oklch(0.54 0.13 58);
  --warning-foreground: oklch(0.99 0 0);
  --info: oklch(0.53 0.13 245);
  --info-foreground: oklch(0.99 0 0);
  --insight: oklch(0.52 0.09 185);
  --insight-foreground: oklch(0.99 0 0);
  --border: oklch(0.915 0.005 255);
  --input: oklch(0.88 0.006 255);
  --ring: oklch(0.52 0.12 225);
  --glow: oklch(0.52 0.12 225 / 8%);
  --chart-1: oklch(0.55 0.12 222);
  --chart-2: oklch(0.52 0.15 275);
  --chart-3: oklch(0.58 0.09 175);
  --chart-4: oklch(0.58 0.15 340);
  --chart-5: oklch(0.62 0.01 255);
  --sidebar: oklch(0.975 0.003 255);
  --sidebar-foreground: oklch(0.19 0.012 255);
  --sidebar-primary: oklch(0.52 0.12 225);
  --sidebar-primary-foreground: oklch(0.99 0 0);
  --sidebar-accent: oklch(0.94 0.005 255);
  --sidebar-accent-foreground: oklch(0.19 0.012 255);
  --sidebar-border: oklch(0.915 0.005 255);
  --sidebar-ring: oklch(0.52 0.12 225);
}

.dark {
  --background: oklch(0.16 0.007 255);
  --foreground: oklch(0.965 0.003 255);
  --card: oklch(0.195 0.009 255);
  --card-foreground: oklch(0.965 0.003 255);
  --popover: oklch(0.23 0.01 255);
  --popover-foreground: oklch(0.965 0.003 255);
  --elevated: oklch(0.23 0.01 255);
  --primary: oklch(0.82 0.12 210);
  --primary-foreground: oklch(0.17 0.02 240);
  --secondary: oklch(0.265 0.011 255);
  --secondary-foreground: oklch(0.965 0.003 255);
  --muted: oklch(0.265 0.011 255);
  --muted-foreground: oklch(0.71 0.012 255);
  --accent: oklch(0.265 0.011 255);
  --accent-foreground: oklch(0.965 0.003 255);
  --destructive: oklch(0.68 0.19 24);
  --success: oklch(0.76 0.15 158);
  --success-foreground: oklch(0.17 0.02 240);
  --warning: oklch(0.83 0.15 80);
  --warning-foreground: oklch(0.17 0.02 240);
  --info: oklch(0.75 0.11 245);
  --info-foreground: oklch(0.17 0.02 240);
  --insight: oklch(0.78 0.1 180);
  --insight-foreground: oklch(0.17 0.02 240);
  --border: oklch(1 0 0 / 8%);
  --input: oklch(1 0 0 / 12%);
  --ring: oklch(0.82 0.12 210);
  --glow: oklch(0.82 0.12 210 / 14%);
  --chart-1: oklch(0.82 0.12 210);
  --chart-2: oklch(0.7 0.13 275);
  --chart-3: oklch(0.76 0.09 175);
  --chart-4: oklch(0.72 0.13 330);
  --chart-5: oklch(0.72 0.01 255);
  --sidebar: oklch(0.175 0.008 255);
  --sidebar-foreground: oklch(0.965 0.003 255);
  --sidebar-primary: oklch(0.82 0.12 210);
  --sidebar-primary-foreground: oklch(0.17 0.02 240);
  --sidebar-accent: oklch(0.24 0.01 255);
  --sidebar-accent-foreground: oklch(0.965 0.003 255);
  --sidebar-border: oklch(1 0 0 / 7%);
  --sidebar-ring: oklch(0.82 0.12 210);
}

/* The one sanctioned ambient-light effect; see visual-design-language.md for where it may appear. */
@utility hero-glow {
  background-image: radial-gradient(120% 80% at 50% 0%, var(--glow), transparent 70%);
}
```

## Verified contrast (WCAG 2.x)

These were computed from the OKLCH values above. Re-verify if you change any value.

| Pair | Dark: on bg / card / muted | Light: on bg / card / muted |
| --- | --- | --- |
| foreground | 17.5 / 16.5 / 13.8 | 17.7 / 18.5 / 16.2 |
| muted-foreground | 7.6 / 7.1 / 6.0 | 5.7 / 6.0 / 5.3 |
| primary (as text) | 11.6 / 10.9 / 9.1 | 5.0 / 5.2 / 4.5 |
| insight | 10.1 / 9.5 / 8.0 | 5.0 / 5.3 / 4.6 |
| success | 9.6 / 9.1 / 7.6 | 5.4 / 5.6 / 4.9 |
| warning | 11.3 / 10.7 / 8.9 | 5.1 / 5.3 / 4.6 |
| destructive | 6.2 / 5.8 / 4.9 | 5.2 / 5.4 / 4.7 |
| info | 8.8 / 8.3 / 7.0 | 5.0 / 5.2 / 4.6 |
| primary-foreground on primary | 11.4 | 5.0 |

Every pair passes AA (4.5:1) for normal text. In the light theme, status text on a `/15` tinted badge sits close to 4.5. Keep badge text at `font-medium` and don't lighten these tokens.
