# Responsive Design

AutoMate is **mobile-first**: most fill-ups are logged on a phone at the pump. Design the phone layout deliberately; don't just squeeze the desktop. Desktop adds density and side-by-side context.

## Target widths

| Device      | Widths to verify | Tailwind range                       |
| ----------- | ---------------- | ------------------------------------ |
| Small phone | 360 px           | base                                 |
| Phone       | 390 px           | base                                 |
| Tablet      | 768 px           | `md`                                 |
| Laptop      | 1280 px          | `xl`                                 |
| Desktop     | 1440 px          | `xl` (content capped by `max-w-7xl`) |

Breakpoints are Tailwind defaults: `sm` 640, `md` 768, `lg` 1024, `xl` 1280.

- `md` is the shell switch: drawer and bottom nav below it, docked sidebar at and above it. `useIsMobile()` uses the same breakpoint.
- Use `useIsMobile()` only when the component tree itself must differ (Dialog vs Drawer). Prefer CSS breakpoints for everything else.

## Pattern transforms

| Desktop                                  | Mobile (< md)                                                                                                                                                                    |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Docked collapsible sidebar               | Off-canvas drawer (via "More") + bottom nav                                                                                                                                      |
| Breadcrumbs                              | Back button + page title in the header                                                                                                                                           |
| Header search field (⌘K)                 | Search icon → full-screen command palette                                                                                                                                        |
| PageHeader actions (primary + secondary) | Primary moves to the bottom nav "Add" or a sticky bottom bar; secondary goes into the header overflow `Ellipsis`                                                                 |
| `DataTable`                              | List rows (title + meta left, value right); tap → detail. Wide tables never scroll the page; if a table must stay tabular, it scrolls inside its own `overflow-x-auto` container |
| Multi-column forms                       | Single column; sticky bottom action bar                                                                                                                                          |
| `Dialog` forms and details               | Bottom `Drawer` (`ResponsiveDialog`), max 90 dvh, with a drag handle                                                                                                             |
| Right `Sheet` detail panel               | Full-screen route or bottom Drawer                                                                                                                                               |
| Filter row                               | Search + "Filters (n)" button → filter Drawer                                                                                                                                    |
| Tabs (many)                              | Horizontally scrollable `TabsList`, active tab scrolled into view; for 6+ sections in Settings, a list of sections that push to sub-pages                                        |
| Main + aside grid                        | Stacked: main first, aside after, unless the aside is urgent (Dashboard Attention moves directly under the hero)                                                                 |
| KPI row of 4                             | 2×2 grid with compact values (`text-xl`)                                                                                                                                         |
| Charts                                   | Full width, `h-56`, fewer x-ticks (`interval="preserveStartEnd"`), legend moved below, tooltips on tap                                                                           |
| Calendar month grid                      | Agenda list grouped by week                                                                                                                                                      |
| Hover actions on rows                    | Visible overflow button, or swipe actions (Notifications)                                                                                                                        |

## Mobile ergonomics

- **Touch targets:** ≥ 40 px (`size-10 md:size-8`), and ≥ 48 px for bottom nav and quick-add tiles. Keep ≥ 8 px between adjacent targets.
- **Thumb zone:** primary actions sit at the bottom (bottom nav "Add", sticky form bar). Destructive actions are never in the thumb zone next to primary ones.
- **Inputs:** 16 px text (the primitive does `text-base md:text-sm`) to avoid iOS zoom. Use the right `inputMode` (`decimal`, `numeric`, `email`, `tel`), `autoComplete` attributes and `enterKeyHint`.
- **Safe areas:** the bottom nav and sticky bars get `pb-[env(safe-area-inset-bottom)]`. Full-height layouts use `min-h-dvh`/`h-dvh`, never `100vh`.
- **Keyboard:** when the keyboard is open, sticky bars sit above it (the Drawer handles this). Hide the bottom nav on form routes.
- **Images:** serve appropriately sized vehicle photos (`srcset` once R2 storage exists). Use `loading="lazy"` below the fold.

## Preventing horizontal overflow

- Flex children holding text get `min-w-0`. Text uses `truncate` or `break-words`. Long tokens (VIN, policy number, email) use `break-all` in detail views.
- Grids use `minmax(0,1fr)` (Tailwind `grid-cols-*` already does) and never fixed pixel widths.
- Never use fixed widths over `w-full` on mobile, except icons and thumbs. Wide content (tables, code, previews) scrolls inside its own container.
- `SidebarInset` already has `min-w-0`. Keep it.
- Check every screen at 360 px for horizontal scroll by scrolling sideways, or with `document.documentElement.scrollWidth > innerWidth` in the console.

## Tablet (768–1023 px)

- The sidebar is docked but starts icon-collapsed when space is tight (the user's toggle is respected).
- KPI rows can use 4 columns if values fit. Otherwise 2×2.
- Forms stay single column with `max-w-2xl`. Dialogs (not drawers) are used from `md`.

## Verifying

For each new or changed screen, check 360, 768 and 1280 px in both themes (and 390 and 1440 for primary screens: Dashboard, Garage, Fuel, Expenses). Use the in-browser device toolbar, or the `run` / `browser-testing-with-devtools` skills when available.
