# Typography

## Typeface

**Geist Variable** for everything. It is already self-hosted through `@fontsource-variable/geist` and exposed as `font-sans` and `font-heading`. It has a technical, precise feel with good tabular figures.

- Don't add Inter, Manrope or a second family. One family with disciplined weights looks more premium than two.
- Weights: **400** body, **500** labels, buttons and emphasis, **600** headings and metric values. Never use 700+ (it reads as shouting) or below 400 (it disappears on graphite).
- `font-heading` stays mapped to the same family. Use it on headings and metric values so a future display face would be a one-line change.

## Type scale

| Role | Classes | Size / line | Where |
| --- | --- | --- | --- |
| Hero metric | `font-heading text-4xl font-semibold tracking-tight tabular-nums md:text-5xl` | 36→48 px | One per screen at most: dashboard odometer or headline cost, analytics TCO |
| Display title | `font-heading text-3xl font-semibold tracking-tight md:text-4xl` | 30→36 px | Auth, onboarding and the empty Garage welcome only |
| Page title (h1) | `font-heading text-2xl font-semibold tracking-tight` | 24 px | `PageHeader`, once per page |
| Section title (h2) | `font-heading text-base font-semibold` | 16 px | `SectionHeader` |
| Card title (h3) | `text-sm font-medium` | 14 px | `CardTitle`, `ChartCard` titles |
| Metric value | `font-heading text-2xl font-semibold tracking-tight tabular-nums` | 24 px | `StatCard` |
| Metric value, compact | `text-lg font-semibold tabular-nums` | 18 px | Nested tiles inside a hero, mobile stat rows |
| Body | `text-sm` | 14 px | Default UI text |
| Body, reading | `text-base leading-7` | 16 px | AI responses, long descriptions, help text blocks |
| Secondary | `text-sm text-muted-foreground` | 14 px | Descriptions, meta |
| Label | `text-sm font-medium` | 14 px | Form labels (the `FieldLabel` primitive) |
| Overline | `text-xs font-medium uppercase tracking-wider text-muted-foreground` | 12 px | Instrument labels on metrics, sidebar group labels, hero eyebrow |
| Caption | `text-xs text-muted-foreground` | 12 px | Hints, timestamps, chart axes, helper text |

Rules:
- Use at most **three sizes inside one card**: overline or label, value, caption.
- Hierarchy comes from size and weight plus `foreground`/`muted-foreground`. Never colour a heading cyan.
- Use Tailwind's scale. Don't introduce arbitrary sizes (`text-[13px]`).
- Form inputs keep the primitive's `text-base md:text-sm`, because 16 px on phones prevents iOS zoom.

## Numbers: the cockpit feel

Numbers are the product. Treat them like instrument read-outs.

1. **`tabular-nums` everywhere numbers sit in columns, cards, tables, timelines, odometers or update live.**
2. **Right-align numeric table columns.** The header aligns the same way as its cells.
3. **Format only through `apps/web/src/utils/format.ts`:**
   - `formatCurrency` gives ₹1,25,000.00.
   - `formatNumber` gives 1,25,000.
   - `formatDistance` gives 8,450 km.
   - `formatVolume` gives 30 L, `formatEfficiency` gives 17.8 km/L.
   - `formatDate` gives 27/11/2026, `formatDateTime` gives 27/11/2026, 9:30 AM.
   - Missing values render `EMPTY_VALUE` (—).
   - Never call `toFixed`, `toLocaleString` or `Intl` directly in components.
4. **Split units in hero and stat values.** For hero metrics, render the number in `foreground` and the unit smaller and muted:
   ```tsx
   <span className="tabular-nums">{formatNumber(odometer)}</span>
   <span className="ml-1 text-base font-medium text-muted-foreground">{UNITS.distance}</span>
   ```
   In tables, lists and body text, use the combined helpers (`formatDistance`). Keep `₹` attached to the amount (`formatCurrency` output is never split).
5. **Precision:**
   - Money: two decimals in tables, details and forms. Summary cards may use whole rupees via `formatNumber(value, { maxFractionDigits: 0 })` with a `₹` prefix, but only for summary displays.
   - Efficiency: 1 decimal. Volume: up to 2 decimals. Distance: whole km in summaries.
   - Cost per km: 2 decimals (₹5.33/km).
6. **Compact values** (₹1.2L, ₹45K) are for chart axes and tight mobile chips only, using `formatCurrencyCompact` (to be added to `utils/format.ts` with a test, using `Intl` `notation: "compact"` with `en-IN`). Never use compact values in tables or details.
7. **Never truncate a number.** Let it wrap the layout or shrink the size step. Labels may truncate; values may not.
8. **No count-up animations on financial values.** They show wrong intermediate numbers.
9. Deltas use a sign and a unit: `+₹1,240.00 vs Oct` or `−0.6 km/L`.

## Text conventions

- **Sentence case** for titles, buttons, labels, tabs and menu items ("Add fuel entry", not "Add Fuel Entry").
- Exceptions: proper nouns and acronyms (AutoMate, RC, PUC, EMI, AI, FASTag, VIN) and overlines (uppercase via CSS, written in sentence case in code).
- Registration numbers display uppercase with spaces (`HR 26 AB 1234`) in `PlateBadge` (see `component-guidelines.md`).
- Prose stays within `max-w-prose` (about 65 characters).
- Truncate single-line labels with `truncate` plus `min-w-0` on the flex parent, and show the full text in a `title` or tooltip when truncation is likely (station names, notes).
- For long unbreakable strings (VIN, policy numbers), use `break-all` inside detail views and `font-medium tabular-nums tracking-wide`.
- Indian English spelling throughout: kilometres, litres, licence (noun), tyres, colour, organise, cheque.
