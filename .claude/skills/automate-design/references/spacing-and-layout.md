# Spacing, Layout, Elevation

## Spacing scale

Use Tailwind's 4 px scale and only these steps: `0.5 1 1.5 2 3 4 5 6 8 10 12 16`. Never use arbitrary pixel values (`p-[18px]`, `gap-[22px]`).

| Purpose                                        | Value                                                                    |
| ---------------------------------------------- | ------------------------------------------------------------------------ |
| Icon ↔ label, inline controls                  | `gap-1.5`–`gap-2`                                                        |
| Label ↔ value in a metric, title ↔ description | `gap-0.5`–`gap-1`                                                        |
| Items in a stack, list rows, form fields       | `gap-3`–`gap-5`                                                          |
| Cards in a grid                                | `gap-3 md:gap-4`                                                         |
| Section header ↔ its content                   | `gap-3 md:gap-4`                                                         |
| Between page sections                          | `gap-6` (from `PageContainer`); `gap-8` only between a hero and the rest |

## Page frame

- Every routed page renders `<PageContainer>`: `max-w-7xl` (1280 px), `px-4 md:px-6 lg:px-8`, `py-6`, `gap-6`. Pages never add their own outer padding or max-width.
- **Full-bleed exception:** a document/PDF preview may use `max-w-none`; its reading column keeps `max-w-3xl` centred.
- The order is always: `PageHeader` → optional filter or tab row → content sections.

## Grid recipes

| Layout                    | Classes                                                                                                        |
| ------------------------- | -------------------------------------------------------------------------------------------------------------- |
| KPI row                   | `grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4` (2×2 on mobile, never 1 column of 4 tall cards)               |
| Main + aside              | `grid gap-6 lg:grid-cols-12` with `lg:col-span-8` / `lg:col-span-4`; the aside stacks below on smaller screens |
| Even split                | `grid gap-4 md:grid-cols-2`                                                                                    |
| Vehicle or document cards | `grid gap-4 sm:grid-cols-2 xl:grid-cols-3`                                                                     |
| Settings                  | `grid gap-6 md:grid-cols-[12rem_1fr]` (section nav + content); the nav becomes a `Select` or tabs on mobile    |
| Detail page               | Hero (full width) → `Tabs` → tab content using the main + aside layout                                         |

Vary layouts by purpose (list-detail, timeline, calendar, vault grid, conversation). Don't make every page the same "4 stat cards and a table".

## Cards and panels

- Use `Card` with its default spacing (`--card-spacing`). Don't override padding per card. Compact tiles inside a card use `rounded-lg bg-elevated p-3`.
- One level of nesting at most: a card may contain `bg-elevated` tiles, never another `Card`.
- Don't wrap a whole page or a lone table in an extra card. `DataTable` brings its own container.
- Cards stretch to row height (`h-full`) so rows align.

## Forms

- Single column, `max-w-2xl`, using shadcn `Field`/`FieldGroup` through `FormField`.
- Two-column pairs only on `md+` and only for short related fields (Quantity | Price per litre, Date | Time): `grid gap-4 md:grid-cols-2`.
- Group long forms into titled `FieldSet`s (Basic details, Ownership…), with `gap-8` between sets.
- Actions sit at the end, right-aligned, secondary then primary (`Cancel` `Save fuel entry`). On mobile, use a sticky bottom bar with the full-width primary and the secondary as a ghost button above it or in the header.
- In dialogs or sheets, actions go in `DialogFooter` / `SheetFooter`.

## Tables and lists

- `DataTable` rows are about 44 px (`h-11`), the header row is `text-xs font-medium text-muted-foreground`, and numeric columns are right-aligned.
- The row-actions column is the last one, `w-10`, holding an `Ellipsis` icon button that opens a `DropdownMenu`. The whole row is clickable to open details.
- Mobile list rows: `min-h-14 px-4 py-3`, separated with `divide-y divide-border`, primary text left and value right.

## Dialog and sheet widths

| Use                          | Size                                         |
| ---------------------------- | -------------------------------------------- |
| Confirmation                 | `sm:max-w-sm`                                |
| Simple form (≤ 6 fields)     | `sm:max-w-lg`                                |
| Complex form, import mapping | `sm:max-w-2xl`                               |
| Detail side panel (desktop)  | `Sheet side="right"` with `sm:max-w-md`      |
| Mobile                       | Bottom `Drawer` (see `responsive-design.md`) |

## Fixed dimensions

| Element            | Size                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------ |
| App header         | `h-14` on phones, `md:h-16` (Stitch 64 px), sticky                                   |
| Sidebar            | 16rem expanded, 3rem icon-collapsed (shadcn constants)                               |
| Mobile bottom nav  | `h-16` plus `pb-[env(safe-area-inset-bottom)]`                                       |
| Chart body         | `h-56 md:h-72`, fixed so there is no layout shift                                    |
| Vehicle hero image | `aspect-[16/9]` mobile, `aspect-[21/9]` desktop hero; card thumbnails `aspect-[4/3]` |
| Touch targets      | ≥ 40 px on phones (`size-10 md:size-8` icon buttons)                                 |

## Radius

Stitch's "precision-machined" radii (`--radius: 0.5rem`): `rounded-sm` 4 px for nested tiles and chips, `rounded-lg` 8 px for buttons, inputs and small controls (the primitives' default), `rounded-xl` 12 px for cards, popovers and dialogs, `rounded-2xl` 16 px for the vehicle hero image only.

- Never use `rounded-3xl` or larger on containers.
- `rounded-full` is only for avatars, dots, switches and status indicators. Badges keep the primitive's `rounded-md` (not pills); `PlateBadge` is `rounded-sm`.
- Images inside cards clip to the card (`overflow-hidden`) and don't add their own radius.

## Elevation

| Level | Surface                   | Separation                                                         | Examples                                                   |
| ----- | ------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------- |
| 0     | `bg-background`           | none                                                               | Canvas                                                     |
| 1     | `bg-card` / `bg-sidebar`  | 1 px hairline (`ring-1 ring-foreground/10` from Card, or `border`) | Cards, tables, sidebar                                     |
| 2     | `bg-elevated`             | none or hairline                                                   | Tiles inside cards, selected row, hover on clickable cards |
| 3     | `bg-popover`              | `shadow-lg` from the primitive                                     | Menus, popovers, command palette, toasts                   |
| 4     | `bg-popover` plus overlay | Primitive overlay (`bg-black/60`, no blur) and shadow              | Dialog, sheet, drawer                                      |

No shadows on cards in either theme. Hover on a clickable card shifts the surface (`hover:bg-elevated`) and optionally the border (`hover:ring-foreground/20`). It never lifts with a shadow or `translate-y`.

## Z-index

Only these layers. Never use `z-[999]`.

| Layer                                                              | Class                           |
| ------------------------------------------------------------------ | ------------------------------- |
| Content, sticky table header                                       | `z-0` / `z-10`                  |
| App header, sidebar                                                | `z-10` (existing)               |
| Mobile bottom nav, sticky form action bar, FAB                     | `z-20`                          |
| Overlays (Radix dialog, sheet, popover, dropdown, drawer, tooltip) | `z-50`, from the primitives     |
| Toasts                                                             | Sonner default (above overlays) |
