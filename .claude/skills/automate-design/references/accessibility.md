# Accessibility

The target is **WCAG 2.2 AA** in both themes. Premium means usable by everyone. Never trade accessibility for a visual effect.

## Contrast

- Every token pair in `color-system.md` was verified to be ≥ 4.5:1 for text. Re-verify if you change token values.
- Placeholder and disabled text are exempt but must still be legible. Don't go below `muted-foreground/70`.
- Non-text UI (field borders, focus ring, chart lines, gauge tracks vs fills, status dots) must reach ≥ 3:1 against adjacent colours. The cyan focus ring and status fills meet this. The `border` hairline is decorative and must not be the only boundary of an input (inputs use `input`, which is stronger).
- Text on photos always sits on the photo scrim.

## Keyboard and focus

- Everything interactive is reachable with Tab in visual order and operable with Enter/Space. Radix primitives handle menus, dialogs, tabs and selects. Don't replace them with clickable `div`s.
- The focus ring is always visible (`focus-visible:ring-*` from the primitives). Custom clickable surfaces (linked `StatCard`, `VehicleCard`, list rows) reproduce it with `outline-none focus-visible:ring-2 focus-visible:ring-ring`.
- Dialogs, sheets and drawers trap focus and return it to the trigger on close (Radix/vaul). Destructive dialogs focus Cancel first.
- Add a skip link "Skip to content" as the first focusable element in `AppShell`, targeting the main region.
- Clickable rows have one real link or button (a stretched link on the title). Row action menus stay separately focusable.

## Semantics

- Exactly one `<h1>` per page (`PageHeader`), with `h2` for sections (`SectionHeader`) and `h3` for card titles. Don't skip levels.
- Landmarks: `<nav aria-label="Main">` (sidebar), `<nav aria-label="Primary">` (bottom nav), `<main>`, `<header>`.
- Lists of records are `ul`/`ol` or `table`. Use real `<table>` for tabular data (the `DataTable` primitive), with sortable headers setting `aria-sort`.
- The bottom nav active item has `aria-current="page"`. Stepper steps use `aria-current="step"`.
- `lang="en-IN"` is set on `<html>` (already done).

## Forms

- Every input has a visible label (`FormField`). Placeholders are examples, not labels.
- Errors are linked via `aria-describedby`, inputs get `aria-invalid`, and form-level errors use `role="alert"` (`FormError`). On submit failure, focus the first invalid field.
- Units in addons are also present in the accessible name ("Quantity in litres").
- Segmented controls (`ToggleGroup`) have a group label. Required/optional state is in the label text.

## Status, data and charts

- **Status is never colour alone:** an icon plus text label every time (`StatusBadge`). Priority dots in notifications have `sr-only` text ("High priority").
- **Metrics:** values with split units get an accessible name, for example `aria-label="Odometer 8,450 kilometres"` on the metric container, when the visual unit is abbreviated.
- **Charts:**
  - The `ChartCard` body has `role="img"` and an `aria-label` summarising the insight ("Fuel spend, last 6 months; highest in November at ₹5,539").
  - Provide a "View as table" toggle (or a visually hidden table) with the underlying data.
  - Tooltips are also reachable by keyboard focus on data points where Recharts supports it.
  - Series are distinguishable by more than hue (dashed comparison line, direct labels, legend order).
- **Gauges:** `role="img"` with a value label. Progress bars use the `Progress` primitive (`role="progressbar"` with `aria-valuenow`).
- **Live regions:** toasts (sonner) announce politely. Loading uses `role="status"` (`LoadingState`). AI streaming responses use `aria-live="polite"` on the message container, announcing completion rather than every token.

## Touch and motion

- Touch targets are ≥ 40 px on phones (WCAG 2.2 minimum is 24 px; we exceed it). Swipe actions always have a visible button alternative.
- Respect `prefers-reduced-motion` (`motion-safe:`). Nothing flashes more than 3 times per second.

## Images and icons

- Vehicle photos: `alt="Maruti Suzuki Victoris"` (make and model). Decorative imagery and the hero glow: `alt=""` / `aria-hidden`.
- Icon-only buttons need an `aria-label`, plus a `Tooltip` on desktop. Icons next to text get `aria-hidden`.
- Document thumbnails: `alt="Insurance policy, page 1"`.

## Quick audit per screen

1. Tab through the whole screen. Is the order logical, is focus always visible, and is nothing trapped?
2. Zoom to 200%. Is there no loss of content and no horizontal scroll at 1280 px?
3. Check both themes for contrast in custom compositions.
4. Run a screen-reader pass on key flows (VoiceOver/NVDA/TalkBack): the page title is announced, forms are labelled, and errors are announced.
5. Check the axe/Lighthouse accessibility panel. Zero violations is the bar.
