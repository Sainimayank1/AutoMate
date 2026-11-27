---
name: automate-design
description: AutoMate's visual identity and UI/UX design system. Covers the premium, dark-first automotive cockpit look, colour/typography/spacing tokens, the app shell and navigation, component standards, screen guidelines for all 12 modules (Dashboard, Garage, Fuel, Expenses, Maintenance, Documents, Trips, Analytics, AI Assistant, Notifications, Settings, Backup) plus auth and onboarding, Indian localisation, canonical sample data and a design review checklist. Use for ANY frontend work in apps/web, such as building or changing a screen, page, layout, component, chart, form, dialog, empty/loading/error state, theme or style. Also use when reviewing UI for design consistency.
---

# AutoMate Design System

AutoMate is a **premium vehicle-ownership companion**, not a CRUD admin panel. Every screen should feel like part of one product, somewhere between a luxury car's digital cockpit and a high-end fintech app. The direction is **premium, futuristic, sophisticated and minimal**: graphite surfaces, a single electric-cyan accent, hairline borders, precise tabular numbers and calm motion.

This skill tells you how things should look and behave. `docs/MODULES.md` says *what* each module does. `docs/architecture/frontend.md` says *how the code is organised*.

## Non-negotiables

These apply to every UI change. The references explain the details.

1. **Tokens only.** Use semantic classes (`bg-card`, `text-muted-foreground`, `bg-primary`, `text-warning`, `bg-elevated`, `text-insight`…). Never use hex/rgb values, `[#…]` arbitrary colours or Tailwind palette classes (`bg-zinc-900`, `text-cyan-400`) in components. → `references/color-system.md`
2. **Dark-first.** Design and check the dark theme first. Then check the light theme, which must keep the same hierarchy.
3. **One accent.** Cyan (`primary`) marks the primary action, the active nav item, selection, focus and the focus chart series. Keep it to roughly 5–10% of any screen. Teal (`insight`) is only for AI and insight content.
4. **Reuse before you build.** Check `components/ui` (shadcn), `components/common`, `components/feedback` and `components/layout` first. Never hand-roll a button, dialog, menu, tabs, popover, tooltip or sheet. If a shadcn primitive is missing, add it with `pnpm dlx shadcn@latest add <name>` in `apps/web`. → `references/component-guidelines.md`
5. **One shell.** Every module uses `AppShell` (sidebar, header and the mobile bottom nav). Modules never get their own header, sidebar or palette. → `references/application-navigation.md`
6. **Numbers come from the API and are formatted with `utils/format.ts`.** Use `formatCurrency`, `formatDistance`, `formatVolume`, `formatEfficiency`, `formatDate` and the others. Add `tabular-nums` wherever figures line up. Never compute mileage, costs or due status in a component.
7. **Truthful data.** Never show a mileage figure the full-tank sequence can't support. Always separate operating cost, loan principal and cash outflow. Always label AI advice separately from recorded data. → `references/module-design-guidelines.md`
8. **Every screen has every state.** That means loading (a skeleton shaped like the content), empty (first-use or filtered), error (with retry), success feedback, disabled-with-reason and confirmation for destructive actions. → `references/interaction-patterns.md`
9. **Genuinely responsive.** Lay out deliberately for 360, 390, 768, 1280 and 1440 px. Tables become lists, dialogs become bottom sheets, and there is no horizontal page scroll. → `references/responsive-design.md`
10. **Restraint.** Gradients, glow and glass appear only where `references/visual-design-language.md` allows them. No emoji, clipart, rainbow categories, oversized radii or grids of identical cards.
11. **Indian locale.** Use ₹ with Indian grouping (₹1,25,000.00), km, L, km/L and DD/MM/YYYY, with Indian English spelling (kilometres, litres, licence, tyres). Mockups use the canonical sample data. → `references/localization-and-sample-data.md`
12. **Never downgrade.** When you extend a screen, keep its existing premium patterns. Don't replace them with generic ones.

## Workflow for any UI task

1. **Understand the job.** Read the module's section in `docs/MODULES.md` and in `references/module-design-guidelines.md`.
2. **Inventory.** List `apps/web/src/components/{ui,common,feedback,layout}` and the module's `features/<id>/components`. Reuse what is there. A new shared component goes in `components/common` only when a second module needs it.
3. **Load the references the task needs** (see the map below). Don't load all of them for a small change.
4. **Build.** Use tokens, primitives, format helpers and all the states. Use feature hooks for data; components never call the API.
5. **Verify.** Check dark and light themes at 360 / 768 / 1280 px (and 390 / 1440 for key screens). Use the keyboard only once. Run the grep checks and walk `references/design-review-checklist.md`. If any answer is "no", fix it before calling the task done.

## Reference map

| Task | Read |
| --- | --- |
| Any new screen or module | `module-design-guidelines.md`, `visual-design-language.md`, `design-review-checklist.md` |
| Colours, themes, status colours, charts palette | `color-system.md` |
| Text styles, metric/number display | `typography.md` |
| Page frame, grids, forms, tables, radius, elevation, z-index | `spacing-and-layout.md` |
| Building or choosing a component | `component-guidelines.md` |
| Sidebar, header, bottom nav, vehicle selector, search, breadcrumbs | `application-navigation.md` |
| Mobile and tablet behaviour | `responsive-design.md` |
| States, flows, dialogs, toasts, motion, filters | `interaction-patterns.md` |
| Logo, wordmark, app icon, iconography, imagery, microcopy | `brand-identity.md` |
| Formats, units, sample vehicles and figures | `localization-and-sample-data.md` |
| Keyboard, contrast, ARIA, charts a11y | `accessibility.md` |
| Before finishing any UI task | `design-review-checklist.md` |

All paths are relative to `.claude/skills/automate-design/references/`.

## Precedence

- **Behaviour and data rules:** `docs/MODULES.md` and the root `CLAUDE.md` win.
- **Look and feel:** this skill wins.
- **Implemented conventions:** `docs/architecture/design-system.md` records what the code does today. If it disagrees with this skill (for example the palette), the task that implements the skill's version must update that doc in the same change, so the two never drift.

## Where the code doesn't match the spec yet

Apply each item the first time a task touches that area, in the same change, and update `docs/architecture/design-system.md` with it:

| Gap | Current | Target | Where |
| --- | --- | --- | --- |
| Palette | shadcn neutral, near-black primary | Graphite surfaces and a cyan primary, as in the CSS block in `color-system.md` | `apps/web/src/styles/index.css` |
| New tokens | none | `elevated`, `insight`, `chart-1…5` palette, `hero-glow` / `edge-highlight` utilities | same file |
| Default theme | `system` | `dark` (the user can still pick light or system) | `app/providers/app-providers.tsx` and the fallback in `index.html` |
| Nav groups | overview / vehicle / insights / account | Overview / My vehicles / Management / Intelligence / Personal | `NAV_GROUP_LABELS` and `navGroup` in `app/modules.ts` |
| Mobile bottom nav | none; phones only get the sidebar drawer | `BottomNav` + `QuickAddSheet` as specified in `application-navigation.md` | new `components/layout/bottom-nav.tsx`, rendered in `AppShell` |
| Favicon | car clipart | Gauge mark | `apps/web/public/favicon.svg` (SVG in `brand-identity.md`) |
| Missing primitives | none | `chart` (Recharts), `drawer` (vaul), `command` (cmdk), `progress`, `toggle-group`, `scroll-area` | Add with the shadcn CLI when first needed |
| Compact currency | none | `formatCurrencyCompact` (₹1.2L, ₹45K) for chart axes | `utils/format.ts`, with a test |
