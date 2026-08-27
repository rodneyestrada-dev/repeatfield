# Repeatfield Tile Turn and Field Layout Implementation Plan

> **Planning status — Plan 2, no build:** Do not implement this plan yet. Merge it with the deferred Crop redesign and any subsequent Repeatfield plan discussions, reconcile the combined information architecture, and build only after Rodney explicitly approves the consolidated scope.

> **For Hermes:** When implementation is approved, use subagent-driven-development and strict RED→GREEN TDD task-by-task.

**Goal:** Make per-tile orientation inside a small repeat block the primary creative operation in Repeat, while preserving Straight, Brick, Half-Drop, Mirror, and other existing field systems as separate downstream layout or symmetry features.

**Architecture:** Introduce a first-class 2×2 `Tile Turn` that stores one transform state per tile cell and produces a reusable `Repeat Block` (internally: metatile). Render that block first, then feed it into an independent `Field Layout` layer that controls lattice placement such as straight, brick, and half-drop. Move procedural mirror/kaleidoscope systems into a third, clearly labelled advanced symmetry layer rather than mixing all transformations in one preset row.

**Tech Stack:** React, TypeScript, native Canvas 2D, Vitest, Testing Library, Playwright. No implementation or deployment in this planning pass.

> **Superseding product decision (2026-08-27):** This plan belongs only to the standalone **Field Tile** workflow. It must not expose Field/Edge/Corner role switching or Tessellate controls.

---

## 1. Terminology decision

### Recommended public feature name: **Tile Turn**

Suggested UI copy:

```text
TILE TURN
Rotate each tile to build a repeat block.
```

### Name of the 2×2 result: **Repeat Block**

Suggested UI copy:

```text
2 × 2 REPEAT BLOCK
Click a tile to rotate it. Shift-click rotates backward.
```

### Internal/technical term: **metatile**

Use `metatile` in TypeScript types, geometry, tests, and documentation where precision helps. Avoid making users learn the term before they can use the tool.

### Mathematical/design family: **Truchet-style orientation tiling**

The supplied references show the defining idea of Truchet tiling: a decorated square tile without full rotational symmetry is placed on a square grid, and each cell’s orientation creates different larger structures.

Do not label the entire product feature “Truchet” because:

- users may upload tiles outside canonical Truchet motifs;
- the operation is understandable as orientation composition without historical terminology;
- “Tile Turn” explains the action, while Truchet belongs in help/documentation.

### Names rejected for the primary label

- `Pattern` — too broad; currently causes the information-architecture problem.
- `Rotation Matrix` — technically descriptive but unnecessarily formal.
- `Metatile Builder` — precise but unfamiliar to many users.
- `Tile Pattern` — does not distinguish internal orientation from field placement.

---

## Candidate demo tile — reference only pending rights clearance

**Candidate reference:**
`/Users/rodneyestrada/Library/Application Support/Hermes/composer-images/composer_2026-08-27_08-06-38-145_1578e7.jpg`

**Planning decision:** Use this image to define the desired demo behavior and visual contrast, but do not copy it into `public/`, the repository, screenshots, exports, or the public website until its source and license are verified.

The asset is a 1179×744 JPEG screenshot with no embedded author, source URL, or copyright metadata. The visible `1/7` carousel marker indicates it is likely a capture from another publication/account rather than a clean original supplied by its creator.

### Rights gate

Before implementation, satisfy one of these:

1. Obtain written permission or a license covering public product-demo use; or
2. Locate an authoritative source that clearly publishes the exact artwork under a compatible open license; or
3. Replace it with an independently created Repeatfield demo tile based only on general Truchet/geometric principles.

### Recommended safe path

Create an original Repeatfield-owned demo tile from first principles. Preserve only the general idea—an asymmetric square tile with edge-crossing paths that creates new motifs when rotated—while changing the expressive composition:

- connection topology and edge-contact positions;
- number and placement of internal paths;
- line widths and corner treatment;
- proportions and negative-space structure;
- color palette;
- exact rotational outcomes.

Record the source file, creation date, author, and intended license in `README.md` or an asset manifest. Do not trace or make a near-identical redraw of this screenshot.

### Legal posture for planning

- The general Truchet method and ordinary geometric primitives are ideas/building blocks, not exclusive to this screenshot.
- The exact selection and arrangement may qualify as copyrightable applied/ornamental art depending on originality and jurisdiction.
- The screenshot or product photograph may have separate copyright even if the underlying design has thin protection.
- A design patent or Philippine industrial-design registration cannot be confirmed or ruled out from appearance alone; source/designer/manufacturer identification is required for a meaningful registry search.
- Until cleared, label the asset internally as `reference-only / rights unknown`, not `demo tile`.

---

## 2. Reference-image interpretation

The reference sequence contains:

1. one asymmetric square source tile;
2. the same tile repeated without orientation changes;
3. fields where individual tiles use 0°, 90°, 180°, or 270° rotations;
4. larger stars, knots, cages, and interlocking motifs emerging from small orientation rules;
5. patterns that visually appear to repeat from a 2×2 or related small orientation block.

The existing Repeat preset strip currently mixes three different concepts:

| Current option | Actual operation |
|---|---|
| Straight Repeat | Field/lattice placement |
| Half-Drop | Field/lattice placement |
| Brick | Field/lattice placement |
| Checker Rotate | Per-cell orientation rule |
| Mirror Grid | Per-cell reflection/orientation rule |
| Quarter-Turn Rosette | Procedural 2×2 orientation/symmetry rule |
| Triangle Kaleidoscope | Advanced symmetry generator |
| Radial Kaleidoscope | Advanced symmetry generator |

This mixing makes every card look like the same kind of “pattern,” even though they operate at different levels.

---

## 3. Combinatorics and product scope

Assumption for v1 Tile Turn:

- repeat block size: 2×2;
- four cells;
- each cell may use 0°, 90°, 180°, or 270°;
- no per-cell reflection in the initial version.

### Raw orientation assignments

```text
4 choices per cell × 4 cells = 4⁴ = 256 assignments
```

### Visually canonical assignments under whole-block rotation

If rotating the complete 2×2 block by 90°, 180°, or 270° is considered the same design family, exact enumeration gives:

```text
70 canonical orientation patterns
```

Burnside fixed counts used by the enumeration:

```text
identity: 256
90°:        4
180°:      16
270°:       4
(256 + 4 + 16 + 4) / 4 = 70
```

### Simpler relative-orientation codes

Fixing the first cell at 0° leaves:

```text
4³ = 64 relative orientation codes
```

This is useful for generation or browsing, but it is not exactly the same equivalence rule as rotating the entire spatial 2×2 block. Do not present `64 unique patterns` without explaining that normalization.

### Product recommendation

- The manual composer should allow all **256 raw assignments**.
- A future `Explore unique blocks` browser may show the **70 canonical blocks** after rotational deduplication.
- Do not add reflections initially. If reflection is later allowed per cell, the state space changes substantially and needs a separate design decision.

---

## 4. Revised Repeat information architecture

### Primary layer: Tile Turn

Controls the transform of individual tile instances inside the smallest Repeat Block.

```text
┌───────────────┐
│ 0°      90°   │
│               │
│ 270°    180°  │
└───────────────┘
```

The exact values above are an example, not the default.

### Secondary layer: Field Layout

Controls how the completed Repeat Block is positioned across the output field.

Initial layouts:

- Straight
- Brick
- Half-Drop

Possible later layouts:

- Column drop
- Diagonal offset
- Custom X/Y offset

### Tertiary layer: Symmetry Systems

Preserves advanced existing features without confusing them with ordinary placement:

- Mirror Grid
- Quarter-Turn Rosette preset
- Triangle Kaleidoscope
- Radial Kaleidoscope

`Checker Rotate` should become either:

- a Tile Turn preset, or
- a generated 2×2 Repeat Block.

It should no longer live beside Brick as though they are the same operation.

### Resulting pipeline

```text
RECTIFIED TILE
      ↓
TILE TURN
(per-cell transforms)
      ↓
2×2 REPEAT BLOCK / METATILE
      ↓
FIELD LAYOUT
(straight, brick, half-drop)
      ↓
OPTIONAL SYMMETRY SYSTEM
      ↓
FIELD OUTPUT
```

The optional symmetry stage may wrap the tile or Repeat Block depending on the system. That distinction must be explicit in renderer contracts rather than inferred from a preset ID.

---

## 5. Tile Turn interaction design

### 5.1 Core 2×2 editor

The composer displays four live tile cells.

Each cell supports:

- click: rotate clockwise by 90°;
- Shift-click or secondary control: rotate counter-clockwise by 90°;
- keyboard Enter/Space: rotate clockwise;
- keyboard shortcut while a cell is selected: `R` clockwise, `Shift+R` counter-clockwise;
- direct orientation menu: 0°, 90°, 180°, 270°;
- selected-cell focus ring;
- visible orientation marker that does not rely only on the artwork.

Use small corner arrows or angle labels that can be hidden in the final field preview.

### 5.2 Whole-block controls

- Rotate entire block clockwise
- Rotate entire block counter-clockwise
- Reset all cells to 0°
- Randomize
- Shuffle among canonical blocks (future/optional)
- Save current block as a named custom preset (defer unless specifically approved)

### 5.3 Presets

Provide a small curated row of 2×2 orientation presets generated by the same state model:

- All aligned
- Checker turn
- Pinwheel / quarter-turn
- Inward corners
- Outward corners
- Alternating rows
- Alternating columns

These are not special rendering modes. Selecting one simply writes four orientation values into the composer. Users can then modify any cell.

### 5.4 Repeat Block preview

Show both:

- the editable 2×2 block with controls;
- a larger live field preview showing what repeating that block produces.

The main field remains dominant. The composer should behave like a compact control surface, not consume the entire workspace.

### 5.5 Seam-aware feedback

Orientation changes affect edge continuity. Optional non-blocking feedback:

- show cell boundaries;
- emphasize the outer Repeat Block boundary;
- toggle edge/seam guides;
- identify that the Repeat Block itself is what repeats.

Do not claim a seam is mathematically valid unless actual edge analysis exists.

---

## 6. State model

### Task 1: Introduce explicit metatile state

**Objective:** Store per-cell orientation independently from field layout and advanced symmetry.

**Files:**
- Modify: `src/app/state.ts`
- Modify: `src/app/state.test.ts`
- Modify: `src/engine/patterns.ts`
- Modify: `src/engine/patterns.test.ts`

**Proposed types:**

```ts
type QuarterTurn = 0 | 1 | 2 | 3;

type MetatileSize = 2;

interface MetatileCell {
  rotation: QuarterTurn;
}

interface MetatileState {
  size: MetatileSize;
  cells: readonly [
    MetatileCell,
    MetatileCell,
    MetatileCell,
    MetatileCell,
  ];
}

type FieldLayoutId = "straight" | "brick" | "half-drop";

type SymmetrySystemId =
  | "none"
  | "mirror-grid"
  | "triangle-kaleidoscope"
  | "radial-kaleidoscope";
```

Do not keep `patternId` as one union combining all three layers.

**TDD steps:**

1. Add failing tests for default 2×2 metatile state.
2. Add failing tests for rotating one cell without changing the others.
3. Add failing tests for whole-block rotation.
4. Add failing tests for reset/randomize with deterministic injected RNG.
5. Add failing migration tests from current `patternId` presets.
6. Implement minimal reducer/state.
7. Run focused state tests.

**Commit:** `refactor: separate metatile orientation from field layout`

### Task 2: Add canonical orientation helpers

**Objective:** Represent, rotate, compare, and enumerate orientation blocks predictably.

**Files:**
- Create: `src/engine/metatile.ts`
- Create: `src/engine/metatile.test.ts`

**Functions:**

```ts
rotateCell(turn: QuarterTurn, delta: 1 | -1): QuarterTurn
rotateMetatile(block: MetatileState, delta: 1 | -1): MetatileState
metatileCode(block: MetatileState): string
canonicalRotationCode(block: MetatileState): string
enumerateMetatiles(): MetatileState[]
enumerateCanonicalMetatiles(): MetatileState[]
```

**TDD acceptance:**

- raw enumeration count is exactly 256;
- canonical whole-block-rotation count is exactly 70;
- every raw block maps to one canonical code;
- whole-block rotation preserves the canonical code;
- cell order is documented as top-left, top-right, bottom-right, bottom-left or row-major; choose one and use it everywhere. Recommended row-major: TL, TR, BL, BR for UI clarity.

**Commit:** `feat: add metatile orientation algebra`

---

## 7. Renderer pipeline

### Task 3: Render a 2×2 Repeat Block first

**Objective:** Produce a reusable offscreen Canvas containing four independently rotated copies of the rectified tile.

**Files:**
- Modify: `src/engine/renderer.ts`
- Create or modify: `src/engine/renderer.test.ts`

**Renderer contract:**

```ts
renderMetatile(
  sourceTile: CanvasImageSource,
  metatile: MetatileState,
  cellSize: number,
): HTMLCanvasElement
```

The function must:

- preserve transparency;
- rotate each cell around its own center;
- avoid clipping from incorrect transform order;
- produce exact 2×2 dimensions;
- be deterministic.

**TDD steps:**

1. Create an asymmetric test fixture whose four rotations have distinct pixel signatures.
2. Render four known orientations.
3. Assert each quadrant has the expected signature.
4. Assert alpha survives.
5. Implement minimal Canvas transforms.

**Commit:** `feat: render orientation repeat blocks`

### Task 4: Apply Field Layout to the Repeat Block

**Objective:** Make Straight, Brick, and Half-Drop position complete Repeat Blocks rather than raw individual tiles.

**Files:**
- Modify: `src/engine/geometry.ts`
- Modify: `src/engine/geometry.test.ts`
- Modify: `src/engine/renderer.ts`

**Rules:**

- Straight: Repeat Blocks on an orthogonal lattice.
- Brick: odd Repeat Block rows offset by half a Repeat Block width.
- Half-Drop: odd Repeat Block columns offset by half a Repeat Block height.

Clarify that the offset applies to the 2×2 block, not to individual tile cells.

**TDD steps:**

1. Add layout-coordinate tests using Repeat Block dimensions.
2. Assert Brick and Half-Drop offsets use metatile size.
3. Assert changing layout does not mutate cell orientations.
4. Implement layout stage.

**Commit:** `feat: position repeat blocks with field layouts`

### Task 5: Isolate Symmetry Systems

**Objective:** Preserve advanced transformations without mixing them into basic layout IDs.

**Files:**
- Modify: `src/engine/patterns.ts`
- Modify: `src/engine/renderer.ts`
- Modify: corresponding tests

Decide and document input scope per system:

| Symmetry system | Recommended input |
|---|---|
| None | Repeat Block |
| Mirror Grid | Repeat Block |
| Quarter-Turn Rosette | Orientation preset first; avoid duplicate special renderer if possible |
| Triangle Kaleidoscope | Rectified source tile or Repeat Block, explicitly selectable later |
| Radial Kaleidoscope | Rectified source tile or Repeat Block, explicitly selectable later |

For the first implementation, keep existing kaleidoscope behavior but place it under Advanced. Do not expand its scope until a later plan resolves source-vs-metatile input.

**Commit:** `refactor: isolate advanced symmetry systems`

---

## 8. Repeat workspace UI

### Task 6: Replace the mixed preset row with layered controls

**Objective:** Make orientation composition primary and layout selection secondary.

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/styles.css`
- Modify: `src/app/App.test.tsx`
- Modify: `e2e/app.spec.ts`

**Recommended desktop structure:**

```text
┌ Tile Turn ┐  ┌──────────────────────── Field ─────────────────────┐  ┌ Inspector ┐
│ editable 2×2 block   │  │                                                     │  │ Layout    │
│ orientation presets  │  │                 large live output                   │  │ Scale     │
│ rotate/reset/random  │  │                                                     │  │ Gap       │
└──────────────────────┘  └─────────────────────────────────────────────────────┘  │ Advanced  │
                                                                                  └───────────┘
```

Alternative if horizontal space is limited:

- Tile Turn in the left rail;
- Field Layout as a concise segmented row above the main canvas;
- Advanced Symmetry collapsed in the right inspector.

Remove numeric preset ordering because these are not sequential steps.

**TDD steps:**

1. Add failing test for four independently labelled metatile cells.
2. Add failing test for separate Orientation, Layout, and Advanced sections.
3. Assert Straight/Brick/Half-Drop appear only under Field Layout.
4. Assert existing mixed preset strip is gone.
5. Implement layered UI.

**Commit:** `feat: introduce orientation-first repeat workspace`

### Task 7: Add direct cell rotation interaction

**Objective:** Let users discover patterns by rotating one tile at a time.

**Files:**
- Create recommended: `src/app/TileTurn.tsx`
- Create: `src/app/TileTurn.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/styles.css`
- Modify: `e2e/app.spec.ts`

**TDD steps:**

1. Click TL cell and assert only TL rotates 90°.
2. Click twice and assert 180°.
3. Shift-click and assert reverse rotation.
4. Keyboard-test Enter/Space and optional `R` shortcut.
5. Assert live field canvas changes after one cell rotates.
6. Assert Undo restores the prior complete Repeat state.
7. Implement interaction and accessibility.

**Commit:** `feat: rotate individual repeat-block tiles`

### Task 8: Convert applicable existing presets into metatile presets

**Objective:** Preserve useful outcomes while making them editable.

**Files:**
- Create or modify: `src/engine/metatilePresets.ts`
- Create: `src/engine/metatilePresets.test.ts`
- Modify: `src/app/TileTurn.tsx`

Candidate presets:

```text
Aligned       [0,0,0,0]
Checker       [0,2,2,0]
Quarter-turn  [0,1,3,2] or renderer-equivalent verified visually
Rows          [0,0,2,2]
Columns       [0,2,0,2]
```

Exact codes must be confirmed against screenshots and cell order; do not trust names alone.

Each preset should populate normal editable state. No preset may lock the cells.

**Commit:** `feat: add editable orientation presets`

---

## 9. Undo/Redo integration

### Task 9: Include metatile and layout in Repeat history

**Objective:** Keep existing Undo/Redo behavior correct after splitting Repeat into layers.

**Files:**
- Modify: `src/app/state.ts`
- Modify: `src/app/state.test.ts`
- Modify: `e2e/app.spec.ts`

A Repeat history snapshot must include:

- metatile cell orientations;
- field layout;
- symmetry system;
- scale, gap, field rotation, segments, guides, and background.

**TDD steps:**

1. Rotate one cell; Undo restores it.
2. Change layout; Undo restores prior layout without changing cells unexpectedly.
3. Perform cell change → layout change → symmetry change; verify ordered Undo/Redo.
4. New cell change after Undo clears Redo.
5. Input-focus shortcut protections remain intact.

**Commit:** `fix: include orientation composition in repeat history`

---

## 10. Explore mode — defer or phase carefully

The 256/70 combinatorial space suggests a future discovery browser, but it should not overload the first composer.

### Recommended Phase 1

- manual 2×2 composer;
- 5–8 curated orientation presets;
- randomize;
- Straight/Brick/Half-Drop layouts;
- existing advanced systems retained separately.

### Possible Phase 2: Explore Unique Blocks

- canonical set of 70 orientation blocks;
- visual thumbnail grid generated from uploaded tile;
- filters by rotational symmetry or edge behavior;
- favorite/save blocks;
- “show rotations as one family” toggle.

Do not build all 70 thumbnails until performance is measured with realistic high-resolution tiles.

---

## 11. Responsive design

### Desktop: 1440×1024

Verify:

- Tile Turn is visible without making the field secondary;
- all four cells are at least 72×72 visually, while controls retain ≥44×44 hit targets;
- Layout and Advanced are visually separate;
- no old mixed preset carousel remains;
- no horizontal document overflow;
- Undo/Redo remain reachable.

### Mobile: 390×844

Recommended hierarchy:

1. main field preview;
2. compact 2×2 Tile Turn;
3. Field Layout segmented controls;
4. inspector disclosures;
5. Advanced collapsed by default.

The 2×2 composer should remain fully visible without horizontal scrolling. Do not turn it into four tiny thumbnail buttons.

---

## 12. Verification scenarios

### Scenario A: Single-cell change

1. Load asymmetric demo tile.
2. Begin from `[0,0,0,0]`.
3. Rotate only top-right to 90°.
4. Verify the 2×2 block changes in one quadrant.
5. Verify the full field changes.
6. Undo and verify exact restoration.

### Scenario B: Same block, different layouts

1. Build a custom four-orientation block.
2. Select Straight.
3. Record output.
4. Select Brick.
5. Verify metatile cells remain unchanged while field placement changes.
6. Select Half-Drop and verify the same invariant.

### Scenario C: Preset remains editable

1. Apply Quarter-turn preset.
2. Rotate one cell.
3. Verify the state becomes a custom block rather than snapping back.

### Scenario D: Canonical enumeration

1. Enumerate 256 raw blocks.
2. Canonicalize under whole-block rotation.
3. Assert exactly 70 canonical codes.
4. Verify all raw blocks map into the canonical set.

### Scenario E: Downstream output

1. Crop/warp a tile.
2. Compose a custom Repeat Block.
3. Apply Brick layout.
4. Preview and export.
5. Verify exported PNG matches the field and preserves transparency.

---

## 13. Files likely to change

### Existing

- `src/app/App.tsx`
- `src/app/App.test.tsx`
- `src/app/state.ts`
- `src/app/state.test.ts`
- `src/engine/patterns.ts`
- `src/engine/patterns.test.ts`
- `src/engine/geometry.ts`
- `src/engine/geometry.test.ts`
- `src/engine/renderer.ts`
- `src/styles.css`
- `e2e/app.spec.ts`
- `scripts/verify-ui.mjs`
- `README.md`

### Recommended new files

- `src/engine/metatile.ts`
- `src/engine/metatile.test.ts`
- `src/engine/metatilePresets.ts`
- `src/engine/metatilePresets.test.ts`
- `src/app/TileTurn.tsx`
- `src/app/TileTurn.test.tsx`

---

## 14. Risks and open design decisions

1. **What is the repeating unit?** The plan assumes the completed 2×2 block is repeated as one unit. Individual-tile Brick/Half-Drop would be a different model.
2. **Whole-block rotation equivalence:** 70 is correct when complete-block rotations are treated as the same family. The UI should not say “70 unique” without that definition.
3. **Tile symmetry:** Some uploaded tiles may look identical at 180° or 90°. The theoretical 256 assignments may collapse visually for symmetric tiles. Do not promise 256 visibly distinct outputs for every source.
4. **Reflections:** Excluded from initial Tile Turn. Mirror remains an Advanced system until a later plan decides on per-cell reflection.
5. **Quarter-turn duplication:** Current Quarter-Turn Rosette likely becomes an editable metatile preset. Verify its exact cell code before removing the special renderer.
6. **Kaleidoscope input:** Whether kaleidoscopes consume the source tile or full metatile remains deferred; keep current behavior during the first refactor.
7. **Thumbnail performance:** Live rendering 70 or 256 uploaded-image thumbnails may be expensive. Keep Explore mode phased.
8. **Naming consistency:** Use `Tile Turn` for the feature, `Repeat Block` for the user-visible result, `metatile` internally, and `Field Layout` for Straight/Brick/Half-Drop.

---

## 15. Consolidation with Plan 1

Before implementation, merge this plan with:

`/Users/rodneyestrada/repeatfield/.hermes/plans/2026-08-27_151312-crop-workspace-designer-tools.md`

Cross-plan UI principles:

- one persistent workspace per major step;
- icon-based designer controls where appropriate;
- contextual options rather than page replacement;
- central artwork remains dominant;
- no numeric labels for independent tools;
- downstream rendering uses one consistent source of truth;
- no deployment until combined local visual approval.

The combined build order should be:

1. shared state/renderer contracts;
2. Crop redesign and rectified-source contract;
3. metatile/orientation algebra;
4. Repeat renderer layering;
5. Repeat UI redesign;
6. integrated Undo/Redo;
7. Preview/export verification;
8. responsive QA;
9. local visual approval;
10. public release.

---

## 16. Final acceptance checklist

- [ ] The feature is named Tile Turn.
- [ ] The 2×2 output is called Repeat Block in the UI.
- [ ] Technical docs/types use metatile where useful.
- [ ] Four cells rotate independently in 90° increments.
- [ ] Manual composer supports all 256 raw assignments.
- [ ] Canonical enumeration returns 70 blocks under whole-block rotation.
- [ ] Straight, Brick, and Half-Drop are separated under Field Layout.
- [ ] Checker Rotate becomes an editable orientation preset.
- [ ] Mirror and kaleidoscopes live under Advanced Symmetry.
- [ ] Changing layout never mutates cell orientations.
- [ ] Presets populate editable normal state.
- [ ] Undo/Redo includes orientation and layout changes.
- [ ] The same Repeat Block feeds field preview, Preview, and PNG export.
- [ ] Desktop and mobile preserve the field as the dominant visual.
- [ ] Plan 2 is not built until consolidated with later planning notes and explicitly approved.
