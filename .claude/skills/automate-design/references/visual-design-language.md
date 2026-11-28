# Visual Design Language

## The concept: Night dash, an instrument cluster at night

Indian car owners log fuel, spend, service, papers and trips per vehicle and see what the car really costs. The character is **exact, unhurried and a little mechanical**. A car's instrument cluster at night is calm and dark: every gauge earns its place, the important number is the largest thing in view, and light is used to signal, not to decorate. AutoMate works the same way: neutral graphite (no blue tint), off-white text, precise alignment, hairline detail, Geist Mono read-outs, one cyan accent used rarely, the registration plate as the signature, and real photography of the owner's car. (Direction set with the unslop skill by Damir Sokolovsky, CC BY 4.0; it overrides Stitch's colour and type.)

The seven brand attributes, and what each one means on screen:

| Attribute    | On screen                                                                                                                                                 |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Intelligence | Insights explain themselves ("17.8 km/L · from 12 full-tank fills") and say they're rules, not AI. Smart defaults in forms.                               |
| Precision    | Tabular numbers, right-aligned columns, exact units, 1 px hairlines, a consistent 4 px grid.                                                              |
| Trust        | Honest data states (partial mileage shown as partial), visible record origins, confirmations before destructive actions, a secure-feeling document vault. |
| Luxury       | Generous outer whitespace, photography, restrained colour, smooth 150–250 ms motion, no clutter.                                                          |
| Technology   | Graphite surfaces, a cyan signal used sparingly, mono read-outs, the number plate, command palette, keyboard shortcuts.                                   |
| Simplicity   | One primary action per region, progressive disclosure (details in sheets and tabs), short forms with defaults.                                            |
| Control      | The vehicle switcher is always visible, filters and date ranges are explicit, and data can be exported and backed up.                                     |

## Principles

1. **One hero per screen.** Each screen has a single dominant element: the vehicle hero, one hero metric or the primary chart. Everything else is subordinate in size and contrast.
2. **Instruments, not widgets.** A metric is a small sentence-case label, a large tabular value with a muted unit, and a one-line context ("vs Oct", "12 fills"). Don't add decorative icons in coloured circles.
3. **Depth through surfaces, not shadows.** Step `background → card → elevated → popover`. Use hairline borders. Dark mode has no drop shadows on cards.
4. **Light is a signal.** Cyan (`brand`) means "selected", "in focus" or "the key figure", and appears only in the places `color-system.md` lists. Buttons and links are neutral. Status colours mean status and live on badges and icon tiles. Nothing is coloured just to look nice.
5. **Photography is the emotion.** The user's own vehicle photo is the most premium element. Give it space in the Dashboard hero, Garage cards and vehicle detail.
6. **Whitespace outside, density inside.** Sections breathe (`gap-6`), while data inside tables and tiles is compact and aligned.
7. **Calm motion.** Motion explains a change of state (a sheet sliding in, a value appearing). It never performs.

## Signature elements

These are the only decorative devices allowed. Using them consistently is what makes AutoMate recognisable.

| Element                   | Spec                                                                                                                                                                 | Allowed on                                                                                                                            |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Number plate**          | `PlateBadge`: a white plate (`bg-plate`, `text-plate-foreground`, constant in both themes), Geist Mono letters, `rounded-sm`, a thin `bg-brand` strip on the left    | Wherever a vehicle is named by its plate: sidebar switcher, switcher items, dashboard hero, vehicle card, vehicle page. Nowhere else. |
| **Mono read-out**         | Geist Mono, `tabular-nums`; the dashboard hero's odometer in `text-brand`                                                                                            | Odometer, VIN, plates, keyboard shortcuts. One `text-brand` figure per screen (the dashboard odometer).                               |
| **Small label**           | `text-xs text-muted-foreground`, sentence case                                                                                                                       | Metric labels, sidebar group labels, hero labels ("Active vehicle")                                                                   |
| **Gauge arc**             | A thin (3–4 px) circular arc, open at the bottom like a speedometer, with a `primary` (neutral) or status fill on a `muted` track (the shared `GaugeRing` component) | Service-interval progress, fuel-tank estimate. Max 1–3 per screen.                                                                    |
| **Linear progress track** | `Progress` `h-1.5`, fill coloured by status                                                                                                                          | Odometer-to-next-service, document validity remaining, import progress                                                                |
| **Photo scrim**           | `bg-gradient-to-t from-background/90 via-background/40 to-transparent` over the bottom of vehicle photos                                                             | Only under text that sits on a photo (vehicle photos aren't supported yet)                                                            |
| **Chart area fade**       | Series colour fading from 24% to 0%                                                                                                                                  | Area charts only                                                                                                                      |

## Gradients, glow and glass

The table above is the **complete** list. There is no glow at all (the `hero-glow` utility and `--glow` token were removed) and no glass: the header and bottom nav are solid, and overlays dim with a plain `bg-black/60`, with no backdrop blur. There are no gradient buttons, gradient text, gradient card backgrounds, coloured card borders, neon outlines or glassmorphism cards. The chart area fade (and the photo scrim, once photos exist) are the only gradients.

## Composition patterns

- **Hero → instruments → detail.** A hero (vehicle or headline metric), then a row of 3–4 instruments, then detail sections (charts, lists).
- **Asymmetric main + aside** (8/4 on `lg`). Primary content on the left; due items, reminders or summaries on the right.
- **List → detail.** Tables and lists open details in a right `Sheet` on desktop for quick looks, or a full route for rich records (vehicle, service record, trip).
- **Purpose-specific layouts:**
  - Maintenance: health plus a component grid.
  - Documents: vault grid.
  - Trips: timeline.
  - Reminders: calendar.
  - Backup: stepper.

## Anti-patterns and their fixes

| Don't                                                   | Do                                                                         |
| ------------------------------------------------------- | -------------------------------------------------------------------------- |
| A grid of 8 identical stat cards                        | 1 hero plus 3–4 instruments; move the rest into a chart or table           |
| An icon in a coloured circle on every card              | A small muted icon top-right (as `StatCard` does), or none                 |
| Multiple filled buttons in one area                     | One `default` button; the rest `outline`, `ghost` or in an overflow menu   |
| Cyan buttons, links or headings                         | Neutral `primary`; cyan only where `color-system.md` lists it              |
| A card with a coloured border or a tinted row           | A neutral hairline; status on a badge or an icon tile                      |
| UPPERCASE TRACKED LABELS, `font-semibold`               | Sentence-case `text-xs text-muted-foreground`, `font-medium` at most       |
| A different colour per expense category on every screen | The fixed `EXPENSE_CATEGORY_META` mapping, at most 5 series                |
| Centred everything, oversized empty paddings            | Left-aligned content in the 4 px rhythm; centre only empty states and auth |
| `rounded-3xl` bubbly cards                              | `rounded-xl` cards, `rounded-md` tiles                                     |
| Drop shadows on dark cards                              | A hairline ring plus a surface step                                        |
| Cartoon or 3D car illustrations, emoji, stock clipart   | The user's photo, or the neutral `VehicleImage` fallback; Lucide icons     |
| "Welcome back!!! 🎉", "Good evening, Aarav"             | The page's name: "Dashboard" with the date; "Log in"                       |
| Spinner in the middle of a blank page                   | A skeleton shaped like the final layout                                    |
| A pie chart with 12 slices                              | A donut with ≤ 5 segments plus a ranked list                               |
| Showing "0.0 km/L" when data is insufficient            | "—" plus "Needs 2 full-tank fills"                                         |

## Mood references (spirit, not copies)

Think of an EV's instrument cluster at night, the quiet confidence of a premium banking app's statement view, and the precision of a pro audio or flight instrument. Never copy any brand's layout, logo, iconography or signature colours.
