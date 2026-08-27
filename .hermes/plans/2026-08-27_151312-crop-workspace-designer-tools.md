# Repeatfield Crop Workspace Designer-Tools Redesign Implementation Plan

> **Planning status — deferred cumulative build:** Do not implement this plan in isolation. Merge Rodney's next Repeatfield planning discussions into the same scope, review the consolidated plan, and build the approved changes together in one later implementation batch.

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task only after the consolidated scope is explicitly approved for build.

**Goal:** Redesign Crop as one persistent designer workspace with an icon-based tool dock, independently selectable Lasso/Warp/Background tools, a draggable crop selection, a functioning square rectification workflow, and an always-present Continue to Repeat action.

**Architecture:** Keep one Crop route and one mounted crop canvas. Replace the current numbered pseudo-step toolbar and conditional page-like layouts with a persistent shell: compact icon dock, single central edit canvas, context-sensitive options popover/panel, persistent seam preview, and fixed global Continue action. Separate selection geometry from warp geometry in state so Lasso moves/selects the tile while Warp changes how the selected pixels are rectified into the square output.

**Tech Stack:** React, TypeScript, Vite, native Canvas 2D/SVG overlays, Vitest, Testing Library, Playwright. No backend and no new heavy UI or image-processing dependency.

---

## 1. Product and interaction contract

### 1.1 One Crop workspace, not three Crop pages

Crop remains one route and one mounted editing surface. Selecting a tool changes only:

- the canvas overlay and pointer behavior;
- the highlighted tool icon;
- a compact tool-options disclosure when that tool has additional settings.

It must not replace the whole Crop layout, unmount the canvas, move the Continue action, or make the seam check disappear.

### 1.2 Independent tools, no numbering

The dock presents independent tools without `1`, `2`, or `3`:

| Tool | Suggested icon | Primary action | Context options |
|---|---|---|---|
| Select tile | four-corner polygon / crop-path | Draw, resize, or move the tile selection | Reset selection; optional nudge amount |
| Warp to square | perspective grid / skewed square | Rectify selected content into a square target | Show grid; live before/after; reset warp; optional mesh density hidden under Advanced |
| Remove background | checkerboard/eraser | Sample unwanted color and preview transparency | Color, tolerance, feather, enable/reset |
| Rotate 90° | rotate-right | Rotate source | none |
| Flip horizontal | reflect-horizontal | Flip source | none |
| Flip vertical | reflect-vertical | Flip source | none |
| Reset crop | reset/restore | Restore Crop state | confirmation only if destructive enough to warrant it |

Use recognizable inline SVG icons rather than emoji. Every tool button needs:

- `aria-label`;
- `aria-pressed` for modal tools;
- native tooltip via `title` as a baseline;
- styled hover/focus tooltip for mouse and keyboard users;
- visible selected state;
- 44×44 px minimum hit target.

### 1.3 Persistent global actions

The following never disappear while `workspace === "crop"`:

- Upload/Replace image;
- tool dock;
- central Crop canvas;
- seam check;
- `Continue to Repeat`.

`Continue to Repeat` should live in a sticky Crop action bar or stable footer outside tool-specific panels. It must remain visible or reachable without depending on which Crop tool is selected.

### 1.4 Lasso behavior

For this version, “Lasso Tile” means a four-point quadrilateral appropriate for photographed rectangular/square tiles, not a freehand many-point mask.

Required direct manipulation:

- Drag any corner to reshape the selection.
- Drag an edge to move that edge while preserving its local direction as closely as practical.
- Drag anywhere inside the polygon to move the entire quadrilateral.
- Arrow keys nudge the whole selection by one source pixel-equivalent step.
- `Shift+Arrow` nudges by ten steps.
- When a corner or edge has explicit focus, arrows move that active handle instead of the whole selection.
- Keep all points clamped to source bounds.
- Prevent or reject self-intersecting/crossed quadrilaterals.
- Cursor feedback: `grab` inside, directional/precision cursor on handles, `grabbing` while moving.

Selection movement must use pointer capture so dragging remains stable if the pointer leaves the polygon temporarily.

### 1.5 Warp behavior

The current implementation makes the Warp button appear to be a mode while rectification is already happening invisibly. Replace that ambiguity with a real, observable Warp tool.

State must distinguish:

- `selectionQuad`: the tile boundary chosen by Lasso in source-image coordinates;
- `warpQuad` or equivalent warp transform: the sampling geometry used to map selected pixels to the square target;
- fixed square `targetRect`: the output geometry.

Recommended interaction:

1. Lasso defines and moves `selectionQuad` over the photograph.
2. Activating Warp overlays a clear square target grid and four warp pins derived from the selection.
3. Dragging Warp pins changes the sampling/projective transform without moving the Lasso boundary itself.
4. A live square “Rectified tile” inset inside the same canvas area shows the actual output pixels.
5. The user can compare source selection and rectified output without navigating to another Crop page.
6. `Reset warp` returns warp pins to the selected boundary.
7. Seam check, Repeat, Preview, and export consume the rectified result.

The Warp tool should therefore do something visibly different from Lasso:

- Lasso moves/selects the source boundary.
- Warp changes the image mapping into the square target.

Do not add a fake “Apply” button if output already updates live. If an Apply/Cancel transaction is used, define it explicitly and keep Continue disabled while uncommitted changes exist; live editing is preferred.

### 1.6 Tool-specific options disclosure

Tool options should behave like a Photoshop-style dock:

- clicking the active tool icon opens or closes its options disclosure;
- switching tools closes the previous disclosure and opens the new tool’s options only when that tool has options;
- simple actions such as Rotate and Flip execute immediately and do not open empty panels;
- options appear as a compact anchored popover or stable inspector section, not a replacement page;
- pressing `Escape` closes the options disclosure but does not switch tools or lose edits;
- clicking outside closes the disclosure when safe;
- options remain keyboard accessible.

Remove Background is the primary example:

- toggle enable/disable;
- eyedropper/sample action;
- color input;
- tolerance;
- feather;
- reset removal.

### 1.7 Visual direction

Retain the approved light-lavender Living Studio language, but make Crop feel more like a design application:

- compact vertical icon dock;
- reduced explanatory prose;
- visual tooltips and status text;
- central canvas remains dominant;
- tool-specific options use concise labels;
- no neo-brutalist restyling;
- no numbered Crop tools.

---

## 2. State and geometry model

### Task 1: Split selection geometry from warp geometry

**Objective:** Give Lasso and Warp separate state and reducer actions so they are independent functions rather than labels over the same behavior.

**Files:**
- Modify: `src/app/state.ts`
- Modify: `src/app/state.test.ts`
- Modify: `src/engine/geometry.ts`
- Modify: `src/engine/geometry.test.ts`

**State proposal:**

```ts
interface CropState {
  // existing source orientation/background settings
  selectionQuad: Quad;
  warpQuad: Quad;
  activeTool: "select" | "warp" | "background";
  openToolOptions: "select" | "warp" | "background" | null;
  backgroundRemoval: BackgroundRemovalState;
}
```

Migration note: replace or migrate the current single `quad`; do not keep ambiguous duplicate fields.

**TDD steps:**

1. Add failing reducer tests proving selection movement does not alter warp state.
2. Add failing reducer tests proving warp-pin movement does not alter selection state.
3. Add failing reset tests for `reset-selection`, `reset-warp`, and full `reset-crop`.
4. Add failing tests proving rotation/flip update both geometries consistently or intentionally reset warp; choose one documented rule. Recommended: transform both geometries so edits are preserved.
5. Implement minimal reducer actions.
6. Run: `npm run test:run -- src/app/state.test.ts`.
7. Expected: all state tests pass.

**Commit:** `refactor: separate crop selection and warp state`

### Task 2: Add safe quadrilateral translation and intersection guards

**Objective:** Support whole-selection dragging and keyboard nudging while keeping the selection inside source bounds and preventing invalid crossed polygons.

**Files:**
- Modify: `src/engine/geometry.ts`
- Modify: `src/engine/geometry.test.ts`

**Functions to add:**

```ts
translateQuad(quad: Quad, delta: Point): Quad
moveQuadEdge(quad: Quad, edgeIndex: number, delta: Point): Quad
isSimpleConvexQuad(quad: Quad): boolean
clampQuadTranslation(quad: Quad, delta: Point): Point
```

**TDD steps:**

1. Test whole-quad translation preserves all side vectors.
2. Test translation clamps as one unit at all four source bounds.
3. Test edge movement changes only the two edge endpoints.
4. Test crossed/self-intersecting results are rejected.
5. Test keyboard-sized normalized deltas.
6. Implement minimal pure geometry.
7. Run: `npm run test:run -- src/engine/geometry.test.ts`.
8. Expected: geometry suite passes.

**Commit:** `feat: add safe crop selection translation`

### Task 3: Define observable warp mapping

**Objective:** Ensure changing Warp pins visibly changes rectified pixels while leaving Lasso selection fixed.

**Files:**
- Modify: `src/engine/renderer.ts`
- Modify: `src/engine/geometry.ts`
- Modify: `src/engine/geometry.test.ts`
- Create or modify: `src/engine/renderer.test.ts` if Canvas test support is practical; otherwise cover pure mapping plus Playwright output hashes.

**Approach:**

- Treat `selectionQuad` as the selected source boundary.
- Treat `warpQuad` as the projective sampling transform initialized from `selectionQuad`.
- Normalize warp coordinates relative to the selected region so moving the selection does not unpredictably invalidate warp.
- Continue using the current subdivided Canvas 2D mesh, but feed it the explicit warp transform.
- Render a square output preview from the same function consumed downstream.

**TDD steps:**

1. Add a failing pure mapping test where two warp configurations produce different mapped interior points.
2. Add a failing integration assertion that changing Warp pins changes the seam canvas data URL.
3. Assert selection coordinates remain unchanged after Warp interaction.
4. Implement the renderer/state connection.
5. Run focused tests, then `npm run test:run`.

**Commit:** `feat: make warp pins control square rectification`

---

## 3. Persistent Crop shell and icon dock

### Task 4: Build the icon-tool data model

**Objective:** Centralize tool metadata and eliminate numbered text cards.

**Files:**
- Create: `src/app/cropTools.tsx`
- Create: `src/app/cropTools.test.tsx`
- Modify: `src/app/App.tsx`

**Tool model:**

```ts
interface CropToolDefinition {
  id: CropToolId;
  label: string;
  shortcut?: string;
  kind: "modal" | "command";
  icon: ReactNode;
  hasOptions: boolean;
}
```

**TDD steps:**

1. Add failing tests asserting there are no numeric prefixes in tool labels.
2. Add failing tests for unique labels, icons, and command/modal behavior.
3. Implement inline SVG icons and metadata.
4. Verify each icon has an accessible label and tooltip text.

**Commit:** `feat: define crop icon tools`

### Task 5: Replace Crop side copy with a Photoshop-style dock

**Objective:** Make tool selection compact and visual while retaining accessibility.

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/styles.css`
- Modify: `src/app/App.test.tsx`

**Layout:**

```text
┌ top app navigation ─────────────────────────────────────────┐
├ file bar ───────────────────────────────────────────────────┤
│ icon dock │              persistent canvas              │ options/seam │
│           │                                             │              │
├ persistent crop action bar ─────────── Continue to Repeat ┤
```

**TDD steps:**

1. Add a failing component test asserting independent unnumbered tool buttons.
2. Add a failing test asserting the same Crop canvas remains mounted while changing tools.
3. Add a failing test asserting `Continue to Repeat` remains visible for Select, Warp, and Background.
4. Implement the icon dock and stable Crop shell.
5. Add hover/focus tooltips and selected states.
6. Verify 44×44 hit targets in Playwright.

**Commit:** `feat: redesign crop as persistent icon workspace`

### Task 6: Add contextual dropdown/options behavior

**Objective:** Reveal extended controls without turning tools into separate pages.

**Files:**
- Create: `src/app/CropToolOptions.tsx`
- Create: `src/app/CropToolOptions.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/styles.css`

**TDD steps:**

1. Test Background icon toggles its options without hiding the canvas or Continue action.
2. Test Warp icon reveals grid/reset/preview controls.
3. Test command icons execute without opening empty options.
4. Test `Escape` closes options.
5. Test focus returns to the originating tool button when disclosure closes.
6. Implement with semantic buttons and a labelled popover/disclosure.

**Commit:** `feat: add contextual crop tool options`

---

## 4. Direct Lasso interaction

### Task 7: Add whole-polygon pointer dragging

**Objective:** Let users drag the selected tile itself, not only its corners.

**Files:**
- Modify: `src/app/App.tsx` (`CropCanvas` extraction recommended)
- Prefer create: `src/app/CropCanvas.tsx`
- Create: `src/app/CropCanvas.test.tsx`
- Modify: `src/styles.css`
- Modify: `e2e/app.spec.ts`

**Interaction priority:**

1. Corner hit target
2. Edge hit target
3. Polygon interior
4. Empty canvas/background sampling

**TDD steps:**

1. Add failing Playwright test: drag polygon center by a known delta.
2. Assert all four handles move by the same delta.
3. Assert side vectors remain unchanged.
4. Assert dragging against a boundary clamps the entire polygon.
5. Implement pointer-captured selection dragging.
6. Add visual cursor states.

**Commit:** `feat: drag the complete tile selection`

### Task 8: Add keyboard movement

**Objective:** Make tile selection precisely movable without a mouse.

**Files:**
- Modify: `src/app/CropCanvas.tsx` or current `CropCanvas` in `src/app/App.tsx`
- Modify: `src/app/CropCanvas.test.tsx`
- Modify: `e2e/app.spec.ts`

**Keyboard contract:**

- Arrow: one normalized source-pixel step
- Shift+Arrow: ten steps
- Active corner/edge: move that target
- Polygon focused with no active handle: move entire selection
- Do not hijack arrows in range/color/file inputs

**TDD steps:**

1. Add failing keyboard tests for whole selection.
2. Add failing tests for focused corner.
3. Add input-focus protection test.
4. Implement and verify focus rings.

**Commit:** `feat: add keyboard crop nudging`

---

## 5. Functional Warp tool

### Task 9: Add explicit Warp overlay and rectified preview

**Objective:** Make Warp visibly functional in the single Crop canvas.

**Files:**
- Modify: `src/app/CropCanvas.tsx` or `src/app/App.tsx`
- Modify: `src/engine/renderer.ts`
- Modify: `src/styles.css`
- Modify: `e2e/app.spec.ts`

**Required visuals when Warp is active:**

- warp pins visually distinct from Lasso handles;
- source quadrilateral remains visible but subdued;
- square target grid is visible;
- live “Rectified tile” preview inset appears within the persistent canvas region;
- dragging a warp pin visibly changes that preview immediately;
- `Reset warp` restores default mapping.

**TDD steps:**

1. Add failing Playwright test that activates Warp and records source/rectified canvas hashes.
2. Drag one warp pin.
3. Assert rectified preview hash changes.
4. Assert `selectionQuad` handle positions do not change.
5. Navigate to Repeat and assert downstream canvas matches the changed rectification.
6. Implement minimal overlay and renderer wiring.

**Commit:** `feat: expose live square warp editing`

### Task 10: Add invalid-warp handling

**Objective:** Avoid NaN, blank canvases, and folded/crossed transformations.

**Files:**
- Modify: `src/engine/geometry.ts`
- Modify: `src/engine/geometry.test.ts`
- Modify: `src/app/CropCanvas.tsx`

**Rules:**

- Reject self-intersection.
- Enforce minimum area.
- Keep all pins finite and in bounds.
- Show concise inline status when a move is rejected.
- Never destroy the last valid warp state.

**TDD steps:**

1. Test degenerate quadrilateral rejection.
2. Test crossed pin rejection.
3. Test renderer preserves last valid frame.
4. Implement validation.

**Commit:** `fix: guard invalid perspective warps`

---

## 6. Persistent Continue and downstream integrity

### Task 11: Move Continue to a stable Crop action bar

**Objective:** Ensure Continue never disappears when tools/options change.

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/styles.css`
- Modify: `src/app/App.test.tsx`
- Modify: `e2e/app.spec.ts`

**TDD steps:**

1. Loop through every Crop tool.
2. Assert exactly one `Continue to Repeat` button remains visible and enabled.
3. Open and close every options disclosure.
4. Assert the button keeps the same bounding box or stable sticky region.
5. Verify mobile access without horizontal overflow.

**Commit:** `fix: keep crop continuation globally available`

### Task 12: Verify one rectified source feeds every downstream view

**Objective:** Prevent Crop preview, seam check, Repeat, Preview, and Export from rendering different tile sources.

**Files:**
- Modify: `src/engine/renderer.ts`
- Modify: `e2e/app.spec.ts`

**TDD scenario:**

1. Upload a skewed fixture.
2. Move the whole Lasso selection.
3. Activate Warp and adjust one warp pin.
4. Enable Background Removal and sample a color.
5. Record seam check.
6. Continue to Repeat and record pattern canvas.
7. Open Preview and export PNG.
8. Assert all outputs changed from baseline and retain transparency where expected.

**Commit:** `test: prove crop edits flow through every output`

---

## 7. Responsive and accessibility QA

### Task 13: Desktop designer-workspace verification

**Viewport:** `1440×1024`

Verify numerically and visually:

- document scroll width ≤ 1440;
- canvas is the dominant area;
- dock icons are 44×44 or larger;
- tooltips do not clip against viewport edges;
- options panel does not cover Continue;
- Lasso interior drag area is discoverable;
- Warp preview and source selection remain distinguishable;
- no numbered Crop tools remain;
- no duplicate Continue buttons.

Capture:

- default Select tool;
- polygon mid-drag;
- Warp active with rectified preview;
- Background options open.

### Task 14: Mobile verification

**Viewport:** `390×844`

Recommended mobile adaptation:

- icon dock becomes a horizontal scroll-free tool row or compact bottom dock;
- options become a dismissible bottom sheet/disclosure;
- Continue remains sticky but does not cover the canvas;
- canvas handles remain ≥44×44;
- document/root scroll width ≤390;
- keyboard-focus order remains logical.

Add Playwright assertions for exact widths and hit targets.

**Commit:** `test: verify crop dock across responsive layouts`

### Task 15: Accessibility pass

Verify:

- every icon has `aria-label` and tooltip;
- modal tools expose `aria-pressed`;
- options disclosure uses `aria-expanded` and `aria-controls`;
- keyboard users can select tools, move selection, modify warp, close options, and continue;
- color is not the only selected-state cue;
- focus is visible;
- reduced-motion users do not receive animated tool-panel transitions.

Run Testing Library accessibility-oriented assertions and Playwright keyboard flows.

---

## 8. Documentation and release

### Task 16: Update user-facing documentation

**Files:**
- Modify: `README.md`

Document:

- independent Crop tool dock;
- whole-selection pointer and keyboard movement;
- selection versus Warp behavior;
- stable Continue action;
- Background options disclosure;
- limitations: quadrilateral selection, color-based background removal, mesh-based projective approximation.

Do not expose builder notes in the rendered application.

### Task 17: Full verification before publishing

Run exactly:

```bash
npm ci
npm run test:run
npm run test:e2e
npm run build
```

Then serve the exact `dist/` directory and verify in Chromium at desktop and mobile widths.

Acceptance criteria:

- all tests pass;
- no console errors;
- no horizontal overflow;
- one Crop canvas remains mounted while tools change;
- no numbered tool labels;
- full selection drag works;
- keyboard nudge works;
- Warp visibly changes pixels and downstream outputs;
- Continue remains available for all Crop tools;
- export remains nonblank and preserves transparency.

### Task 18: Publish only after approval

Do not deploy during planning or initial build review. After Rodney approves the redesigned local version:

1. Build a clean `dist/`.
2. Sync only production artifacts into `public-release/`.
3. Commit and push the release branch/repository.
4. Wait for GitHub Pages status `built`.
5. Probe the live page with cache-busting query.
6. Verify live demo asset, tool dock, Lasso drag, Warp output, Background options, Continue, Repeat, and export.

---

## 9. Files likely to change

### Existing

- `src/app/App.tsx`
- `src/app/state.ts`
- `src/app/state.test.ts`
- `src/app/App.test.tsx`
- `src/engine/geometry.ts`
- `src/engine/geometry.test.ts`
- `src/engine/renderer.ts`
- `src/styles.css`
- `e2e/app.spec.ts`
- `scripts/verify-ui.mjs`
- `README.md`

### Recommended extractions

- `src/app/CropCanvas.tsx`
- `src/app/CropCanvas.test.tsx`
- `src/app/CropToolDock.tsx`
- `src/app/CropToolDock.test.tsx`
- `src/app/CropToolOptions.tsx`
- `src/app/CropToolOptions.test.tsx`
- `src/app/cropTools.tsx`

Avoid creating a broad design-system abstraction; this extraction is only to stop `App.tsx` from carrying canvas interaction, tool metadata, and application routing in one file.

---

## 10. Risks and tradeoffs

1. **Selection versus Warp mental model:** If both use identical corner handles on the same image, Warp will still feel nonfunctional. Use visually distinct pins and a live rectified preview.
2. **Whole-selection drag conflicts:** Polygon dragging, corner dragging, edge dragging, and Background eyedropper need strict pointer-event priority.
3. **Keyboard normalization:** Arrow movement should be based on source-image scale, not viewport pixels, or behavior will vary across responsive layouts.
4. **State migration:** Current `crop.quad` mixes selection and rectification. Split it deliberately and update all consumers in one migration.
5. **Mobile options:** A desktop floating popover may obscure the canvas on mobile; use a bottom disclosure while keeping Continue reachable.
6. **Mesh approximation:** Preserve the current bounded mesh approach unless visual testing proves it insufficient. Do not add a large imaging dependency without evidence.
7. **Background removal:** Remains global color-distance removal, not ML segmentation or contiguous flood fill.
8. **Scope control:** This redesign should not add freehand masking, Bezier paths, AI subject extraction, history for Crop, or multi-layer editing unless separately requested.

---

## 11. Final acceptance checklist

- [ ] Lasso, Warp, and Background are independent, unnumbered tools.
- [ ] All Crop edit functions are represented by accessible icons.
- [ ] Tooltips appear on hover and focus.
- [ ] Tool-specific controls open in a disclosure, not a new Crop page.
- [ ] Exactly one Crop canvas persists while tools change.
- [ ] Continue to Repeat never disappears.
- [ ] Entire Lasso selection is draggable.
- [ ] Lasso selection supports keyboard nudging.
- [ ] Corners and edges remain directly adjustable.
- [ ] Warp changes the actual image mapping into a square target.
- [ ] Warp has a visible square grid and live rectified preview.
- [ ] Reset Warp restores a valid baseline.
- [ ] Background removal remains optional and adjustable.
- [ ] Seam check, Repeat, Preview, and Export consume the same rectified tile.
- [ ] Desktop and mobile have no horizontal overflow.
- [ ] Existing Repeat Undo/Redo behavior remains intact.
- [ ] No deployment occurs before local visual approval.
