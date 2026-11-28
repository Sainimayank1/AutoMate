---
name: automate-design
description: AutoMate's visual identity and UI/UX design system. Covers the premium, dark-first automotive cockpit look, colour/typography/spacing tokens, the app shell and navigation, component standards, screen guidelines for all 11 modules (Dashboard, Garage, Fuel, Expenses, Maintenance, Documents, Trips, Analytics, Notifications, Settings, Backup) plus auth and onboarding, Indian localisation, canonical sample data and a design review checklist. Use for ANY frontend work in apps/web, such as building or changing a screen, page, layout, component, chart, form, dialog, empty/loading/error state, theme or style. Includes the Stitch-first rule: build every screen from its Stitch design (project "AutoMate Design System Platform"), and generate the screen in Stitch first when it doesn't exist. Also use when reviewing UI for design consistency.
---

# AutoMate Design System

AutoMate is a **premium vehicle-ownership companion**, not a CRUD admin panel. Every screen should feel like part of one product, somewhere between a luxury car's digital cockpit and a high-end fintech app. The direction is **premium, futuristic, sophisticated and minimal**: graphite surfaces, a single ice-blue accent, hairline borders, precise tabular numbers and calm motion.

This skill tells you how things should look and behave. **The Stitch project is the visual source of truth** (see below). `docs/MODULES.md` says _what_ each module does. `docs/architecture/frontend.md` says _how the code is organised_.

## Stitch: design first, then build

The approved designs live in the Stitch project **"AutoMate Design System Platform"** (`projects/4873202931996632861`), whose design system is **"AutoMate Cockpit"** (`assets/canvas_node_node_14159650301022119993`). The app's tokens in `index.css` are the Stitch tokens, so a Stitch screen translates almost one-to-one into our primitives.

**Reading** works through the Stitch MCP tools (deferred; load them with ToolSearch `select:mcp__stitch__list_screens,mcp__stitch__get_screen,mcp__stitch__download_file`). **Writing doesn't:** this is a web-canvas project (`DESIGN_V2`). For it, MCP `generate_screen_from_text` returns an id but never places the screen on the canvas: the id then 404s, and the screen uses a different design system at 2560 px. `edit_screens` can't find canvas screens at all. Create and edit screens through the **Stitch web app's chat** on the project canvas (https://stitch.google.com/projects/4873202931996632861), which applies the AutoMate tokens and 1280 / 390 px sizes.

**Before building or changing any screen:**

1. **Find it.** Run `list_screens` with project id `4873202931996632861`. Screens come in pairs, "<Screen> — Desktop" (1280 px) and "<Screen> — Mobile" (390 px). Desktop/mobile pairs exist for most modules (Dashboard, Login, Register, Garage, Vehicle Details, Add Vehicle steps 1–5, Edit Vehicle, Expenses, Fuel, Maintenance, Documents, Trips, Analytics & TCO, Settings, Notifications) plus dialogs and empty states; `list_screens` is the current list.
2. **If it exists,** `download_file` its `htmlCode.name` and build from it: the same layout, hierarchy, copy and states, translated to our primitives and tokens (`dark-surface-container-low` → `bg-card`; the full mapping is in `references/color-system.md`). Big screens overflow the tool output and are saved to a file; extract the parts you need from it.
3. **If the flow needs a screen that doesn't exist** (a new page, dialog, sheet, wizard step, or an empty, error or success state), **create it in Stitch first, then build from it:**
   - In the Stitch web app chat for this project (use the browser tools, or ask the user to run it if you have no browser access), ask for the screen by exact title, "<Screen> — Desktop" (1280 px) and "<Screen> — Mobile" (390 px), "using the AutoMate design system and the existing app shell".
   - Put the relevant data in the prompt:
     - the requirements from `docs/MODULES.md`;
     - the fields and validation from the shared Zod schema in `packages/shared`;
     - every state (loading, empty, error, success, disabled-with-reason);
     - Indian formats and the canonical sample data from `references/localization-and-sample-data.md`;
     - what's out of scope (for example "no Google or OTP sign-in").
   - Generation takes a few minutes. When it's done, confirm the screen with `list_screens` (it must appear there) and read it with `download_file`.
   - Review the result against this skill (accent budget, status colours, truthful data). Fix problems through the same chat, so the design and the code don't drift.
   - If a screen can't be created (no browser, Stitch down), say so to the user, build from the closest existing screens plus this skill, and list the screen as "to design" in the PR so it gets created and compared later.
4. **Allowed deviations from a Stitch screen** are limited to:
   - removing controls for features that aren't built ("Forgot password?", social sign-in);
   - accessibility fixes;
   - removing copy that makes claims we can't verify;
   - replacing external images with tokens.

   Note each one in the component's doc comment.

## Non-negotiables

These apply to every UI change. The references explain the details.

1. **Tokens only.** Use semantic classes (`bg-card`, `text-muted-foreground`, `bg-primary`, `text-warning`, `bg-elevated`, `text-insight`…). Never use hex/rgb values, `[#…]` arbitrary colours or Tailwind palette classes (`bg-zinc-900`, `text-cyan-400`) in components. → `references/color-system.md`
2. **Dark-first.** Design and check the dark theme first. Then check the light theme, which must keep the same hierarchy.
3. **One accent.** Ice blue (`primary`) marks the primary action, the active nav item, selection, focus and the focus chart series. Keep it to roughly 5–10% of any screen. Teal (`insight`) is only for AI and insight content.
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
2. **Get the Stitch screen** (desktop and mobile), or generate it if it doesn't exist. See "Stitch: design first, then build".
3. **Inventory.** List `apps/web/src/components/{ui,common,feedback,layout}` and the module's `features/<id>/components`. Reuse what is there. A new shared component goes in `components/common` only when a second module needs it.
4. **Load the references the task needs** (see the map below). Don't load all of them for a small change.
5. **Build.** Use tokens, primitives, format helpers and all the states. Use feature hooks for data; components never call the API.
6. **Verify.** Compare with the Stitch screen side by side, then check dark and light themes at 360 / 768 / 1280 px (and 390 / 1440 for key screens). Use the keyboard only once. Run the grep checks and walk `references/design-review-checklist.md`. If any answer is "no", fix it before calling the task done.

## Reference map

| Task                                                               | Read                                                                                     |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Any new screen or module                                           | `module-design-guidelines.md`, `visual-design-language.md`, `design-review-checklist.md` |
| Colours, themes, status colours, charts palette                    | `color-system.md`                                                                        |
| Text styles, metric/number display                                 | `typography.md`                                                                          |
| Page frame, grids, forms, tables, radius, elevation, z-index       | `spacing-and-layout.md`                                                                  |
| Building or choosing a component                                   | `component-guidelines.md`                                                                |
| Sidebar, header, bottom nav, vehicle selector, search, breadcrumbs | `application-navigation.md`                                                              |
| Mobile and tablet behaviour                                        | `responsive-design.md`                                                                   |
| States, flows, dialogs, toasts, motion, filters                    | `interaction-patterns.md`                                                                |
| Logo, wordmark, app icon, iconography, imagery, microcopy          | `brand-identity.md`                                                                      |
| Formats, units, sample vehicles and figures                        | `localization-and-sample-data.md`                                                        |
| Keyboard, contrast, ARIA, charts a11y                              | `accessibility.md`                                                                       |
| Before finishing any UI task                                       | `design-review-checklist.md`                                                             |

All paths are relative to `.claude/skills/automate-design/references/`.

## Precedence

- **Behaviour and data rules:** `docs/MODULES.md` and the root `CLAUDE.md` win.
- **Look and feel:** the Stitch project wins, then this skill. If they disagree, follow Stitch and update this skill in the same change.
- **Implemented conventions:** `docs/architecture/design-system.md` records what the code does today. If it disagrees with this skill (for example the palette), the task that implements the skill's version must update that doc in the same change, so the two never drift.

## Where the code doesn't match the spec yet

Apply each item the first time a task touches that area, in the same change, and update `docs/architecture/design-system.md` with it:

| Gap                                             | Current                             | Target                                                                                              | Where                                     |
| ----------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Missing primitives                              | none                                | `drawer` (vaul), `command` (cmdk), `scroll-area` (`chart`, `progress`, `toggle-group` are done)     | Add with the shadcn CLI when first needed |
| Auth: forgot/reset password, email verification | not built (needs an email provider) | Generate the Stitch screens, then build them in `features/auth` (see `module-design-guidelines.md`) | `features/auth`, `apps/api` auth module   |

Done already: the mobile bottom nav with the quick-add sheet (and the header's "+" menu), `formatCurrencyCompact` on money chart axes, the `chart` primitive (Fuel), the Stitch palette and fonts, the radius, the `elevated`/`insight`/`brand` tokens, `hero-glow`, dark as the default theme, the Stitch nav groups, the logo and favicon, and the sign-in and registration screens.
