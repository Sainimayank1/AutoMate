# Typography

## Typefaces (Night dash)

Two families, self-hosted through Fontsource (no third-party font requests). They replace Stitch's Manrope and Inter, which no longer apply:

| Family                  | Tailwind                                 | Use                                                                                                                   |
| ----------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Geist Variable**      | `font-sans` (default) and `font-heading` | Everything: body, labels, buttons, tables, headings, the wordmark and metric values                                   |
| **Geist Mono Variable** | `font-mono`                              | Figures that read as machine output: registration plates, VINs, engine numbers, odometer readouts, keyboard shortcuts |

- `font-heading` maps to Geist as well. Keep it on headings so the heading face stays one token away.
- Don't add a third family or use mono outside its role (no mono for prices or prose).
- Weights: **400** body and **500** for everything that needs emphasis (labels, buttons, headings, metric values). Nothing heavier: no `font-semibold` or `font-bold`.
- Every financial figure, distance and mileage uses `tabular-nums` so columns and live updates never jitter.

## Type scale

| Role                  | Classes                                                      | Size / line | Where                                                                      |
| --------------------- | ------------------------------------------------------------ | ----------- | -------------------------------------------------------------------------- |
| Hero metric           | `font-heading text-4xl font-medium tabular-nums md:text-5xl` | 36→48 px    | One per screen at most: dashboard odometer or headline cost, analytics TCO |
| Display title         | `font-heading text-3xl font-medium md:text-4xl`              | 30→36 px    | Auth, onboarding and the empty Garage welcome only                         |
| Page title (h1)       | `font-heading text-2xl font-medium`                          | 24 px       | `PageHeader`, once per page                                                |
| Section title (h2)    | `font-heading text-base font-medium`                         | 16 px       | `SectionHeader`                                                            |
| Card title (h3)       | `text-sm font-medium`                                        | 14 px       | `CardTitle`, `ChartCard` titles                                            |
| Metric value          | `font-heading text-2xl font-medium tabular-nums`             | 24 px       | `StatCard`                                                                 |
| Metric value, compact | `text-lg font-medium tabular-nums`                           | 18 px       | Nested tiles inside a hero, mobile stat rows                               |
| Body                  | `text-sm`                                                    | 14 px       | Default UI text                                                            |
| Body, reading         | `text-base leading-7`                                        | 16 px       | Long descriptions, help text blocks                                        |
| Secondary             | `text-sm text-muted-foreground`                              | 14 px       | Descriptions, meta                                                         |
| Label                 | `text-sm font-medium`                                        | 14 px       | Form labels (the `FieldLabel` primitive)                                   |
| Small label           | `text-xs text-muted-foreground` (sentence case)              | 12 px       | Labels on metrics, sidebar group labels, hero labels ("Active vehicle")    |
| Caption               | `text-xs text-muted-foreground`                              | 12 px       | Hints, timestamps, chart axes, helper text                                 |

Rules:

- Use at most **three sizes inside one card**: label, value, caption.
- Hierarchy comes from size plus `foreground`/`muted-foreground`, with `font-medium` as the only extra weight. Never colour a heading.
- **No overlines.** No `uppercase` and no letter-spacing utilities (`tracking-tight`, `tracking-wide`, `tracking-wider`, `tracking-widest`). Labels are sentence case in `text-xs text-muted-foreground`.
- Use Tailwind's scale. Don't introduce arbitrary sizes (`text-[13px]`).
- Form inputs keep the primitive's `text-base md:text-sm`, because 16 px on phones prevents iOS zoom.

## Numbers: the instrument feel

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
- Exceptions: proper nouns and acronyms (AutoMate, RC, PUC, EMI, AI, FASTag, VIN). Small labels are sentence case too; nothing is uppercased by CSS.
- Registration numbers display uppercase with hyphens (`HR-26-EV-4821`) in Geist Mono inside `PlateBadge` (see `component-guidelines.md`).
- Prose stays within `max-w-prose` (about 65 characters).
- Truncate single-line labels with `truncate` plus `min-w-0` on the flex parent, and show the full text in a `title` or tooltip when truncation is likely (station names, notes).
- For long unbreakable strings (VIN, policy numbers), use `break-all` inside detail views and `font-mono tabular-nums`.
- Indian English spelling throughout: kilometres, litres, licence (noun), tyres, colour, organise, cheque.
