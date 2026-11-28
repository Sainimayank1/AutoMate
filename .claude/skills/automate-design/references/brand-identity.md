# Brand Identity

## Positioning

> **AutoMate**: the intelligent ownership companion that knows your car, understands your driving, and helps you take better care of it.

AutoMate is a premium vehicle-ownership platform, not an expense tracker. The brand is a knowledgeable, discreet co-pilot. It is confident and precise, and never loud or cute.

## Name

- Always write **AutoMate**: capital A, capital M, one word. Never "Automate", "Auto Mate", "AUTOMATE" or "Auto-Mate".

## Logo mark

A flat, single-colour chevron "A" in `brand` cyan (the crossbar is `brand` too), on a rounded graphite tile. No second colour, no gradient. It reads as the "A" of AutoMate and as a road vanishing to a point. It is never a car silhouette.

Canonical SVG (28×28 grid, as in the Stitch auth and dashboard screens):

```svg
<svg viewBox="0 0 28 28" fill="none" aria-hidden="true">
  <rect width="28" height="28" rx="6" class="fill-secondary" />
  <path d="M14 5L22 21H18.4L14 11.8L9.6 21H6L14 5Z" class="fill-brand" />
  <path d="M10.8 17.5H17.2" class="stroke-brand" stroke-width="2" stroke-linecap="round" />
</svg>
```

**Logo component:** `components/layout/brand-logo.tsx` exports `<BrandMark className />` (the tile) and `<BrandLogo size="md" | "lg" />` (mark plus wordmark). Never paste the SVG into pages.

| Rule         | Spec                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------- |
| Clear space  | At least 25% of the mark's height on all sides                                                          |
| Minimum size | 16 px (favicon), 20 px in UI, 28 px in the sidebar header                                               |
| Colours      | Tile `secondary`; chevron and crossbar `brand` (`#0EA5E9` dark, `#0369A1` light)                        |
| Don't        | Recolour the chevron, add gradients, glow, shadows or outlines, place it on a busy photo, or animate it |

## Wordmark

- "AutoMate" in Geist (`font-heading`), `font-medium` (500), no letter-spacing, `text-foreground`, all one colour. Don't two-tone it.
- **Lockup:** the mark to the left of the wordmark, gap `gap-2.5`. Sidebar: mark `size-8` + wordmark `text-lg`. Auth pages: `<BrandLogo size="lg" />`.
- When the sidebar is icon-collapsed, show the mark only.

## App icon and favicon

Static assets, so literal colours are allowed here (and only here).

- **Favicon** (`apps/web/public/favicon.svg`): the mark with the dark-theme tile:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" fill="none"><rect width="28" height="28" rx="6" fill="#232325"/><path d="M14 5L22 21H18.4L14 11.8L9.6 21H6L14 5Z" fill="#0EA5E9"/><path d="M10.8 17.5H17.2" stroke="#0EA5E9" stroke-width="2" stroke-linecap="round"/></svg>
```

- **App icon** (PWA/OS, 512 px master, when needed): full-bleed `#141415` (the dark `background`, also the manifest and `theme-color`), no glow, and the mark centred at 56% width.

## Brand colours

The full system is in `color-system.md`. The brand-level summary (dark theme, Night dash values; Stitch's ice blue and teal no longer apply):

| Name        | Role                                                                                           | Value                                                     |
| ----------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Graphite    | Sidebar → canvas → card → popover → raised                                                     | `#0F0F10` → `#141415` → `#19191B` → `#1C1C1F` → `#232325` |
| Off-white   | Text and the neutral `primary` button fill                                                     | `#EDEDED` (muted `#A1A1A6`)                               |
| Brand cyan  | The one accent: logo, active nav icon, selected vehicle, odometer, chart-1, focus, plate strip | `#0EA5E9` (`#0369A1` in light)                            |
| Plate white | The registration plate, both themes                                                            | `#F4F4F1`, letters `#121212`                              |

## Iconography

- **Lucide only** (`lucide-react`). Don't mix icon sets, use emoji as icons, or use filled icon variants.
- Sizes: `size-4` (16 px) is the default in buttons, menus, nav and inline text. Use `size-5` for mobile bottom nav and empty-state media, and `size-6` with `strokeWidth={1.5}` for large decorative contexts (empty states, onboarding).
- Colour: `text-muted-foreground` by default. Use `text-foreground` when the icon is the content, `sidebar-primary` (brand cyan) for the active nav item and `text-brand` for the selected-vehicle check only, and status tokens only inside status badges and icon tiles.
- Icon-only buttons always have an `aria-label` and a `Tooltip` on desktop. Decorative icons get `aria-hidden`.
- **Canonical icons.** Never use two different icons for the same concept.

| Concept               | Icon                                           | Concept                 | Icon                                                 |
| --------------------- | ---------------------------------------------- | ----------------------- | ---------------------------------------------------- |
| Dashboard             | `LayoutDashboard`                              | Garage / vehicle        | `Car` (`CarFront` in the brand-adjacent empty state) |
| Fuel                  | `Fuel`                                         | Expenses                | `ReceiptIndianRupee`                                 |
| Maintenance / service | `Wrench`                                       | Documents               | `FileText`                                           |
| Trips                 | `Map` (`Route` for a single trip)              | Analytics               | `ChartNoAxesCombined`                                |
| Insights (rules)      | `Lightbulb`; never `Sparkles` (no AI features) | Notifications           | `Bell`                                               |
| Settings              | `Settings`                                     | Backup & Export         | `DatabaseBackup`                                     |
| Odometer / health     | `Gauge`                                        | Money (generic)         | `IndianRupee`                                        |
| Add                   | `Plus`                                         | More / overflow         | `Ellipsis`                                           |
| Search                | `Search`                                       | Filters                 | `ListFilter`                                         |
| Upload / download     | `Upload` / `Download`                          | Edit / delete / archive | `Pencil` / `Trash2` / `Archive`                      |
| Date                  | `Calendar`                                     | Location / station      | `MapPin`                                             |
| Secure vault          | `Lock`, `ShieldCheck`                          | Loan / EMI              | `Landmark`                                           |

The module icons are defined in `apps/web/src/app/modules.ts`. That file is the single source; import them from there for nav-like uses.

## Imagery

- **Vehicle photos** are the hero imagery. Preferred: a front three-quarter angle with a clean or dark background. Always `object-cover` inside a fixed aspect ratio (see `spacing-and-layout.md`), `loading="lazy"` below the fold, and `alt="<Make> <Model>"`.
- **No photo:** use the `VehicleImage` fallback. It is a plain `bg-elevated` panel (no glow), a large muted `Car` icon at `strokeWidth={1}`, and the make and model as a small `text-xs` label. Never use a cartoon, a stock photo of a different car, or a broken-image icon.
- Text over a photo always sits on the photo scrim. It is never placed directly on the image.
- Receipts and documents are shown as documents (thumbnail plus file-type badge), never stretched or cropped to fill.
- **No illustrations** (cartoon, isometric, 3D blobs). Empty states use a Lucide icon plus copy.

## Voice and microcopy

The voice is that of a precise, calm co-pilot. Short, factual and helpful.

- Lead with the fact, then the action: "Insurance expires in 106 days · Renew by 13/03/2027".
- Buttons are verb plus object: "Add fuel entry", "Save vehicle", "Mark as completed", "Export CSV". Never "Submit", "OK" or "Click here".
- Errors say what happened and what to do: "Couldn't save the fuel entry. Check your connection and try again." Never blame the user, and never show raw codes or stack traces.
- Empty states are encouraging, not cute: "No fuel entries yet. Add your first fill-up to start tracking mileage."
- Use no exclamation marks except in onboarding completion (one, at most), no emoji, no slang, no ALL CAPS sentences.
- Address the user as "you". No greetings: the dashboard h1 is "Dashboard" with the date, the login title is "Log in", and the global search placeholder is just "Search".
- Recorded figures say where they come from: "From 12 full-tank fills"; rule-based insights say "rules, not AI".
