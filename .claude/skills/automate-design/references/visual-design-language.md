# Visual Design Language

## The concept: a digital cockpit for ownership

A great car interior is calm and dark. Every instrument there earns its place, the important number is the largest thing in view, and light is used to signal, not to decorate. AutoMate works the same way. The app should feel **engineered**: precise alignment, hairline detail, tabular read-outs, one accent colour and real photography of the owner's car.

The seven brand attributes, and what each one means on screen:

| Attribute    | On screen                                                                                                                                                 |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Intelligence | Insights explain themselves ("17.8 km/L · from 12 full-tank fills"). AI content is clearly labelled in teal. Smart defaults in forms.                     |
| Precision    | Tabular numbers, right-aligned columns, exact units, 1 px hairlines, a consistent 4 px grid.                                                              |
| Trust        | Honest data states (partial mileage shown as partial), visible record origins, confirmations before destructive actions, a secure-feeling document vault. |
| Luxury       | Generous outer whitespace, photography, restrained colour, smooth 150–250 ms motion, no clutter.                                                          |
| Technology   | Graphite surfaces, ice-blue signal colour, gauge and arc motifs, command palette, keyboard shortcuts.                                                     |
| Simplicity   | One primary action per region, progressive disclosure (details in sheets and tabs), short forms with defaults.                                            |
| Control      | The vehicle switcher is always visible, filters and date ranges are explicit, and data can be exported and backed up.                                     |

## Principles

1. **One hero per screen.** Each screen has a single dominant element: the vehicle hero, one hero metric or the primary chart. Everything else is subordinate in size and contrast.
2. **Instruments, not widgets.** A metric is an overline label, a large tabular value with a muted unit, and a one-line context ("vs Oct", "12 fills"). Don't add decorative icons in coloured circles.
3. **Depth through surfaces, not shadows.** Step `background → card → elevated → popover`. Use hairline borders. Dark mode has no drop shadows on cards.
4. **Light is a signal.** Cyan means "act here", "selected" or "in focus". Status colours mean status. Teal means AI. Nothing is coloured just to look nice.
5. **Photography is the emotion.** The user's own vehicle photo is the most premium element. Give it space in the Dashboard hero, Garage cards and vehicle detail.
6. **Whitespace outside, density inside.** Sections breathe (`gap-6`), while data inside tables and tiles is compact and aligned.
7. **Calm motion.** Motion explains a change of state (a sheet sliding in, a value appearing). It never performs.

## Signature elements

These are the only decorative devices allowed. Using them consistently is what makes AutoMate recognisable.

| Element                       | Spec                                                                                                                                        | Allowed on                                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Hero glow**                 | `hero-glow` utility (radial cyan at 8–14%, from the top)                                                                                    | Dashboard vehicle hero, vehicle detail hero, auth/onboarding backdrop, AI Assistant empty state. Max one per screen. |
| **Overline instrument label** | `text-xs font-medium uppercase tracking-wider text-muted-foreground`                                                                        | Metric labels, sidebar group labels, hero eyebrow ("ACTIVE VEHICLE")                                                 |
| **Gauge arc**                 | A thin (3–4 px) circular arc, open at the bottom like a speedometer, with a cyan fill on a `muted` track (the shared `GaugeRing` component) | Vehicle health score, service-interval progress, fuel-tank estimate. Max 1–3 per screen.                             |
| **Linear progress track**     | `Progress` `h-1.5`, fill coloured by status                                                                                                 | Odometer-to-next-service, document validity remaining, import progress                                               |
| **Plate badge**               | A bordered chip with the registration in uppercase and wide tracking                                                                        | Wherever a vehicle is identified                                                                                     |
| **Photo scrim**               | `bg-gradient-to-t from-background/90 via-background/40 to-transparent` over the bottom of vehicle photos                                    | Only under text that sits on a photo                                                                                 |
| **Chart area fade**           | Series colour gradient from 24% to 0%                                                                                                       | Area charts only                                                                                                     |
| **Translucent header**        | `bg-background/80 backdrop-blur` (existing)                                                                                                 | App header, mobile bottom nav. No other glass.                                                                       |

## Gradients, glow and glass

The table above is the **complete** list. There are no gradient buttons, gradient text, gradient card backgrounds, coloured glows around cards, neon outlines or glassmorphism cards.

## Composition patterns

- **Hero → instruments → detail.** A hero (vehicle or headline metric), then a row of 3–4 instruments, then detail sections (charts, lists).
- **Asymmetric main + aside** (8/4 on `lg`). Primary content on the left; due items, reminders or summaries on the right.
- **List → detail.** Tables and lists open details in a right `Sheet` on desktop for quick looks, or a full route for rich records (vehicle, service record, trip).
- **Purpose-specific layouts:**
  - Maintenance: health plus a component grid.
  - Documents: vault grid.
  - Trips: timeline.
  - Reminders: calendar.
  - AI: conversation.
  - Backup: stepper.

## Anti-patterns and their fixes

| Don't                                                   | Do                                                                         |
| ------------------------------------------------------- | -------------------------------------------------------------------------- |
| A grid of 8 identical stat cards                        | 1 hero plus 3–4 instruments; move the rest into a chart or table           |
| An icon in a coloured circle on every card              | A small muted icon top-right (as `StatCard` does), or none                 |
| Multiple cyan buttons in one area                       | One `default` button; the rest `outline`, `ghost` or in an overflow menu   |
| A different colour per expense category on every screen | The fixed `EXPENSE_CATEGORY_META` mapping, at most 5 series                |
| Centred everything, oversized empty paddings            | Left-aligned content in the 4 px rhythm; centre only empty states and auth |
| `rounded-3xl` bubbly cards                              | `rounded-xl` cards, `rounded-md` tiles                                     |
| Drop shadows on dark cards                              | A hairline ring plus a surface step                                        |
| Cartoon or 3D car illustrations, emoji, stock clipart   | The user's photo, or the neutral `VehicleImage` fallback; Lucide icons     |
| "Welcome back!!! 🎉"                                    | "Good evening, Aarav" with a quiet, factual sub-line                       |
| Spinner in the middle of a blank page                   | A skeleton shaped like the final layout                                    |
| A pie chart with 12 slices                              | A donut with ≤ 5 segments plus a ranked list                               |
| Showing "0.0 km/L" when data is insufficient            | "—" plus "Needs 2 full-tank fills"                                         |

## Mood references (spirit, not copies)

Think of an EV's instrument cluster at night, the quiet confidence of a premium banking app's statement view, and the precision of a pro audio or flight instrument. Never copy any brand's layout, logo, iconography or signature colours.
