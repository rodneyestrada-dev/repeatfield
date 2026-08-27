# Repeatfield Three Distinct Edit Workflows Implementation Plan

> **Planning status — canonical information architecture, no build:** This document supersedes any earlier hierarchy that nests Tessellate inside Field or Tile Set. Do not implement until Rodney explicitly approves a consolidated build plan.

> **For Hermes:** When approved, use subagent-driven-development and strict RED→GREEN TDD.

**Goal:** Structure Repeatfield around three unmistakably separate editing workflows: Field Tile, Tile Set, and Tessellate.

**Architecture:** Introduce a top-level workflow discriminator when a pattern project is created. Each workflow owns its editor sequence, project state, terminology, validation, and export rules. Shared image-processing and rendering primitives may be reused internally, but no workflow should appear as a mode or role inside another workflow.

**Tech Stack:** React, TypeScript, Canvas 2D/SVG overlays, Vitest, Testing Library, Playwright. Browser-local only. No code or deployment in this planning pass.

---

## 1. Canonical product model

Repeatfield initially supports exactly three editing workflows:

```text
NEW PATTERN
├── FIELD TILE
├── TILE SET
└── TESSELLATE
```

The selection is not a cosmetic preset. It determines:

- which files/assets the project expects;
- which Crop tools and role controls appear;
- which Repeat/composition engine runs;
- which validation rules define success;
- which preview and export controls appear;
- which terminology is used throughout the interface.

Do not place these choices in a single crowded editor sidebar. The user chooses one before entering an editing workspace.

---

## 2. Workflow 1 — Field Tile

### Purpose

Create a conventional repeating field from one square tile.

### Intake

- One Field Tile image.
- Intended for a square or rectified-to-square source.

### Editing sequence

```text
Upload
→ Crop / Perspective Warp / Background correction
→ Tile Turn
→ Field Layout
→ optional Advanced Symmetry
→ Preview
→ Export
```

### Core tools

- square crop and perspective correction;
- Tile Turn and 2×2 Repeat Block;
- Straight, Brick, and Half-Drop Field Layout;
- optional mirror/kaleidoscope systems;
- seam and repeat preview.

### Must not show

- Field/Edge/Corner role switcher;
- Primary/Infill controls;
- contour coverage heatmap;
- Tessellate Repeat Cell vectors.

### Success condition

A single square Field Tile renders correctly through its chosen orientation and layout rules.

---

## 3. Workflow 2 — Tile Set

### Purpose

Create one coordinated square-tile installation from three positional tile roles.

### Public role names

```text
Field · Edge · Corner
```

- **Field** — fills the interior.
- **Edge** — forms the perimeter run.
- **Corner** — turns the Edge through 90°.

Use **Edge** in the interface. `border` may remain an internal property name or industry term.

### Intake

- One Field Tile image;
- one Edge Tile image;
- one Corner Tile image;
- or extraction of those three assets from one source sheet.

### Editing sequence

```text
Choose/Extract Field + Edge + Corner
→ edit each role independently
→ apply shared Set Look
→ configure Field / Edge Run / Corner Join
→ Set Preview
→ continuity checks
→ Export
```

### Core tools

- persistent role selector: Field, Edge, Corner;
- role-specific Crop, Warp, mask, rotation, and fine correction;
- shared non-destructive Set Look;
- Field composition controls;
- Edge Run controls;
- Corner Join controls;
- Field↔Edge and Edge↔Corner diagnostics;
- framed Set Preview.

### Must not show

- Tessellate Primary/Infill terminology;
- irregular contour snapping;
- gap/overlap plane-coverage heatmap;
- arbitrary U/V Repeat Cell construction.

### Success condition

All three square roles read as one coordinated set, and their field-edge-corner joins are visibly coherent.

---

## 4. Workflow 3 — Tessellate

### Purpose

Arrange one or more transparent irregular/non-square Shape Tiles into a gap-free, overlap-free repeating system or a finite medallion.

### Intake

- One irregular Primary shape;
- optional Infill/companion shape;
- transparent PNG or image requiring background removal.

### Editing sequence

```text
Upload
→ Remove Background
→ Extract/Clean Contour
→ add Primary + optional Infill
→ Assemble Repeat Cell or Medallion
→ Coverage Check
→ Preview
→ Export
```

### Core tools

- alpha/background removal;
- contour extraction and cleanup;
- Primary and optional Infill assets;
- drag, rotate, reflect, duplicate;
- contour snapping;
- U/V Repeat Cell definition;
- gap and overlap diagnostics;
- Touching versus Grout;
- Field versus Medallion output.

### Must not show

- Tile Turn;
- Straight/Brick/Half-Drop from the square workflow;
- Field/Edge/Corner installation roles;
- Set Look or Corner Join unless separately designed in a future scope.

### Success condition

For Field output, repeated neighboring cells meet the selected tolerance for gaps and overlaps. For Medallion output, the finite cluster exports with the intended transparent outer silhouette.

---

## 5. Entry experience

Recommended top-level selection screen:

```text
WHAT ARE YOU MAKING?

[ FIELD TILE ]
One square tile repeated across a surface.

[ TILE SET ]
A coordinated Field, Edge, and Corner set.

[ TESSELLATE ]
Irregular transparent shapes fitted together.
```

Each option should include a small visual diagram rather than relying only on text.

### Selection behavior

- A new project stores its chosen workflow immediately.
- The editor header always shows the active workflow name.
- `Back to workflow selection` is available before meaningful edits.
- After meaningful edits, changing workflow requires an explicit conversion action.
- Never silently switch workflows because an image is transparent or non-square.
- The app may suggest another workflow, but the user must accept it.

---

## 6. Project-state boundary

Recommended top-level discriminator:

```ts
type WorkflowKind = "field-tile" | "tile-set" | "tessellate";

type PatternProject =
  | FieldTileProject
  | TileSetProject
  | TessellateProject;
```

Each project type stores only its relevant high-level state.

```ts
interface FieldTileProject {
  workflow: "field-tile";
  fieldAsset: TileAsset;
  tileTurn: TileTurnState;
  fieldLayout: FieldLayoutState;
}

interface TileSetProject {
  workflow: "tile-set";
  roles: {
    field: TileAsset;
    border: TileAsset; // Public label: Edge
    corner: TileAsset;
  };
  setLook: SetLookState;
  setComposition: TileSetCompositionState;
}

interface TessellateProject {
  workflow: "tessellate";
  shapes: ShapeTile[];
  instances: ShapeInstance[];
  lattice: RepeatLattice;
  outputMode: "field" | "medallion";
}
```

Do not create one large state object with nullable properties for every workflow. That would invite accidental cross-workflow UI and validation.

---

## 7. Shared infrastructure versus separate product behavior

### Safe to share internally

- file upload and decoding;
- color profile normalization;
- source-image cache;
- Crop viewport primitives;
- perspective transform engine;
- alpha/mask utilities;
- undo/redo framework;
- zoom/pan controls;
- export encoding;
- generic asset persistence.

### Must remain workflow-specific

- navigation sequence;
- role terminology;
- composition engine;
- project validation;
- preview framing;
- export defaults;
- onboarding/help copy;
- empty states;
- workflow completion criteria.

Shared code must not result in a shared, overloaded editor UI.

---

## 8. Workflow conversion policy

Conversion is optional future scope, but the state boundary should not block it.

### Possible safe conversions

- Field Tile → Tile Set: carry the Field asset; Edge and Corner start empty.
- Field Tile → Tessellate: carry source pixels only; require background/contour processing.
- Tessellate → Field Tile: carry source pixels only if the user explicitly chooses a rectangular crop.

### Unsafe automatic conversions

- Do not infer Edge and Corner from Field.
- Do not flatten Primary + Infill into a Field Tile without warning.
- Do not discard masks, role assets, or composition work silently.
- Do not interpret transparency alone as proof that Tessellate is required.

The first release may omit conversion entirely and offer `Duplicate into another workflow` later.

---

## 9. Navigation and progress labels

### Field Tile

```text
Crop → Repeat → Preview
```

Repeat contains Tile Turn, Field Layout, and optional Advanced Symmetry.

### Tile Set

```text
Tiles → Compose Set → Preview
```

Tiles contains Field, Edge, and Corner editing. Compose Set contains Edge Run, Corner Join, and Set Look.

### Tessellate

```text
Shapes → Assemble → Verify → Preview
```

Verify contains coverage, gap, and overlap diagnostics.

Do not force all workflows into identical step names merely for visual uniformity. Their mental models are different.

---

## 10. Testing requirements for the workflow boundary

### Workflow selection

- exactly three choices appear;
- each choice opens its own editor shell;
- active workflow remains visible in the header;
- reloading restores the same workflow.

### Isolation

- Field Tile never renders Edge/Corner or Tessellate controls;
- Tile Set never renders Primary/Infill or contour coverage controls;
- Tessellate never renders Tile Turn or Field/Edge/Corner controls;
- project state for one workflow cannot satisfy another workflow’s validator.

### Persistence

- each workflow round-trips through browser-local persistence;
- switching between saved projects does not leak editor state;
- undo history is scoped to the active project/workflow.

### Export

- Field Tile exports its field renderer;
- Tile Set exports the combined set renderer;
- Tessellate exports its cell/medallion renderer;
- all exports match their respective previews.

### Suggestions

- irregular-source suggestions never auto-switch workflow;
- dismissing a suggestion preserves current state;
- accepting a conversion clearly reports which data is retained.

---

## 11. Consolidation map

Use this document as the canonical product-level hierarchy. Detailed behavior remains in:

1. Crop workspace tools:
   `/Users/rodneyestrada/repeatfield/.hermes/plans/2026-08-27_151312-crop-workspace-designer-tools.md`
2. Field Tile / Tile Turn:
   `/Users/rodneyestrada/repeatfield/.hermes/plans/2026-08-27_152834-orientation-composer-field-layout.md`
3. Tile Set / Field + Edge + Corner:
   `/Users/rodneyestrada/repeatfield/.hermes/plans/2026-08-27_160206-tile-set-field-border-corner.md`
4. Tessellate:
   `/Users/rodneyestrada/repeatfield/.hermes/plans/2026-08-27_161618-tessellate-irregular-shapes.md`

Before implementation, consolidate those plans into one approved execution plan while preserving these workflow boundaries.

---

## 12. Acceptance checklist

- [ ] Product offers exactly three initial edit workflows.
- [ ] Field Tile is one square-tile workflow.
- [ ] Tile Set is the separate Field + Edge + Corner workflow.
- [ ] Tessellate is the separate irregular-shape workflow.
- [ ] Tessellate is not nested under Field or Tile Set.
- [ ] Public Tile Set terminology is Field, Edge, Corner.
- [ ] Each workflow has its own editor sequence and completion criteria.
- [ ] Shared utilities do not create a mixed editor interface.
- [ ] Workflow choice is explicit and persisted.
- [ ] Suggestions never silently change workflows.
- [ ] Project state is a discriminated union, not one nullable mega-state.
- [ ] Existing detailed plans are reconciled against this canonical hierarchy.
- [ ] No build begins without explicit approval of the consolidated execution plan.
