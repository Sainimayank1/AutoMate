# Brand Identity

## Positioning

> **AutoMate**: the intelligent ownership companion that knows your car, understands your driving, and helps you take better care of it.

AutoMate is a premium vehicle-ownership platform, not an expense tracker. The brand is a knowledgeable, discreet co-pilot. It is confident and precise, and never loud or cute.

## Name

- Always write **AutoMate**: capital A, capital M, one word. Never "Automate", "Auto Mate", "AUTOMATE" or "Auto-Mate".
- The AI feature is "AutoMate Assistant" in marketing contexts and "AI Assistant" in navigation.

## Logo mark: the gauge

An open speedometer arc with a single needle and hub. It reads as automotive (a gauge) and as technology (a precise instrument), and doubles as a stylised "A" silhouette. It is never a car silhouette.

Canonical SVG (32×32 grid). The arc and hub use `currentColor`; the needle uses the brand accent:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" role="img" aria-label="AutoMate">
  <path d="M8.22 23.78A11 11 0 1 1 23.78 23.78" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M16 16 21.14 9.87" stroke="var(--primary)" stroke-width="2.5" stroke-linecap="round"/>
  <circle cx="16" cy="16" r="2.25" fill="currentColor"/>
</svg>
```

Construction: the arc is centred at (16,16) with r = 11, spans 270° and is open at the bottom. The needle runs 8 units at −50° (pointing up and to the right, "performing well"). The stroke is 2.5 on a 32 grid. Keep these proportions at every size.

**Logo component.** Create it once as `components/layout/brand-logo.tsx`, exporting `<BrandMark className />` and `<BrandLogo collapsed? />` (mark plus wordmark). Never paste the SVG into pages.

| Rule | Spec |
| --- | --- |
| Clear space | At least 25% of the mark's height on all sides |
| Minimum size | 16 px (favicon), 20 px in UI, 24 px in the sidebar header |
| Colours | Arc and hub `text-foreground`, needle `primary`. Monochrome version: all `currentColor` (for embossed or print use). |
| Don't | Recolour the arc cyan, add gradients, glow, shadows or outlines, rotate the needle per context, place it on a busy photo, or animate it beyond a single needle sweep on the splash screen |

## Wordmark

- "AutoMate" in Geist, weight 600, `tracking-tight`, `text-foreground`, all one colour. Don't two-tone it.
- **Lockup:** the mark to the left of the wordmark, gap `gap-2`, mark height about 1.4× the wordmark cap height. Sidebar: mark `size-6` + wordmark `text-base font-semibold`.
- When the sidebar is icon-collapsed, show the mark only. On auth pages, use the lockup at mark `size-8` + `text-xl`.

## App icon and favicon

- **App icon** (PWA/OS, 512 px master): a full-bleed `#0b0d10` square (the OS applies its own mask), a subtle top radial glow (the hero-glow recipe), and the mark centred at 56% width with the arc in `#f2f3f5` and the needle in `#50d9ef`. This is the one place literal colours are allowed, because icons are static assets.
- **Favicon** (`apps/web/public/favicon.svg`): the same mark on a `rx="8"` rounded square:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#0b0d10"/><path d="M8.22 23.78A11 11 0 1 1 23.78 23.78" fill="none" stroke="#f2f3f5" stroke-width="2.5" stroke-linecap="round"/><path d="M16 16 21.14 9.87" stroke="#50d9ef" stroke-width="2.5" stroke-linecap="round"/><circle cx="16" cy="16" r="2.25" fill="#f2f3f5"/></svg>
```

## Brand colours

The full system is in `color-system.md`. The brand-level summary:

| Name | Role | Dark value |
| --- | --- | --- |
| Midnight | Canvas | `#0b0d10` |
| Graphite | Surfaces | `#121519` → `#22262b` |
| Electric cyan | Signal and brand accent | `#50d9ef` |
| Muted teal | Intelligence and AI | `#66ccba` |
| Silver | Metallic neutral (chart "Other", subtle hardware details) | `#b9bec6` |

## Iconography

- **Lucide only** (`lucide-react`). Don't mix icon sets, use emoji as icons, or use filled icon variants.
- Sizes: `size-4` (16 px) is the default in buttons, menus, nav and inline text. Use `size-5` for mobile bottom nav and empty-state media, and `size-6` with `strokeWidth={1.5}` for large decorative contexts (empty states, onboarding).
- Colour: `text-muted-foreground` by default. Use `text-foreground` when the icon is the content, `text-primary` for the active nav item only, and status tokens only inside status badges.
- Icon-only buttons always have an `aria-label` and a `Tooltip` on desktop. Decorative icons get `aria-hidden`.
- **Canonical icons.** Never use two different icons for the same concept.

| Concept | Icon | Concept | Icon |
| --- | --- | --- | --- |
| Dashboard | `LayoutDashboard` | Garage / vehicle | `Car` (`CarFront` in the brand-adjacent empty state) |
| Fuel | `Fuel` | Expenses | `ReceiptIndianRupee` |
| Maintenance / service | `Wrench` | Documents | `FileText` |
| Trips | `Map` (`Route` for a single trip) | Analytics | `ChartNoAxesCombined` |
| AI Assistant | `Bot`; AI-generated content uses `Sparkles` | Notifications | `Bell` |
| Settings | `Settings` | Backup & Export | `DatabaseBackup` |
| Odometer / health | `Gauge` | Money (generic) | `IndianRupee` |
| Add | `Plus` | More / overflow | `Ellipsis` |
| Search | `Search` | Filters | `ListFilter` |
| Upload / download | `Upload` / `Download` | Edit / delete / archive | `Pencil` / `Trash2` / `Archive` |
| Date | `Calendar` | Location / station | `MapPin` |
| Secure vault | `Lock`, `ShieldCheck` | Loan / EMI | `Landmark` |

The module icons are defined in `apps/web/src/app/modules.ts`. That file is the single source; import them from there for nav-like uses.

## Imagery

- **Vehicle photos** are the hero imagery. Preferred: a front three-quarter angle with a clean or dark background. Always `object-cover` inside a fixed aspect ratio (see `spacing-and-layout.md`), `loading="lazy"` below the fold, and `alt="<Make> <Model>"`.
- **No photo:** use the `VehicleImage` fallback. It is a `bg-elevated` panel with `hero-glow`, a large muted `Car` icon at `strokeWidth={1}`, and the make and model in an overline. Never use a cartoon, a stock photo of a different car, or a broken-image icon.
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
- Address the user as "you". Use their first name in the dashboard greeting only: "Good morning, Aarav" (morning < 12:00, afternoon < 17:00, otherwise evening).
- AI copy is clearly attributed: "Suggested by AutoMate AI". Recorded figures say where they come from: "From 6 full-tank fills".
