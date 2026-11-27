# Design Review Checklist

Run this before calling any UI task done. If any answer is **no**, fix it first, or tell the user explicitly what was left and why.

## 1. The twelve questions

1. Does it match the AutoMate brand (graphite surfaces, one cyan accent, Geist, Lucide, gauge motifs)?
2. Does it feel premium and futuristic, not like a generic admin template?
3. Is the visual hierarchy clear, with one hero element and subordinate instruments?
4. Is the layout uncluttered, without a wall of identical cards?
5. Are colours consistent: tokens only, the status mapping followed, teal only for AI?
6. Are typography and spacing consistent with the scales?
7. Were existing components reused, with no duplicates?
8. Is it responsive at 360 / 768 / 1280 px with no horizontal scroll?
9. Are loading, empty, error, success, disabled and confirmation states all handled?
10. Are all interactions understandable (clear labels, feedback, reversible where possible)?
11. Does the screen look commercially launchable?
12. Does it feel like part of the same product as the other screens?

## 2. Concrete checks

**Tokens and styling**
- [ ] No hex/rgb/oklch literals, `[#…]` colours or Tailwind palette classes in `features/` and `components/` (outside `components/ui`).
- [ ] At most one `default` (cyan) button per region; destructive styling only in confirmations or the danger zone.
- [ ] Gradients, glow and blur only from the allowed list in `visual-design-language.md`; at most one `hero-glow` per screen.
- [ ] No card shadows, no `rounded-3xl`, no card-in-card.

**Typography and numbers**
- [ ] One `h1` (`PageHeader`); sections use `SectionHeader`.
- [ ] Every number is formatted via `utils/format.ts`, has `tabular-nums` where aligned, and numeric columns are right-aligned.
- [ ] Units, ₹, DD/MM/YYYY and Indian grouping are correct; Indian English spelling is used.

**Data truthfulness**
- [ ] Mileage is never shown from incomplete full-tank sequences; gaps are explained.
- [ ] Operating cost, loan principal and cash outflow are separated and labelled; principal is not in cost per km.
- [ ] Linked records (fuel → expense, service → expense) show their origin and aren't duplicated.
- [ ] AI advice is visually distinct from recorded data.
- [ ] Sample data matches `localization-and-sample-data.md` (same odometer, figures and plates).
- [ ] No business calculations in components: values come from the API or shared code.

**Layout and responsiveness**
- [ ] `PageContainer` + `PageHeader` are used, with no custom page padding.
- [ ] Mobile: tables become lists, dialogs become drawers, the primary action is reachable by thumb, and the bottom nav doesn't cover content.
- [ ] Touch targets are ≥ 40 px; inputs are 16 px on mobile with the correct `inputMode`.
- [ ] Both dark and light themes have been checked.

**States and interactions**
- [ ] Skeletons match the layout; first-use vs filtered empty states are distinguished.
- [ ] Errors are scoped with retry; mutations give toast feedback; destructive actions confirm and name their linked effects.
- [ ] Forms have prefilled defaults, inline validation, an unsaved-changes guard and a pending state.

**Accessibility**
- [ ] Keyboard-only pass done; visible focus everywhere; icon buttons labelled.
- [ ] Status uses icon + text; charts have a summary and a table alternative.
- [ ] `motion-safe:` on non-essential animation.

**Code hygiene**
- [ ] Shared primitives come from `components/ui`; new shared components only when a second module needs them.
- [ ] No new dependency without a reason stated to the user; planned packages from `docs/TECH_STACK.md` are preferred.
- [ ] If the change implements a target from SKILL.md's spec-gap table, `docs/architecture/design-system.md` is updated too.

## 3. Grep checks

Run from the repo root. Any hits outside `components/ui/` need a justification.

```bash
# Hardcoded colours and Tailwind palette classes
grep -rnE "#[0-9a-fA-F]{3,8}\b|rgba?\(|oklch\(|\b(bg|text|border|ring|fill|stroke|from|to|via)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}\b|\b(bg|text)-(white|black)\b" apps/web/src --include='*.tsx' | grep -v components/ui/

# Inline number/date formatting that bypasses utils/format.ts
grep -rnE "toFixed\(|toLocaleString\(|new Intl\.|toLocaleDateString\(" apps/web/src --include='*.tsx' | grep -v components/ui/

# Arbitrary sizes, radii and z-indexes
grep -rnE "\b(text|p[xytrbl]?|m[xytrbl]?|gap|w|h)-\[[0-9]+px\]|rounded-(3xl|\[)|z-\[" apps/web/src --include='*.tsx' | grep -v components/ui/
```

## 4. Visual check

Open the screen in the running app (the `run` skill or `pnpm --filter @automate/web dev`) at 360 px and 1280 px in dark mode, then light. Compare it side by side with an existing finished screen. If it looks like it came from a different product, it isn't done.
