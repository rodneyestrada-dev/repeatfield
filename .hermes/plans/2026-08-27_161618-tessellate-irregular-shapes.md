# Repeatfield Tessellate — Irregular Shape Tiling Implementation Plan

> **Planning status — Plan 4, no build:** Do not implement yet. Merge with the deferred Crop tools, Tile Turn, Field Layout, and Tile Set plans. Build only after Rodney approves the consolidated scope.

> **For Hermes:** When approved, execute with subagent-driven-development and strict RED→GREEN TDD.

**Goal:** Support background-removed tiles with irregular silhouettes and help users assemble them into gap-free, overlap-free repeat cells—using one self-tiling shape when possible or complementary Primary + Infill shapes when required.

**Architecture:** Add an alpha-mask/contour pipeline after role Crop, then introduce a `Tessellate` Repeat mode that composes transformed irregular shapes inside a user-defined periodic repeat cell. Validate coverage using rasterized alpha masks and display separate gap and overlap diagnostics. Begin with assisted manual placement and contour snapping; defer fully automatic arbitrary-shape packing.

**Tech Stack:** React, TypeScript, Canvas 2D, SVG contour overlays, Web Workers if coverage analysis needs isolation, Vitest, Playwright. Browser-local only.

---

## 1. Feature name and concepts

### Public feature name: **Tessellate**

Suggested UI copy:

```text
TESSELLATE
Fit transparent tile shapes together without gaps or overlaps.
```

### Supporting terms

- **Shape Tile** — one background-removed tile with an explicit silhouette.
- **Primary** — main visual shape.
- **Infill** — companion shape that fills voids left by the Primary.
- **Repeat Cell** — one periodic assembly that repeats across the field.
- **Contour** — the boundary extracted from alpha transparency.
- **Coverage** — how completely a repeated cell fills the plane/target region.

Avoid calling this `Pack`: packing minimizes wasted space but often leaves gaps. `Tessellate` states the actual goal—no gaps and no overlaps.

---

## 2. Reference interpretation

The attached “Glass Pattern” appears to use at least two complementary silhouettes:

1. a large rounded quatrefoil/clover Shape Tile;
2. a smaller concave diamond/connector Infill tile occupying the spaces between four nearby lobes.

The green outline helps define the physical silhouette. The white interiors are artwork inside the tiles, not empty canvas whitespace.

The outer diamond is a finite medallion boundary, so the screenshot alone does not prove that the exact outer arrangement repeats infinitely. However, its interior demonstrates the product requirement clearly: multiple complementary Shape Tiles can occupy each other’s voids.

Do not assume the large quatrefoil self-tessellates. Repeating it alone at its shown spacing leaves concave voids that require:

- an Infill tile;
- overlap;
- deformation; or
- acceptance of transparent gaps.

Only the first option matches the user’s stated goal without modifying or hiding the tile artwork.

---

## 3. Product truth and constraints

Background removal creates alpha transparency and a silhouette. It does not determine a valid tiling rule.

For any irregular input, the product must classify the outcome as one of:

### A. Self-tessellating

Copies of one shape can fill the repeat cell with no gaps/overlaps using translation, rotation, and optionally reflection.

### B. Multi-shape tessellating

A Primary shape requires one or more Infill/companion shapes.

### C. Decorative packing only

The shapes can be arranged attractively but do not produce complete coverage.

The UI must not claim “seamless” for case C. It may export transparent output or a finite medallion, but empty areas remain genuinely empty.

---

## 4. Crop pipeline for irregular shapes

### 4.1 Background removal

Reuse the planned independent Background tool, but make transparency a first-class output rather than a visual effect.

Supported mask sources:

- sampled-color removal with tolerance/feather;
- future manual mask refinement;
- pre-existing PNG alpha.

### 4.2 Contour extraction

After background removal:

```text
RGBA tile
→ alpha threshold
→ binary mask
→ contour extraction
→ contour simplification/smoothing
→ Shape Tile
```

Recommended algorithm:

- marching squares or equivalent boundary tracing;
- preserve the largest outer contour;
- detect interior holes separately;
- simplify with a tolerance tied to source resolution;
- never use the simplified contour to destructively erase artwork without showing the result.

### 4.3 Contour cleanup

Tool options:

- alpha threshold;
- smooth contour;
- simplify contour;
- include/exclude holes;
- contour inset/outset for grout allowance;
- reset contour;
- show raw mask versus cleaned contour.

Do not fill interior transparent holes automatically; they may be intentional artwork.

### 4.4 Shape anchors

Each Shape Tile stores:

- local origin/pivot;
- bounding box;
- centroid;
- contour vertices;
- orientation baseline;
- optional named connection points.

Users can move the pivot when rotation around the visual center is preferable to geometric centroid.

---

## 5. Repeat workspace: Tessellate editor

### 5.1 Separate workflow boundary

Tessellate is a distinct top-level editing workflow. It must not appear as a Repeat mode, preset, tab, or disclosure inside either square-tile workflow.

The product's three initial workflow choices are:

1. Field Tile — one square field tile;
2. Tile Set — square Field + Edge + Corner tiles;
3. Tessellate — irregular/non-square transparent Shape Tiles.

After the user chooses Tessellate, route into a dedicated Crop/Contour → Assemble → Verify → Export sequence. Do not show Tile Turn, Straight, Brick, Half-Drop, Field/Edge/Corner roles, or Advanced Symmetry unless a later Tessellate-specific design explicitly adds an equivalent operation.

Tessellate is not another Straight/Brick preset and is not nested under Field.

### 5.2 Persistent main canvas

The Tessellate editor shows:

- transparent Shape Tiles;
- current Repeat Cell boundary;
- neighboring ghost cells;
- contour outlines;
- gap heatmap;
- overlap heatmap;
- repeat vectors U and V;
- coverage percentage.

### 5.3 Assisted manual placement — recommended first version

Users can:

- add Primary and Infill shapes;
- duplicate;
- drag;
- rotate in 90° increments or free-angle when enabled;
- reflect explicitly;
- change draw order for preview only;
- select multiple shapes;
- align centers/edges;
- snap compatible contours;
- define the Repeat Cell with two translation vectors.

This gives design control and avoids pretending arbitrary contour packing has one correct automatic solution.

### 5.4 Contour snapping

When one shape approaches another:

- compare nearby contour segments;
- offer a snap when tangent direction and distance are compatible;
- preview proposed placement before committing;
- never snap into an overlap above tolerance;
- allow holding a modifier key to disable snapping.

A signed-distance-field or sampled contour-distance approach is sufficient initially. Exact computational-geometry curve matching can be deferred.

### 5.5 Repeat Cell

A periodic field is defined by two vectors:

```ts
interface RepeatLattice {
  u: Point;
  v: Point;
}
```

Every Shape Tile instance in the cell repeats at:

```text
position + i·u + j·v
```

The editor renders neighboring cells so users can see joins across all four cell boundaries. A cell that looks complete internally may still create gaps at its repeated edges; therefore coverage analysis must include neighbors.

---

## 6. Coverage and overlap diagnostics

### 6.1 Raster coverage test

Render the Repeat Cell plus neighboring translated copies into offscreen masks.

For each sample pixel in the target cell, count coverage:

```text
0 shapes → gap
1 shape  → valid coverage
2+ shapes → overlap
```

Metrics:

- gap percentage;
- overlap percentage;
- valid coverage percentage;
- largest connected gap area;
- largest connected overlap area.

### 6.2 Visual diagnostics

Recommended colors:

- transparent/neutral: valid coverage;
- red: gap;
- magenta: overlap;
- cyan contour: active shape;
- dotted line: Repeat Cell boundary.

Do not insert a white background to hide gaps. The checkerboard should remain visible wherever coverage is zero.

### 6.3 Acceptance thresholds

Use tolerance because antialiasing creates edge pixels:

- coverage alpha threshold;
- small subpixel seam tolerance;
- optional grout allowance.

Label states honestly:

- `Gap-free`
- `Near fit — inspect edges`
- `Gaps detected`
- `Overlaps detected`
- `Decorative packing`

### 6.4 Grout mode

Physical tiles may intentionally need a uniform gap. Treat grout as explicit geometry, not background whitespace.

- `Touching` mode: contours meet.
- `Grout` mode: contours offset by a selected physical/pixel width.
- The grout region is intentional and previewed with a selected material/color.

The user’s “no additional visible whitespace” maps to Touching mode or transparent export, not an arbitrary canvas background.

---

## 7. Multi-shape system

### 7.1 Primary + Infill

For the reference pattern:

```text
Primary: large quatrefoil
Infill: concave connector/diamond
```

A Repeat Cell may contain multiple instances of both.

### 7.2 Separation from Tile Set

Primary and Infill are Tessellate-only geometric roles. Field, Edge, and Corner are Tile Set-only installation roles. Do not nest one role system inside the other.

```text
TILE SET WORKFLOW              TESSELLATE WORKFLOW
Field                          Primary
Edge                           optional Infill
Corner                         Repeat Cell
```

If irregular Edge or Corner support is ever requested, treat it as a future fourth workflow or a separately approved expansion—not as implicit scope for either current workflow.

### 7.3 More than two shapes

State should support an array, but UI should optimize for:

- one Primary;
- zero or one Infill initially.

Allowing arbitrary many shapes is architecturally reasonable but should not drive the first UI.

---

## 8. Finite composition versus infinite field

Add an explicit output intent:

### Field

Repeat the cell indefinitely/crop to output bounds. Requires periodic boundary coverage.

### Medallion

Arrange a finite cluster with an irregular outer silhouette. Transparency outside the union is expected.

The supplied reference is displayed as a finite diamond medallion. Users may want to reproduce that composition even if it does not tile the full plane.

Suggested UI:

```text
OUTPUT
Field · Medallion
```

In Medallion mode:

- no claim of infinite seamlessness;
- crop export to union bounds;
- background remains transparent unless intentionally chosen;
- allow symmetric cluster duplication.

---

## 9. State model

### Task 1: Add Shape Tile data

**Files:**
- Create: `src/engine/shapeTile.ts`
- Create: `src/engine/shapeTile.test.ts`
- Modify: `src/app/state.ts`
- Modify: `src/app/state.test.ts`

```ts
interface ShapeTile {
  id: string;
  role: "primary" | "infill";
  sourceRole: "field" | "border" | "corner";
  alphaMask: ImageDataReference;
  outerContour: Point[];
  holes: Point[][];
  pivot: Point;
}
```

TDD:

1. mask/contour state survives role switching;
2. Primary and Infill remain independent;
3. reset contour does not reset source Crop;
4. transparent PNG source preserves alpha.

### Task 2: Extract contours

**Files:**
- Create: `src/engine/contours.ts`
- Create: `src/engine/contours.test.ts`

Test fixtures:

- circle-like mask;
- concave clover;
- shape with hole;
- noisy antialiased edge;
- disconnected specks.

Acceptance:

- correct outer contour;
- correct winding/order;
- holes detected;
- tiny disconnected noise filtered by threshold;
- simplification remains within error tolerance.

### Task 3: Add Shape instances and lattice state

**Files:**
- Create: `src/engine/tessellation.ts`
- Create: `src/engine/tessellation.test.ts`
- Modify state/reducer tests

```ts
interface ShapeInstance {
  shapeId: string;
  position: Point;
  rotation: number;
  reflected: boolean;
}

interface TessellationState {
  shapes: ShapeTile[];
  instances: ShapeInstance[];
  lattice: RepeatLattice;
  outputMode: "field" | "medallion";
}
```

### Task 4: Add coverage analysis

**Files:**
- Create: `src/engine/coverage.ts`
- Create: `src/engine/coverage.test.ts`

TDD fixtures:

- perfect square grid: 100% valid;
- separated circles: gaps;
- overlapping squares: overlap;
- Primary + Infill perfect synthetic pair: valid;
- same pair missing Infill: gap.

### Task 5: Add Repeat Cell renderer

**Files:**
- Modify: `src/engine/renderer.ts`
- Add renderer tests

Verify:

- repeats across U/V vectors;
- edge neighbors contribute inside target cell;
- transparency preserved;
- field and medallion outputs differ correctly;
- export uses the same renderer.

---

## 10. UI tasks

### Task 6: Add Contour tool to Crop dock

Tool icon: outlined irregular shape.

Options:

- threshold;
- smooth;
- simplify;
- inset/outset;
- holes;
- reset;
- contour preview.

The tool appears only when transparency exists or can be generated.

### Task 7: Add Shape Set intake

Within active Field role:

- `Primary`
- `Add Infill`

Each can use separate files or selections from one source sheet.

### Task 8: Add Tessellate workspace controls

- select/transform;
- duplicate;
- rotate;
- reflect;
- contour snap;
- repeat vectors;
- gap/overlap diagnostic;
- Touching/Grout;
- Field/Medallion.

### Task 9: Add coverage status

Show concise metrics without turning the tool into engineering software:

```text
Coverage 100%
Gaps 0%
Overlap 0%
```

Put detailed diagnostics behind a disclosure.

### Task 10: Add assisted placement suggestions — phase 2

Possible approach:

- sample candidate rotations/reflections;
- correlate contour/signed-distance fields;
- rank low-gap, low-overlap placements;
- show ghost suggestions;
- user accepts one.

Do not promise automatic full tessellation discovery for arbitrary silhouettes.

---

## 11. Integration with existing plans

Top-level product hierarchy:

```text
NEW PATTERN
├── FIELD TILE
│   └── Crop → Tile Turn → Field Layout → Preview/Export
├── TILE SET
│   └── Field + Edge + Corner → Set Preview → Export
└── TESSELLATE
    └── Remove Background/Contour → Primary + optional Infill
        → Repeat Cell → Coverage Check → Preview/Export
```

The workflow is chosen before entering an editor. Do not infer and silently switch workflows after background removal. The product may suggest Tessellate when it detects substantial transparent contour space, but changing workflow requires explicit user action and a clear statement of what state will carry over.

All three workflows may share low-level image-processing utilities and visual components, but they must not share a mixed editor navigation or one overloaded project state.

---

## 12. Recommended phased delivery

### Phase 1

- alpha contour extraction;
- Primary + optional Infill;
- assisted manual placement;
- U/V Repeat Cell;
- gap/overlap heatmap;
- Touching/Grout;
- Field/Medallion;
- transparent export.

### Phase 2

- contour snap suggestions;
- ranked placement suggestions;
- multiple Infills;
- per-edge connection labels;
- stronger workflow conversion/import support without merging Tessellate into Tile Set.

### Phase 3

- constrained automatic tessellation search;
- isohedral template library;
- shape deformation/Escher-style editing;
- automated companion-shape generation.

Do not begin with Phase 3. It is a separate computational-geometry product inside the product.

---

## 13. Risks

1. Arbitrary silhouettes may not tessellate at all.
2. Raster alpha boundaries are noisy; contour cleanup must be visible and reversible.
3. Antialiasing can produce false one-pixel gaps/overlaps.
4. Automatic packing does not imply tessellation.
5. Reflection changes artwork handedness and must remain explicit.
6. A finite medallion can look gap-free without defining an infinite field.
7. Grout is intentional space; distinguish it from accidental background.
8. Multiple transparent images can consume memory; cache masks and downsample diagnostics.
9. Companion-shape discovery is difficult; start with user-supplied Infill.
10. Background removal quality limits contour quality.

---

## 14. Verification scenarios

### Self-tiling synthetic shape

- load known interlocking fixture;
- define Repeat Cell;
- verify 100% coverage and 0% overlap.

### Primary without Infill

- load clover fixture;
- repeat;
- verify gaps are detected and checkerboard remains visible.

### Primary + Infill

- add connector;
- place and snap;
- verify gap percentage reaches tolerance.

### Boundary repeat

- make cell appear internally full but fail at right edge;
- verify neighboring-cell analysis detects the gap.

### Grout

- enable uniform grout;
- verify gap is classified as intentional grout, not accidental whitespace.

### Medallion

- build finite diamond cluster;
- export union bounds with transparent exterior;
- verify no infinite-seam claim.

### Downstream export

- export transparent PNG;
- verify alpha outside medallion and no injected white background.

---

## 15. Consolidation references

Merge with:

- `/Users/rodneyestrada/repeatfield/.hermes/plans/2026-08-27_151312-crop-workspace-designer-tools.md`
- `/Users/rodneyestrada/repeatfield/.hermes/plans/2026-08-27_152834-orientation-composer-field-layout.md`
- `/Users/rodneyestrada/repeatfield/.hermes/plans/2026-08-27_160206-tile-set-field-border-corner.md`

No implementation or deployment until the combined product model is reviewed.

---

## 16. Final acceptance checklist

- [ ] Feature is named Tessellate.
- [ ] Background removal produces real alpha, not a painted background.
- [ ] Contour extraction is visible and reversible.
- [ ] Primary and optional Infill shapes are supported.
- [ ] Repeat Cell uses explicit U/V vectors.
- [ ] Neighboring cells participate in coverage analysis.
- [ ] Gaps and overlaps are measured separately.
- [ ] No white background is inserted to hide gaps.
- [ ] Touching and Grout modes are distinct.
- [ ] Decorative packing is not labelled seamless.
- [ ] Field and Medallion outputs are distinct.
- [ ] Transparent PNG export preserves empty exterior regions.
- [ ] Tessellate remains separate from Tile Turn and Field Layout.
- [ ] Automatic arbitrary-shape tessellation search is deferred.
- [ ] No build occurs before consolidated approval.
