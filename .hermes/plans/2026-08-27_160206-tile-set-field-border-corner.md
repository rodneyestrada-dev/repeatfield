# Repeatfield Tile Set — Field, Border, and Corner Implementation Plan

> **Planning status — Plan 3, no build:** Do not implement this plan yet. Merge it with the deferred Crop designer-tools redesign, Tile Turn/Field Layout plan, and any later Repeatfield planning discussions. Build only after Rodney explicitly approves the consolidated scope.

> **For Hermes:** When implementation is approved, execute with subagent-driven-development and strict RED→GREEN TDD.

**Goal:** Let users create and edit a coordinated three-role Tile Set—Field, Border, and Corner—through Crop and Repeat, then preview the three roles together as one continuous framed design.

**Architecture:** Replace the current single-source assumption with a `TileSet` project containing independent role assets and geometry state for `field`, `border`, and `corner`, plus shared set-level appearance and placement settings. Crop stays one persistent designer workspace with a role switcher and shared tool dock. Repeat gives each role an appropriate composition model, then combines them in a frame renderer that validates continuity at field–border and border–corner joins.

**Tech Stack:** React, TypeScript, Canvas 2D, SVG interaction overlays, Vitest, Testing Library, Playwright. Browser-local only. No code or deployment in this planning pass.

> **Superseding product decision (2026-08-27):** This is one of three separate top-level workflows. It is not an extension of Field Tile and does not contain Tessellate. Public UI uses **Edge**; `border` may remain the internal/industry term in code and technical notes.

---

## 1. Terminology decision

### Overall feature: **Tile Set**

Suggested UI language:

```text
TILE SET
Field · Border · Corner
```

```text
Build one coordinated surface from interior, edge, and corner tiles.
```

### Role names

| User-facing role | Industry term | Purpose |
|---|---|---|
| Field | Field tile | Primary tile covering the interior/largest area |
| Edge | Border tile | Repeating strip that defines an outer edge |
| Corner | Corner tile | Transition tile joining two perpendicular borders |

Use `Field`, `Edge`, and `Corner` in the UI. “Body” is understandable conversationally, but `Field Tile` is the standard term and distinguishes the tile role from the ceramic body/material. Keep `border` only as an internal identifier where renaming it would reduce clarity or create migration churn.

### Proposed Repeat subfeature names

- **Tile Turn** — composes orientation of Field tiles inside a Repeat Block.
- **Field Layout** — Straight, Brick, Half-Drop placement of the completed Field Repeat Block.
- **Border Run** — controls how Border tiles repeat, align, and turn around each side.
- **Corner Join** — controls how the Corner tile rotates or maps into the four frame corners.
- **Set Preview** — shows Field, Border, and Corner rendered as one composition.

These labels are working names inside Plan 3. They can be shortened later without changing the architecture.

---

## 2. Reference-image interpretation

The supplied image contains three visibly distinct square tile roles:

### 2.1 Field tile

The central 2×2 interior uses a square motif with:

- brown radial floral center;
- blue edge/corner structures;
- green and ochre corner accents;
- pale peach shared ground.

It fills the main surface. Its neighboring copies meet to form larger blue and green motifs across seams.

### 2.2 Border tile

The top strip uses a second ornamental tile with a horizontal gold motif. The same design appears along the right side after a 90° rotation.

This indicates:

- a single Border source can populate multiple sides through rotation;
- Border repetition has a linear rhythm and phase;
- Border ends must meet Corner tiles coherently;
- border orientation depends on which side it occupies.

### 2.3 Corner tile

The top-right uses a third, distinct tile whose motif bends through the corner and joins the horizontal top Border to the vertical right Border.

This indicates:

- Corner is not merely a rotated Field or Border tile;
- it has two adjacent connection edges;
- one Corner source may be rotated into all four corners if its handedness permits;
- a mirrored or per-corner override may eventually be required for chiral/asymmetric designs.

### 2.4 Continuity relationships

The product must help preserve four kinds of continuity:

1. Field ↔ Field
2. Field ↔ Border
3. Border ↔ Border along one side
4. Border ↔ Corner at a 90° turn

The tool should show these joins explicitly. It must not claim continuity is valid merely because all tiles share dimensions.

---

## 3. Product model

### 3.1 Tile Set project

```ts
type TileRole = "field" | "border" | "corner";

interface TileRoleAsset {
  role: TileRole;
  source: BrowserLocalImage;
  crop: RoleCropState;
  appearance: RoleAppearanceState;
  status: "empty" | "editing" | "ready";
}

interface TileSetState {
  roles: Record<TileRole, TileRoleAsset | null>;
  shared: TileSetSharedSettings;
  fieldComposition: FieldCompositionState;
  borderComposition: BorderCompositionState;
  cornerComposition: CornerCompositionState;
}
```

### 3.2 Role requirements

Recommended validation:

- Field is required for ordinary repeating-pattern export.
- Border is optional.
- Corner is optional when Border is absent.
- When Border is present and a closed frame is requested, Corner becomes required unless the user explicitly chooses an automatic miter/overlap fallback.
- Do not silently substitute a rotated Border as Corner; make that an explicit fallback option.

### 3.3 Shared target geometry

All roles in a Tile Set should resolve to the same target tile dimensions by default:

- same square output size;
- same pixel density;
- same grout baseline;
- same physical-scale interpretation when real measurements are later added.

Role-specific source images and crop geometry remain independent.

---

## 4. Crop information architecture

### 4.1 One persistent Crop workspace

Extend Plan 1 rather than creating separate Crop pages.

Persistent Crop shell:

```text
┌ App navigation ──────────────────────────────────────────────┐
├ Source/file bar ─────────────────────────────────────────────┤
│ Tile Set roles │ Icon dock │ Persistent role canvas │ Options │
│ Field          │           │                        │ Seam    │
│ Border         │           │                        │ Joins   │
│ Corner         │           │                        │         │
├ Set strip / completion status ─────── Continue to Repeat ───┤
```

Switching Field/Border/Corner changes only the active role being edited. It must not:

- navigate to another Crop page;
- unmount the workspace shell;
- hide Continue;
- discard edits in other roles;
- reset the selected Crop tool unexpectedly.

### 4.2 Tile Set role switcher

The role switcher displays:

- role icon;
- role name;
- source thumbnail;
- completion state;
- warning state for missing/invalid geometry;
- Replace/Remove role actions under a contextual menu.

Suggested icons:

- Field: filled 3×3 center grid
- Border: highlighted edge strip
- Corner: highlighted L/corner

Hit targets remain ≥44×44 px.

### 4.3 Source intake

Support two intake paths:

#### Separate files

Upload one file per role.

#### One source sheet

Use the same uploaded photograph/sheet and create three independent role selections from it:

- `Add Field from this source`
- `Add Border from this source`
- `Add Corner from this source`

Each role stores its own Lasso, Warp, and Background Removal state even when the source file is shared.

Do not duplicate the underlying image bytes unnecessarily; reference the same browser-local source object where possible.

### 4.4 Role-specific Crop tools

Every role supports the Crop tools defined in Plan 1:

- Lasso/select tile
- Warp to square
- Remove background
- Rotate source
- Flip source
- Reset role crop

But tool state is role-local:

- moving Field Lasso does not move Border Lasso;
- resetting Corner does not reset Field;
- switching roles preserves each role’s active selection and warp.

### 4.5 Shared Crop tools

Some changes should be applicable at set level through explicit actions:

- target output dimensions;
- shared checkerboard/background preview;
- shared color-grade preset;
- grout color/width preview;
- apply selected appearance setting to all roles.

Never apply role-specific background color removal to every tile silently. Provide an explicit `Apply to all roles` action where appropriate.

---

## 5. Editing into “one look”

“Harmoniously edited into one look” should be implemented as two layers rather than destructive automatic matching.

### 5.1 Role-level edits

Each Field, Border, and Corner role keeps independent:

- source crop;
- perspective warp;
- orientation correction;
- background mask;
- per-role fine adjustment.

### 5.2 Set-level shared appearance

A shared non-destructive `Set Look` applies consistently after each role’s local corrections.

Proposed initial controls:

- exposure/brightness;
- contrast;
- saturation;
- temperature/tint or a simpler warmth control;
- shared background/grout preview;
- optional palette swatch reference.

Architecture:

```text
role source
  → role crop/warp/mask
  → role fine appearance
  → shared Set Look
  → role compositor
```

Do not promise automatic color harmony or AI palette matching in the initial implementation. A later plan may add palette extraction and match suggestions.

### 5.3 Apply-to-all behavior

For each compatible appearance control:

- default: edit shared Set Look;
- optional: unlink a role for fine correction;
- visible linked/unlinked status;
- `Reset Set Look` does not erase role geometry.

This gives cohesion while preserving the ability to correct inconsistent source photography.

---

## 6. Crop continuity previews

### 6.1 Field seam check

Existing 2×2 field seam preview remains, fed only by the active Field role.

### 6.2 Border run check

Show a 1×3 or 1×4 horizontal Border run:

```text
[B][B][B][B]
```

Also offer a vertical preview generated by rotating the same Border role.

### 6.3 Border–Corner join check

Show an L-shaped diagnostic:

```text
[B][B][C]
      [B]
      [B]
```

This preview should make it easy to inspect whether motif lines/colors meet at the corner.

### 6.4 Field–Border join check

Show at least one strip of Field tiles adjacent to Border:

```text
[B][B][B]
[F][F][F]
```

### 6.5 Combined mini-set preview

Always provide a small combined preview with:

- minimum 2×2 Field interior;
- top/right/bottom/left Border;
- four Corners.

This preview remains visible regardless of active role when space permits, or appears in a persistent Set Preview disclosure on mobile.

---

## 7. Repeat information architecture

Plan 2’s Tile Turn remains focused on Field tiles. Add role-aware Repeat controls instead of forcing Border and Corner through the same model.

### 7.1 Field composition

Field uses:

- Tile Turn
- 2×2 Repeat Block
- Field Layout: Straight, Brick, Half-Drop
- optional Advanced Symmetry

### 7.2 Border Run

Border needs linear composition rather than a 2×2 metatile by default.

Controls:

- side assignment: all sides or selected sides;
- repeat direction;
- tile orientation along horizontal sides;
- automatic 90° rotation on vertical sides;
- phase/offset along the border;
- gap/grout;
- alternate rotation toggle;
- reverse direction;
- fit mode: repeat, stretch spacing, centered remainder.

Do not stretch the artwork itself to fit unless explicitly selected. Prefer whole tiles plus controlled spacing/cropping.

### 7.3 Corner Join

Controls:

- source Corner orientation for top-left baseline;
- rotate into all four corners;
- optional per-corner override;
- allow mirror only when explicitly enabled;
- corner inset/alignment;
- join guides showing which Corner edges connect to Border ends.

Default mapping should be deterministic and documented.

Example rotation convention, subject to visual confirmation:

```text
Top-left:     0°
Top-right:   90°
Bottom-right:180°
Bottom-left:270°
```

The exact baseline depends on the uploaded source orientation and should be set through a `This is…` corner-orientation selector.

### 7.4 Set Preview

The main Repeat output can switch between:

- Field only
- Border strip
- Corner join
- Full framed set

`Full framed set` should be the primary review mode once Border and Corner exist.

Role editing and combined review must not be different pages. Use role selectors or canvas view modes inside one Repeat workspace.

---

## 8. Frame geometry and renderer

### Task 1: Add Tile Set role state

**Objective:** Replace the single source/crop assumption with browser-local role assets.

**Files:**
- Modify: `src/app/state.ts`
- Modify: `src/app/state.test.ts`
- Modify: `src/app/App.tsx`

**TDD steps:**

1. Add failing tests for empty/partial/complete Tile Set states.
2. Add failing tests for independent role Crop edits.
3. Add failing tests for shared source references with independent role geometry.
4. Add failing tests for removing a role without affecting others.
5. Implement minimal role state.

**Commit:** `refactor: introduce tile set role assets`

### Task 2: Create role-aware rectified tile cache

**Objective:** Produce independent rectified Field, Border, and Corner canvases efficiently.

**Files:**
- Modify: `src/engine/renderer.ts`
- Create recommended: `src/engine/tileSet.ts`
- Create: `src/engine/tileSet.test.ts`

**Contract:**

```ts
interface RectifiedTileSet {
  field?: HTMLCanvasElement;
  border?: HTMLCanvasElement;
  corner?: HTMLCanvasElement;
}
```

Cache keys must include:

- role source identity;
- crop/warp geometry;
- background removal;
- role appearance;
- Set Look.

Do not rerender all roles when only one role geometry changes unless Set Look changes.

**Commit:** `feat: render rectified tile set roles`

### Task 3: Add framed-set geometry

**Objective:** Compute the placement of Field, Border, and Corner tiles for any rectangular interior size.

**Files:**
- Create: `src/engine/frameLayout.ts`
- Create: `src/engine/frameLayout.test.ts`

**Proposed contract:**

```ts
interface FrameLayoutInput {
  fieldColumns: number;
  fieldRows: number;
  tileSize: number;
  borderEnabled: boolean;
  cornerEnabled: boolean;
  borderPhase: number;
}

interface TilePlacement {
  role: TileRole;
  x: number;
  y: number;
  rotation: 0 | 90 | 180 | 270;
  side?: "top" | "right" | "bottom" | "left";
  corner?: "top-left" | "top-right" | "bottom-right" | "bottom-left";
}
```

**TDD acceptance:**

- 2×2 interior with frame produces 4 Field, 8 Border, and 4 Corner placements if each side spans two Border tiles;
- no duplicated corner/edge positions;
- vertical Borders rotate correctly;
- Corner rotations follow the chosen baseline;
- layout dimensions are exact;
- Field Layout offsets remain inside the interior and do not move the outer frame.

**Commit:** `feat: compute field border corner frame layouts`

### Task 4: Render the full Tile Set

**Objective:** Draw Field composition, Border runs, and Corners into one output canvas.

**Files:**
- Modify: `src/engine/renderer.ts`
- Modify or create: `src/engine/renderer.test.ts`

**Rendering order:**

1. background/grout;
2. Field interior;
3. Borders;
4. Corners;
5. guides/diagnostics.

Use exact integer or device-pixel-aligned placement where possible to avoid false seams.

**TDD steps:**

1. Use role fixtures with distinct colors/signatures.
2. Verify correct role appears in every expected zone.
3. Verify rotations through pixel signatures.
4. Verify transparency and shared Set Look.
5. Verify disabling Border/Corner returns Field-only output.

**Commit:** `feat: render coordinated tile sets`

---

## 9. Crop UI tasks

### Task 5: Add persistent Tile Set role selector

**Objective:** Switch role context without switching pages or losing edits.

**Files:**
- Create: `src/app/TileSetRoles.tsx`
- Create: `src/app/TileSetRoles.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/styles.css`

**TDD steps:**

1. Render Field/Border/Corner role buttons without numbering.
2. Upload distinct sources per role.
3. Switch roles and verify canvas source/state changes.
4. Return to prior role and verify geometry is preserved.
5. Assert Continue remains visible across all roles and Crop tools.

**Commit:** `feat: add crop tile set role selector`

### Task 6: Add shared-source role extraction

**Objective:** Extract multiple tile roles from one source photograph/sheet.

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/state.ts`
- Modify: relevant tests

**TDD steps:**

1. Upload one sheet.
2. Create Field and Border roles from the same source.
3. Move Field Lasso.
4. Assert Border Lasso does not change.
5. Replace shared source and define explicit behavior: all referencing roles should show a confirmation before replacement.

**Commit:** `feat: extract multiple roles from one source`

### Task 7: Add role-specific continuity diagnostics

**Objective:** Show the correct seam/join preview for the active role.

**Files:**
- Create: `src/app/TileSetDiagnostics.tsx`
- Create: `src/app/TileSetDiagnostics.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/styles.css`

Active diagnostics:

- Field: 2×2 seam check
- Border: border run + Field–Border join
- Corner: L-shaped Border–Corner join
- Set: combined mini-frame

The diagnostic panel changes content, but the Crop canvas and global action bar remain mounted.

**Commit:** `feat: add tile set continuity diagnostics`

---

## 10. Repeat UI tasks

### Task 8: Add Field/Border/Corner composition modes

**Objective:** Give each role the right Repeat controls while maintaining one Repeat workspace.

**Files:**
- Create: `src/app/TileSetComposer.tsx`
- Create: `src/app/BorderRun.tsx`
- Create: `src/app/CornerJoin.tsx`
- Create corresponding tests
- Modify: `src/app/App.tsx`
- Modify: `src/styles.css`

Tabs or segmented controls:

- Field
- Border
- Corner
- Set

These are role views, not sequential steps. Do not number them.

**TDD steps:**

1. Field view displays Tile Turn and Field Layout.
2. Border view displays Border Run controls.
3. Corner view displays Corner Join controls.
4. Set view displays combined frame controls.
5. Switching views preserves all role composition state.
6. Main canvas changes view but remains in the same workspace.

**Commit:** `feat: add role-aware repeat composition`

### Task 9: Add Border Run controls

**Objective:** Repeat one Border role coherently along horizontal and vertical sides.

**Files:**
- Modify: `src/app/BorderRun.tsx`
- Modify: `src/engine/frameLayout.ts`
- Add tests

**TDD acceptance:**

- top and bottom use horizontal orientation;
- left and right rotate by 90° according to convention;
- reverse/alternate controls are deterministic;
- phase changes do not distort artwork;
- Undo/Redo captures Border Run changes.

**Commit:** `feat: compose repeating border runs`

### Task 10: Add Corner Join controls

**Objective:** Map a Corner tile into all four corners and support explicit overrides.

**Files:**
- Modify: `src/app/CornerJoin.tsx`
- Modify: `src/engine/frameLayout.ts`
- Add tests

**TDD acceptance:**

- one source Corner rotates consistently into four positions;
- selected baseline corner is clear;
- optional mirror is off by default;
- per-corner override changes only one corner;
- Undo/Redo captures changes.

**Commit:** `feat: configure corner joins`

### Task 11: Add Set Preview and frame dimensions

**Objective:** Review the roles together as the final product composition.

**Files:**
- Modify: `src/app/TileSetComposer.tsx`
- Modify: `src/engine/renderer.ts`
- Modify: `e2e/app.spec.ts`

Controls:

- interior rows/columns;
- frame on/off;
- sides enabled;
- grout width/color;
- preview dimensions/aspect;
- role guides;
- join diagnostics toggle.

The final Export source should be the Set Preview when Set mode is active.

**Commit:** `feat: preview complete framed tile sets`

---

## 11. Shared Set Look

### Task 12: Add non-destructive shared appearance settings

**Objective:** Make Field, Border, and Corner read as one coordinated visual family.

**Files:**
- Create: `src/engine/appearance.ts`
- Create: `src/engine/appearance.test.ts`
- Create: `src/app/SetLook.tsx`
- Create: `src/app/SetLook.test.tsx`
- Modify renderer/state

Initial settings should remain minimal:

- brightness;
- contrast;
- saturation;
- warmth.

Use deterministic pixel transforms and clamp safely.

**TDD steps:**

1. Apply Set Look to all three role fixtures.
2. Assert each role changes consistently.
3. Assert role geometry and alpha remain unchanged.
4. Reset Set Look and verify exact restoration.
5. Add per-role unlink only if necessary after usability review; avoid premature complexity.

**Commit:** `feat: apply a shared look across tile roles`

---

## 12. Undo/Redo and project integrity

### Task 13: Extend history across role composition

**Objective:** Include Field, Border, Corner, and Set Look changes in predictable history scopes.

Recommended history model:

- Crop history: future planning decision; not automatically inherited from Repeat history.
- Repeat history: snapshots composition state across Field, Border, Corner, and Set Preview.
- Source upload/removal: confirmation-based, not mixed into fine-grained Repeat history initially.

Test:

1. Change Field Tile Turn.
2. Change Border phase.
3. Change Corner rotation.
4. Undo three times in correct order.
5. Redo three times.
6. New change after Undo clears Redo.

---

## 13. Responsive design

### Desktop: 1440×1024

- Role selector stays visible.
- Main canvas remains dominant.
- Diagnostics/Set Preview do not squeeze canvas below a useful size.
- Crop tool dock from Plan 1 remains compact.
- Continue to Repeat stays in the persistent action bar.
- Repeat role views remain one workspace.

### Mobile: 390×844

Recommended hierarchy:

1. compact role strip: Field / Border / Corner;
2. main role canvas;
3. icon tool dock;
4. contextual tool options bottom sheet;
5. continuity preview disclosure;
6. sticky Continue action.

Repeat mobile:

1. canvas/Set Preview;
2. role view selector;
3. role-specific controls;
4. Set Look and advanced sections collapsed.

No horizontal document overflow. All hit targets ≥44×44.

---

## 14. End-to-end verification scenarios

### Scenario A: Three separate uploads

1. Upload Field image.
2. Upload Border image.
3. Upload Corner image.
4. Crop/warp each independently.
5. Switch roles repeatedly and verify state preservation.
6. Continue to Repeat from every role view.

### Scenario B: One shared source sheet

1. Upload one sheet containing three tile designs.
2. Extract independent Field, Border, and Corner selections.
3. Verify source bytes are shared but geometry is independent.
4. Render combined set.

### Scenario C: Border rotation

1. Configure one Border tile.
2. Preview top, right, bottom, left.
3. Verify right/left sides rotate correctly.
4. Verify no artwork stretching.

### Scenario D: Corner continuity

1. Configure Corner baseline orientation.
2. Render four corners.
3. Verify each joins the expected Border side.
4. Apply one corner override and verify only that corner changes.

### Scenario E: Shared look

1. Use three source photos with visibly different exposure.
2. Apply Set Look.
3. Verify all roles receive the same non-destructive adjustment.
4. Verify alpha, crop, and warp remain unchanged.

### Scenario F: Full downstream export

1. Build custom Field Tile Turn block.
2. Select Field Layout.
3. Configure Border Run.
4. Configure Corner Join.
5. Open Set Preview.
6. Export PNG.
7. Verify output contains correct Field, Border, Corner counts and rotations.

---

## 15. Risks and open decisions

1. **One Corner source may not fit every corner:** chiral motifs may require mirrors or separate left/right corner variants. Start with rotation, expose explicit override, and do not auto-mirror silently.
2. **Border phase at unequal dimensions:** frame side lengths may not divide evenly by tile size. Define repeat/spacing/crop behavior explicitly.
3. **Field Layout versus fixed frame:** Brick/Half-Drop interior offsets must clip within the frame without shifting Borders.
4. **Continuity detection:** visual join previews are required; automatic seam scoring is a separate feature and should not be implied.
5. **Shared Set Look:** consistent adjustments can improve cohesion but cannot guarantee artistic harmony. Avoid automated aesthetic claims.
6. **Source-sheet memory:** reuse decoded images and cache role rectifications to avoid tripling memory.
7. **Role terminology:** use Field/Border/Corner consistently; explain Field once as the interior/body tile.
8. **Optional roles:** Field-only remains supported. Border-without-Corner needs an explicit fallback or warning.
9. **Physical sizing:** this plan assumes equal square roles. Rectangular border formats or different physical sizes require another geometry plan.
10. **Scope control:** do not add AI palette matching, freehand masks, vector tracing, edge-matching solvers, or Wang-tile generation in this build unless later approved.

---

## 16. Files likely to change

### Existing

- `src/app/App.tsx`
- `src/app/App.test.tsx`
- `src/app/state.ts`
- `src/app/state.test.ts`
- `src/engine/renderer.ts`
- `src/engine/geometry.ts`
- `src/styles.css`
- `e2e/app.spec.ts`
- `scripts/verify-ui.mjs`
- `README.md`

### Recommended new files

- `src/engine/tileSet.ts`
- `src/engine/tileSet.test.ts`
- `src/engine/frameLayout.ts`
- `src/engine/frameLayout.test.ts`
- `src/engine/appearance.ts`
- `src/engine/appearance.test.ts`
- `src/app/TileSetRoles.tsx`
- `src/app/TileSetRoles.test.tsx`
- `src/app/TileSetDiagnostics.tsx`
- `src/app/TileSetDiagnostics.test.tsx`
- `src/app/TileSetComposer.tsx`
- `src/app/TileSetComposer.test.tsx`
- `src/app/BorderRun.tsx`
- `src/app/BorderRun.test.tsx`
- `src/app/CornerJoin.tsx`
- `src/app/CornerJoin.test.tsx`
- `src/app/SetLook.tsx`
- `src/app/SetLook.test.tsx`

---

## 17. Consolidation with Plans 1 and 2

Merge before implementation:

1. Crop designer tools:
   `/Users/rodneyestrada/repeatfield/.hermes/plans/2026-08-27_151312-crop-workspace-designer-tools.md`
2. Tile Turn and Field Layout:
   `/Users/rodneyestrada/repeatfield/.hermes/plans/2026-08-27_152834-orientation-composer-field-layout.md`
3. This Tile Set plan.

Combined conceptual hierarchy:

```text
PROJECT
└── TILE SET
    ├── FIELD
    │   ├── Crop tools
    │   ├── Tile Turn
    │   └── Field Layout
    ├── BORDER
    │   ├── Crop tools
    │   └── Border Run
    ├── CORNER
    │   ├── Crop tools
    │   └── Corner Join
    ├── SET LOOK
    └── SET PREVIEW / EXPORT
```

Recommended consolidated build order:

1. Tile Set state and source model
2. Crop icon workspace and role switcher
3. Independent role crop/warp/mask
4. Role rectification cache
5. Tile Turn and metatile renderer
6. Field Layout
7. Frame geometry
8. Border Run
9. Corner Join
10. Set Look
11. Set Preview
12. Undo/Redo integration
13. Preview/export
14. responsive/accessibility QA
15. local visual approval
16. public release

---

## 18. Final acceptance checklist

- [ ] Overall feature is named Tile Set.
- [ ] Roles are Field, Border, and Corner.
- [ ] One source sheet or separate uploads are supported.
- [ ] Each role has independent Crop/Lasso/Warp/Background state.
- [ ] Switching roles does not switch Crop pages or discard edits.
- [ ] Continue to Repeat remains persistently available.
- [ ] Field has Tile Turn and Field Layout.
- [ ] Border has Border Run controls.
- [ ] Corner has Corner Join controls.
- [ ] One Border source can rotate around horizontal and vertical sides.
- [ ] One Corner source maps deterministically to four corners, with explicit overrides.
- [ ] Field–Field, Field–Border, Border–Border, and Border–Corner joins can be previewed.
- [ ] Set Look applies shared non-destructive appearance adjustments.
- [ ] Set Preview combines all roles into one frame.
- [ ] Export uses the same composed Tile Set shown in Preview.
- [ ] Field-only projects remain valid.
- [ ] Missing Corner with enabled closed Border produces an explicit warning/fallback choice.
- [ ] Desktop and mobile have no horizontal overflow.
- [ ] No implementation or deployment occurs until all planning is consolidated and approved.
