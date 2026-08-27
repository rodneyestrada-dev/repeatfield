# Repeatfield Reflection + Orange Production UI Implementation Plan

> **For Hermes:** Execute this approved plan with strict TDD, responsive QA, and independent fail-closed review. Rodney explicitly approved production implementation on 2026-08-28.

**Goal:** Add per-cell reflection and curated Repeat presets to Field Tile, then move the approved standalone orange design-system direction into the production React app without changing the three-workflow architecture or browser-local privacy model.

**Architecture:** Extend each metatile cell from a quarter-turn scalar to an explicit transform containing `rotation`, `flipX`, and `flipY`, with migration/normalization for existing state. Keep lattice placement (`Straight`, `Brick`, `Half-Drop`) separate from cell orientation/reflection. Apply orange visual tokens and shared radius tokens through production CSS/components, using original SVG/CSS marks only.

**Tech Stack:** React, TypeScript, Vite, Canvas 2D, Vitest, Testing Library, Playwright.

---

## Locked product decisions

- Product name remains **Repeatfield**.
- Exactly three top-level workflows remain isolated: Field Tile, Tile Set, Tessellate.
- `Tile Turn` controls Repeat Block cell transforms; `Field Layout` controls block placement.
- Rosette/radial behavior stays under Advanced Symmetry.
- Do not add Adobe-style `Blend Borders` or independent Expand Left/Right/Up/Down controls.
- Do not claim blurred seams are seamless.
- Source artwork remains browser-local and project-scoped.
- Apply the approved orange foundation and polished component system to production, not just the standalone HTML.

## Approved production design direction

- Foundation colors: Pattern Orange `#FF8C17`, Orange Wash `#FFD4A8`, Field Sky `#A9CFFF`, Turn Lilac `#B9A7EF`, Edge Apricot `#FFC7A1`; no Infill Mint.
- Primary CTA: vivid orange-led gradient, white text, pill radius, no underline.
- Secondary CTA: white background, neutral ink, pill radius.
- Shared radius scale: controls/pills; small `12px`; medium `20px`; cards `30px`; sections `42px`.
- Repeatfield logo/favicon: original cream square with opposite orange quarter arcs using 50% radius.
- Workflow illustrations use orange: Field Tile all `#FFD4A8`; Tile Set row-major roles—field 4/5/7/8 light, edge 1/2/6/9 medium, corner 3 dark; Tessellate unified two-lobe orange silhouette with downward wedge and no outline.
- Hero/entry surface: orange foundation gradient with lighter blue/lilac/apricot, minute grain, no pointer-reactive color movement.
- Hero tile animation is decorative only: random 1-tile or diagonal 2-tile quarter turns, never adjacent simultaneous turns; smooth 2.1s rotation with quickening only at start; reduced-motion and pause support.
- Do not migrate builder notes or design-system documentation into public UI.

## Task 1 — Metatile transform model (TDD)

**Files:**
- Modify: `src/engine/metatile.ts`
- Modify: `src/app/state.ts`
- Test: existing metatile/state test files

1. Write failing tests for a cell transform `{ rotation, flipX, flipY }` and normalization of old scalar quarter-turn cells.
2. Verify RED with targeted Vitest commands.
3. Implement transform helpers: rotate cell, reflect X/Y, rotate whole block while preserving reflection semantics, normalize legacy snapshots.
4. Verify GREEN and refactor.
5. Ensure undo/redo snapshots preserve reflection flags.

## Task 2 — Renderer support (TDD)

**Files:**
- Modify: `src/engine/renderer.ts`
- Test: renderer/metatile tests

1. Write failing real-canvas or deterministic transform tests proving per-cell H/V reflection affects only the selected cell.
2. Implement `ctx.rotate` plus `ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1)` in Repeat Block rendering.
3. Verify aligned legacy rendering remains unchanged.
4. Verify exports and previews use the same renderer.

## Task 3 — Curated Repeat presets and UI (TDD)

**Files:**
- Modify: `src/engine/metatilePresets.ts`
- Modify: `src/app/FieldTileEditor.tsx`
- Modify: reducer actions/types in `src/app/state.ts`
- Test: component/reducer/preset tests

Presets:
- Repeat: Aligned, Alternating Rows, Alternating Columns
- Turn: Checker 90° CW, Checker 90° CCW, Checker 180°, Pinwheel, Inward Corners, Outward Corners
- Reflect: Checker Reflect H, Checker Reflect V, Unfold, Mirror Grid
- Generate: Random Turn, Random Turn + Reflect

Cell UI:
- Click rotates CW; Shift-click rotates CCW (retain current fast path).
- Add accessible per-cell Reflect H, Reflect V, Reset controls without overcrowding.
- Whole-block CW/CCW and reset remain.
- ARIA labels expose rotation and reflection state.

Do not add Checker Flip 45° in this release.

## Task 4 — Production design-system adoption

**Files:**
- Modify: `src/styles.css`
- Modify: entry/workflow components in `src/app/App.tsx` and supporting components as needed
- Add original local SVG assets under `public/` or `src/assets/` with base-path-safe references
- Test: component/E2E visual invariants

1. Introduce approved color/radius/shadow tokens.
2. Apply shared pill CTA treatment and card radii consistently.
3. Add Repeatfield logo/favicon with base-path-safe loading.
4. Restyle the production entry screen using the approved foundation gradient and minute grain.
5. Add the approved three orange workflow illustrations and exact Tile Set role map.
6. Keep all production workspaces legible in light/dark presentations; hero/entry artwork itself stays stable where intended.
7. Preserve direct-manipulation controls and all workflow behavior.
8. Preserve no-horizontal-overflow at `390×844`.

## Task 5 — Tests and verification

Run, without output-masking pipes:

```bash
npm run test:run
npm run build
npm run test:e2e
npm run lint --if-present
npx tsc --noEmit
```

Required checks:
- Legacy project hydration/migration.
- Per-cell H/V reflection and whole-block rotation.
- Each curated preset has exact transforms.
- Random generator uses only valid transforms.
- Export pixels differ for reflected versus unreflected asymmetric source.
- Three workflows remain isolated.
- IndexedDB assets remain project-scoped and deleted on replacement/close.
- Mobile `390×844` and desktop `1440×1024` have zero horizontal overflow.
- Light/dark readability and reduced motion.
- Git diff check and production bundle success.

## Task 6 — Independent fail-closed review

Provide the reviewer the complete diff and acceptance criteria. Block release on:
- privacy regressions;
- state migration/data-loss issues;
- reflection/export mismatch;
- broken workflow isolation;
- inaccessible controls;
- responsive overflow;
- misleading seamlessness claims;
- public builder notes.

Fix blockers with tests and rerun the full suite.

## Task 7 — Commit, deploy, and live verify

1. Commit only after review passes.
2. Build and copy verified output into `public-release` following the existing release workflow.
3. Push production and release repositories only after all tests pass.
4. Verify live with a cache-busted URL.
5. Confirm entry screen, each workflow, reflection controls, and export on live deployment.
