# Repeatfield Tessellate — Square Crop → Pattern Output Plan

> **Planning status — product-direction decision, no build:** This plan replaces the *background-removal/irregular-contour* premise of the earlier Tessellate plan. It must be reconciled into the canonical three-workflow plan before implementation.
>
> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Make Tessellate a reliable square-crop pattern generator: the user selects a square region containing one or more visible shapes, and Repeatfield turns that bounded visual vocabulary into intentional pattern outputs.

**Architecture:** Tessellate remains a separate top-level workflow, but becomes a *pattern-output* workflow rather than an irregular-shape packing tool. Its sole source primitive is a normalized square crop (the same crop workspace, with a locked 1:1 selection), preserved as opaque pixels. Output generators transform, repeat, mirror, segment, and stylize that square; they never depend on alpha extraction, automatic background removal, contour tracing, or a claim of mathematically gap-free arbitrary-shape tiling.

**Tech Stack:** Existing React + TypeScript + Vite application; native Canvas 2D; existing crop workspace and export pipeline.

---

## Why this is the better product boundary

The prior version makes a fragile computer-vision problem—cleanly separating an object from its background—the entrance requirement for a creative pattern tool. A mediocre extraction makes every downstream control feel broken, even when the pattern renderer is technically correct.

The proposed version asks for one action Repeatfield can make clear and dependable: **frame the interesting pattern material in a square**. The background can become texture, negative space, or color; it does not need to disappear. The product promise shifts from “we solve arbitrary tessellation” to “we make strong pattern fields from the part you choose.” That is both more useful and more honest.

## Product contract

### Input

- User imports any raster image.
- Tessellate opens the established persistent crop workspace.
- Lasso is constrained to a **square selection**. The user can drag, resize, and reposition it; modifier/keyboard movement behavior remains consistent with the shared crop workspace.
- All pixels within that square are retained, including multiple shapes, texture, shadow, and background.
- Crop result is normalized to a square source canvas (`N × N` logical pixels). No alpha mask or object/contour model is produced.

### Output

Tessellate presents pattern families as visible, selectable results—not as geometry roles or a technical repeat-cell editor:

1. **Penrose-inspired** — non-periodic-looking angular field using deterministic square-source slices, rotations, and clipped motif placements. It is “Penrose-inspired,” not a mathematical Penrose tiling claim.
2. **Kaleidoscope** — radial wedge sampling around a chosen center, with mirror seams and segment-count control.
3. **Tetra** — triangular facet field: source is sampled/transformed into repeating triangular facets with alternating orientation.
4. **Triangles** — simpler equilateral/right-triangle grid, with rotate/mirror alternation and scale controls.
5. **Prism** — layered, skewed/diamond-like facets that make a crystalline or dimensional pattern field.

All families render an infinite-looking preview, export the selected field, and expose only controls that visibly change the result: scale, rotation, mirror/flip where meaningful, density, palette/tint treatment where already supported, and family-specific controls (e.g. kaleidoscope segment count).

### Explicit non-goals for v1

- No background-removal button or threshold tuning.
- No alpha-mask / contour extraction pipeline.
- No Primary / Infill asset roles.
- No U/V repeat-cell authoring.
- No “gap/overlap coverage diagnostic.”
- No promise that source objects geometrically tessellate.
- No automatic analysis or classification of the objects inside the crop. A crop containing many shapes is valid input as-is.

## Interaction flow

`Choose Tessellate` → `Import image` → `Square Crop` → `Choose output family` → `Tune visible controls` → `Preview / Export`

The family picker must show real miniature previews generated from the user's crop. It should answer “what could this become?” immediately, rather than make the user infer it from labels.

## State model

Replace the contour-based Tessellate project shape with a deliberately small source-and-output model:

```ts
type TessellateFamily =
  | "penrose-inspired"
  | "kaleidoscope"
  | "tetra"
  | "triangles"
  | "prism";

interface SquareCrop {
  // shared source image identity + a 1:1 selection in source coordinates
  imageId: string;
  x: number;
  y: number;
  size: number;
}

interface TessellateProject {
  workflow: "tessellate";
  source: SquareCrop | null;
  family: TessellateFamily | null;
  controls: TessellateControls;
}
```

`TessellateControls` should be a family-discriminated union so irrelevant control values do not pile up in a nullable mega-state. Preserve the existing top-level workflow isolation: Field Tile retains Tile Turn/Field Layout; Tile Set retains Field/Edge/Corner; only Tessellate displays these output-family controls.

## Implementation sequence

### Task 1: Record the superseding architecture decision

**Objective:** Prevent implementers from accidentally building both incompatible Tessellate models.

**Files:**
- Modify: `.hermes/plans/2026-08-27_161618-tessellate-irregular-shapes.md`
- Modify: `.hermes/plans/2026-08-27_162517-three-distinct-edit-workflows.md`
- Modify: `.hermes/plans/2026-08-28_004500-reflection-orange-production-ui.md`

**Steps:**
1. Add a dated supersession note to each document pointing to this plan.
2. Preserve the three-workflow entry architecture.
3. Mark contour extraction, Primary/Infill, U/V Repeat Cell, and coverage diagnostics as removed—not deferred implementation work.

### Task 2: Make the Tessellate crop selection square-only

**Objective:** Create a dependable input primitive without changing Field Tile or Tile Set crop behavior.

**Files:**
- Modify: the existing crop selection/canvas component (identify during implementation)
- Modify: Tessellate workflow state/reducer component
- Test: existing crop workspace unit and Playwright test locations

**Steps:**
1. Write failing tests: Tessellate selection always has `width === height`; resize preserves 1:1; multiple visible source shapes remain in the crop output.
2. Run the focused tests and verify they fail before the mode exists.
3. Add a `selectionMode: "free" | "square"` capability to the shared crop workspace; use `"square"` only for Tessellate.
4. Normalize the selected source area to a square offscreen canvas without applying transparency or segmentation.
5. Verify keyboard movement, whole-selection drag, and Continue work in both modes.

### Task 3: Replace Tessellate state and remove dependency on segmentation

**Objective:** Store one square source plus one selected output family.

**Files:**
- Modify: Tessellate state types, reducer/store, serialization/migration code
- Modify: any prior contour/background-removal components and routes
- Test: Tessellate state and migration tests

**Steps:**
1. Write failing tests for save/load of `SquareCrop`, a selected family, and family-specific controls.
2. Add the discriminated `TessellateControls` state model.
3. Remove UI access paths to background removal, contours, Primary/Infill, and repeat-cell controls.
4. If old saved Tessellate projects exist, show a clear “re-crop to use the new Tessellate” migration notice rather than silently guessing a square source.
5. Verify Field Tile and Tile Set do not gain Tessellate controls.

### Task 4: Build the shared pattern-family renderer contract

**Objective:** Make each family easy to add and test without five unrelated rendering stacks.

**Files:**
- Create: `src/.../tessellate/renderFamily.ts` (exact module path determined from repo structure)
- Create: `src/.../tessellate/families/*.ts`
- Test: `src/.../tessellate/*.test.ts`

**Steps:**
1. Define one pure renderer input: square source canvas/image, viewport dimensions, deterministic seed, and family controls.
2. Define output as Canvas 2D drawing instructions or a renderer function; do not add a graphics dependency.
3. Add fixture-based pixel/invariant tests: deterministic output for fixed seed; all five families draw beyond a single center tile; output covers the preview canvas.
4. Build the Triangle family first as the reference implementation.

### Task 5: Implement the five output families

**Objective:** Turn the same crop into materially distinct, legible pattern fields.

**Files:**
- Modify/Create: family renderer modules
- Modify: family selector UI and preview components
- Test: unit fixtures and Playwright visual/interaction coverage

**Steps for each family:**
1. Add a failing test that verifies its renderer is deterministic and distinct from the triangle baseline using fixture pixels/invariants.
2. Implement the minimal Canvas 2D transform/clip/draw loop.
3. Add only controls with a visible effect.
4. Run focused unit tests and an interactive preview test.

**Family-specific guardrails:**
- Penrose-inspired: label honestly; never claim the output is mathematically Penrose.
- Kaleidoscope: expose center and segment count only if both are visibly intelligible.
- Tetra/Triangles: make alternating orientation obvious in the preview.
- Prism: ensure facets are compositional transforms, not fake 3D promises.

### Task 6: Design the output-first selection screen

**Objective:** Let users choose based on generated visuals rather than jargon.

**Files:**
- Modify: Tessellate workflow screen/components
- Test: Playwright desktop and mobile specs

**Steps:**
1. Render five labeled live thumbnails using the current crop.
2. Selecting a card updates the large preview immediately and preserves the crop.
3. Keep the orange-led Repeatfield design system and artwork-first hierarchy.
4. Include concise honest helper copy: “Crop what you want to repeat. Everything inside becomes pattern material.”
5. Verify at 1440×1024 and 390×844 that cards remain usable and the crop/preview is not obscured.

### Task 7: Export and regression verification

**Objective:** Export what the user sees and prove workflow boundaries stayed intact.

**Files:**
- Modify: export pipeline as needed
- Test: integration, Playwright, and export tests

**Steps:**
1. Add tests that export output for each family at the selected dimensions.
2. Verify export contains the selected family field rather than the raw square crop.
3. Run the complete unit suite, Playwright suite, production build, desktop/mobile visual checks, and an export inspection for every family.
4. Live-verify a deployed cache-busted build only after explicit approval to build/deploy.

## Acceptance criteria

- A user can select a square lasso/crop that contains one or many shapes and continue without removing any background.
- The full square’s pixels—not inferred individual objects—drive every pattern family.
- Five named output families generate visibly different full-field previews from the same source crop.
- Tessellate UI contains no contour, Primary/Infill, alpha-removal, or U/V cell language.
- Marketing/help copy never calls the output a guaranteed arbitrary-shape tessellation or a true Penrose tiling.
- Field Tile and Tile Set remain isolated from Tessellate state and controls.
- Selected output exports correctly at supported sizes.

## Risks and decisions to validate in the first implementation spike

- **Penrose label:** Keep “Penrose-inspired” in v1 unless we intentionally implement verified substitution rules. Pretending otherwise is nerd-bait in the bad way.
- **Source appearance:** Cropping existing patterned material can produce dense, visually noisy results. Provide scale and rotation before adding more effects.
- **Square crop ergonomics:** A square can feel limiting for tall or wide images; it is still the right constraint because it makes the output system coherent. Later, optional padding/contain behavior may be considered, but must not reintroduce arbitrary contour extraction.
- **“Tessellate” name:** The current feature name can remain as the entry-point brand, but UI copy should use “pattern output” and avoid promising geometric tessellation. If tests show users expect object packing, revisit the name separately.

## Decision requested before build

Approve this as the replacement direction for Tessellate: **square crop as the only source primitive; pattern-family outputs as the product; background removal and arbitrary-shape packing removed.**
