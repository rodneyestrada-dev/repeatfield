import {
  appReducer,
  createProject,
  deserializeProject,
  isProjectDirty,
  serializeProject,
  validateFieldTile,
  validateTessellate,
  validateTileSet,
  DEFAULT_PREVIEW_SCENE,
  INITIAL_STATE,
  type AppState,
  type FieldTileProject,
  type TessellateProject,
  type TileSetProject,
} from "./state";
import { validateExport, exportFilename } from "../engine/export";
import { normalizeMetatile } from "../engine/metatile";

const transforms = (...rotations: number[]) =>
  normalizeMetatile({ cells: rotations }).cells;

const fieldTile = (): AppState =>
  appReducer(INITIAL_STATE, { type: "create-project", workflow: "field-tile" });
const tileSet = (): AppState =>
  appReducer(INITIAL_STATE, { type: "create-project", workflow: "tile-set" });
const tessellate = (): AppState =>
  appReducer(INITIAL_STATE, { type: "create-project", workflow: "tessellate" });

// ---------------------------------------------------------------------------
// Workflow discriminator
// ---------------------------------------------------------------------------

test("projects are created per workflow with the discriminator stored", () => {
  expect(fieldTile().project?.workflow).toBe("field-tile");
  expect(tileSet().project?.workflow).toBe("tile-set");
  expect(tessellate().project?.workflow).toBe("tessellate");
  expect(INITIAL_STATE.project).toBeNull();
});

test("one workflow's project never satisfies another workflow's validator", () => {
  const ft = createProject("field-tile");
  const ts = createProject("tile-set");
  const te = createProject("tessellate");
  expect(validateFieldTile(ft)).toBe(true);
  expect(validateFieldTile(ts)).toBe(false);
  expect(validateFieldTile(te)).toBe(false);
  expect(validateTileSet(ft)).toBe(false);
  expect(validateTessellate(ft)).toBe(false);
});

test("stage changes are constrained to the active workflow's own sequence", () => {
  let s = fieldTile();
  s = appReducer(s, { type: "set-stage", stage: "repeat" });
  expect(s.project?.stage).toBe("repeat");
  // tile-set stages are invalid for field-tile
  const rejected = appReducer(s, { type: "set-stage", stage: "compose" });
  expect(rejected.project?.stage).toBe("repeat");
});

test("projects round-trip through persistence with the workflow discriminator", () => {
  for (const workflow of ["field-tile", "tile-set", "tessellate"] as const) {
    const project = createProject(workflow);
    const restored = deserializeProject(serializeProject(project));
    expect(restored).toEqual(project);
  }
  expect(deserializeProject(null)).toBeNull();
  expect(deserializeProject("not json")).toBeNull();
  expect(deserializeProject('{"project":{"workflow":"bogus"}}')).toBeNull();
});

test("legacy scalar metatile snapshots hydrate to explicit transforms", () => {
  const legacy = createProject("field-tile") as FieldTileProject;
  (legacy.composition.metatile as unknown as { cells: number[] }).cells = [0, 1, 2, 3];
  const restored = deserializeProject(JSON.stringify({ version: 3, project: legacy })) as FieldTileProject;
  expect(restored.composition.metatile.cells).toEqual([
    { rotation: 0, flipX: false, flipY: false },
    { rotation: 1, flipX: false, flipY: false },
    { rotation: 2, flipX: false, flipY: false },
    { rotation: 3, flipX: false, flipY: false },
  ]);
});

test("field hydration tolerates malformed legacy history arrays without discarding the project", () => {
  const legacy = createProject("field-tile") as FieldTileProject;
  (legacy as unknown as { history: unknown }).history = { past: null, future: "broken" };
  const restored = deserializeProject(JSON.stringify({ version: 3, project: legacy })) as FieldTileProject;
  expect(restored).not.toBeNull();
  expect(restored.history).toEqual({ past: [], future: [] });
});

// ---------------------------------------------------------------------------
// Phase 1.5 — framed-poster scene state
// ---------------------------------------------------------------------------

test("legacy projects without scene state hydrate poster defaults", () => {
  const legacy = createProject("field-tile") as FieldTileProject;
  delete (legacy as unknown as { scene?: unknown }).scene;
  const restored = deserializeProject(JSON.stringify({ version: 3, project: legacy })) as FieldTileProject;
  expect(restored.scene).toEqual(DEFAULT_PREVIEW_SCENE);
});

test("scene hydration clamps out-of-range and bogus persisted values", () => {
  const legacy = createProject("field-tile") as FieldTileProject;
  (legacy as unknown as { scene: unknown }).scene = {
    mode: "billboard",
    posterZoom: 99,
    posterOffsetX: -99,
    posterOffsetY: Number.NaN,
  };
  const restored = deserializeProject(JSON.stringify({ version: 3, project: legacy })) as FieldTileProject;
  expect(restored.scene.mode).toBe("clean");
  expect(restored.scene.posterZoom).toBe(2.2);
  expect(restored.scene.posterOffsetX).toBe(-0.6);
  expect(restored.scene.posterOffsetY).toBe(0);
});

test("scene changes are presentation-only: no undo history, not dirty, but persisted", () => {
  let s = fieldTile();
  s = appReducer(s, { type: "field-scene", key: "mode", value: "poster" });
  s = appReducer(s, { type: "field-scene", key: "posterZoom", value: 1.6 });
  const project = s.project as FieldTileProject;
  expect(project.scene.mode).toBe("poster");
  expect(project.scene.posterZoom).toBe(1.6);
  expect(project.history.past).toHaveLength(0);
  expect(isProjectDirty(project)).toBe(false);
  const restored = deserializeProject(serializeProject(project)) as FieldTileProject;
  expect(restored.scene).toEqual(project.scene);
});

test("scene reducer clamps zoom and pan to the poster control ranges", () => {
  let s = fieldTile();
  s = appReducer(s, { type: "field-scene", key: "posterZoom", value: 9 });
  s = appReducer(s, { type: "field-scene", key: "posterOffsetX", value: -9 });
  const project = s.project as FieldTileProject;
  expect(project.scene.posterZoom).toBe(2.2);
  expect(project.scene.posterOffsetX).toBe(-0.6);
});

test("fresh projects are untouched while geometry and asset edits are meaningful", () => {
  const fresh = createProject("field-tile");
  expect(isProjectDirty(fresh)).toBe(false);
  const tileSetFresh = createProject("tile-set") as TileSetProject;
  const tessellateFresh = createProject("tessellate") as TessellateProject;
  expect(isProjectDirty(tileSetFresh)).toBe(false);
  expect(isProjectDirty(tessellateFresh)).toBe(false);
  expect(tileSetFresh.roles.field.asset?.type).toBe("image/png");
  expect(tessellateFresh.sourceAsset?.type).toBe("image/png");
  const edited = appReducer({ project: fresh }, {
    type: "crop-set-corner", index: 0, point: { x: 0.2, y: 0.2 },
  }).project!;
  expect(isProjectDirty(edited)).toBe(true);
  const uploaded = appReducer({ project: fresh }, {
    type: "set-field-asset",
    asset: { id: "asset-a", name: "private.png", type: "image/png", kind: "indexeddb" },
  }).project!;
  expect(isProjectDirty(uploaded)).toBe(true);
});

// ---------------------------------------------------------------------------
// Crop: selection vs warp separation
// ---------------------------------------------------------------------------

test("moving the selection never alters warp state and vice versa", () => {
  let s = fieldTile();
  const before = (s.project as FieldTileProject).crop;
  s = appReducer(s, {
    type: "crop-set-corner",
    index: 0,
    point: { x: 0.3, y: 0.3 },
  });
  let crop = (s.project as FieldTileProject).crop;
  expect(crop.selectionQuad[0]).toEqual({ x: 0.3, y: 0.3 });
  expect(crop.warpQuad).toEqual(before.warpQuad);
  s = appReducer(s, {
    type: "crop-set-warp-pin",
    index: 2,
    point: { x: 0.7, y: 0.9 },
  });
  crop = (s.project as FieldTileProject).crop;
  expect(crop.warpQuad[2]).toEqual({ x: 0.7, y: 0.9 });
  expect(crop.selectionQuad[0]).toEqual({ x: 0.3, y: 0.3 });
});

test("crop corner drag resizes as a rectangle: adjacent corners follow, shape never skews", () => {
  let s = fieldTile();
  // Drag TL toward the centre: BR stays anchored; TR/BL keep square corners.
  s = appReducer(s, {
    type: "crop-set-corner",
    index: 0,
    point: { x: 0.3, y: 0.35 },
  });
  const quad = (s.project as FieldTileProject).crop.selectionQuad;
  expect(quad[0]).toEqual({ x: 0.3, y: 0.35 });   // dragged corner
  expect(quad[2]).toEqual({ x: 0.88, y: 0.88 });  // opposite stays anchored
  expect(quad[1]).toEqual({ x: 0.88, y: 0.35 });  // adjacent follows on y
  expect(quad[3]).toEqual({ x: 0.3, y: 0.88 });   // adjacent follows on x
  // Rectangularity invariant: sides stay axis-parallel.
  expect(quad[1].y).toBe(quad[0].y);
  expect(quad[3].x).toBe(quad[0].x);
  // A second drag of an adjacent corner keeps the rectangle too.
  s = appReducer(s, {
    type: "crop-set-corner",
    index: 1,
    point: { x: 0.7, y: 0.4 },
  });
  const q2 = (s.project as FieldTileProject).crop.selectionQuad;
  expect(q2[1]).toEqual({ x: 0.7, y: 0.4 });
  expect(q2[0]).toEqual({ x: 0.3, y: 0.4 });      // TL follows on y
  expect(q2[3]).toEqual({ x: 0.3, y: 0.88 });
  expect(q2[2]).toEqual({ x: 0.7, y: 0.88 });     // BR follows on x
});

test("crop corner drag clamps against the opposite corner (no collapse or flip)", () => {
  let s = fieldTile();
  s = appReducer(s, {
    type: "crop-set-corner",
    index: 2,
    point: { x: 0.13, y: 0.9 },
  });
  const quad = (s.project as FieldTileProject).crop.selectionQuad;
  // BR dragged past TL on x: pinned at MIN_SPAN beside the anchor.
  expect(quad[2].x).toBeCloseTo(0.13);
  expect(quad[2].x - quad[0].x).toBeGreaterThanOrEqual(0.009);
  expect(quad[1].x).toBe(quad[2].x);
  expect(quad[3].x).toBe(quad[0].x);
});

test.each([
  ["past the opposite corner", { x: 0.95, y: 0.95 }],
  ["near the opposite corner", { x: 0.879999, y: 0.120001 }],
  ["inside the existing rectangle", { x: 0.5, y: 0.5 }],
])("crop corner drag %s remains an axis-aligned non-zero rectangle", (_name, point) => {
  const state = fieldTile();
  const next = appReducer(state, { type: "crop-set-corner", index: 0, point });
  const [tl, tr, br, bl] = (next.project as FieldTileProject).crop.selectionQuad;
  expect(tr.y).toBe(tl.y);
  expect(bl.x).toBe(tl.x);
  expect(br.x).toBe(tr.x);
  expect(br.y).toBe(bl.y);
  expect(Math.abs(br.x - tl.x)).toBeGreaterThanOrEqual(0.009);
  expect(Math.abs(br.y - tl.y)).toBeGreaterThanOrEqual(0.009);
});

test("warp rejects crossed and singular pin edits and preserves the last valid quad", () => {
  const state = fieldTile();
  const before = (state.project as FieldTileProject).crop.warpQuad;
  for (const point of [{ x: 1.2, y: 1.2 }, { x: 0.999999, y: 0.000001 }]) {
    const next = appReducer(state, { type: "crop-set-warp-pin", index: 0, point });
    expect((next.project as FieldTileProject).crop.warpQuad).toEqual(before);
  }
});

test("whole-selection translation clamps to bounds as one unit", () => {
  let s = fieldTile();
  s = appReducer(s, {
    type: "crop-translate-selection",
    delta: { x: 5, y: 0 },
  });
  const quad = (s.project as FieldTileProject).crop.selectionQuad;
  expect(Math.max(...quad.map((p) => p.x))).toBeLessThanOrEqual(1);
  // side vectors preserved
  expect(quad[1].x - quad[0].x).toBeCloseTo(0.76);
});

test("reset-selection, reset-warp, and reset-crop are independent", () => {
  let s = fieldTile();
  s = appReducer(s, {
    type: "crop-set-corner",
    index: 0,
    point: { x: 0.4, y: 0.4 },
  });
  s = appReducer(s, {
    type: "crop-set-warp-pin",
    index: 0,
    point: { x: 0.2, y: 0.2 },
  });
  const resetWarp = appReducer(s, { type: "crop-reset-warp" });
  expect((resetWarp.project as FieldTileProject).crop.warpQuad[0]).toEqual({
    x: 0,
    y: 0,
  });
  expect(
    (resetWarp.project as FieldTileProject).crop.selectionQuad[0],
  ).toEqual({ x: 0.4, y: 0.4 });
  const resetSelection = appReducer(s, { type: "crop-reset-selection" });
  expect(
    (resetSelection.project as FieldTileProject).crop.selectionQuad[0],
  ).toEqual({ x: 0.12, y: 0.12 });
  expect(
    (resetSelection.project as FieldTileProject).crop.warpQuad[0],
  ).toEqual({ x: 0.2, y: 0.2 });
  const resetAll = appReducer(s, { type: "crop-reset" });
  const crop = (resetAll.project as FieldTileProject).crop;
  expect(crop.selectionQuad[0]).toEqual({ x: 0.12, y: 0.12 });
  expect(crop.warpQuad[0]).toEqual({ x: 0, y: 0 });
});

test("crop tools switch and their option disclosures toggle", () => {
  let s = fieldTile();
  s = appReducer(s, { type: "crop-set-tool", tool: "warp" });
  expect((s.project as FieldTileProject).crop.activeTool).toBe("warp");
  s = appReducer(s, { type: "crop-toggle-options", tool: "warp" });
  expect((s.project as FieldTileProject).crop.openToolOptions).toBe("warp");
  s = appReducer(s, { type: "crop-toggle-options", tool: "warp" });
  expect((s.project as FieldTileProject).crop.openToolOptions).toBeNull();
  s = appReducer(s, { type: "crop-toggle-options", tool: "background" });
  s = appReducer(s, { type: "crop-set-tool", tool: "select" });
  expect((s.project as FieldTileProject).crop.openToolOptions).toBeNull();
});

test("rotate and flip update source orientation", () => {
  let s = fieldTile();
  s = appReducer(s, { type: "crop-rotate" });
  s = appReducer(s, { type: "crop-flip", axis: "x" });
  const crop = (s.project as FieldTileProject).crop;
  expect(crop.rotation).toBe(90);
  expect(crop.flipX).toBe(true);
  expect(crop.flipY).toBe(false);
});

// ---------------------------------------------------------------------------
// Field Tile: Tile Turn + Field Layout + history
// ---------------------------------------------------------------------------

test("reflecting one metatile cell is undoable and preserves its rotation", () => {
  let s = fieldTile();
  s = appReducer(s, { type: "rotate-metatile-cell", index: 2, delta: 1 });
  s = appReducer(s, { type: "reflect-metatile-cell", index: 2, axis: "x" });
  expect((s.project as FieldTileProject).composition.metatile.cells[2]).toEqual({
    rotation: 1,
    flipX: true,
    flipY: false,
  });
  s = appReducer(s, { type: "undo" });
  expect((s.project as FieldTileProject).composition.metatile.cells[2]).toEqual({
    rotation: 1,
    flipX: false,
    flipY: false,
  });
  s = appReducer(s, { type: "redo" });
  expect((s.project as FieldTileProject).composition.metatile.cells[2].flipX).toBe(true);
});

test("rotating one metatile cell leaves the other cells untouched", () => {
  let s = fieldTile();
  s = appReducer(s, { type: "rotate-metatile-cell", index: 1, delta: 1 });
  const cells = (s.project as FieldTileProject).composition.metatile.cells;
  expect(cells).toEqual(transforms(0, 1, 0, 0));
});

test("changing layout never mutates cell orientations", () => {
  let s = fieldTile();
  s = appReducer(s, { type: "rotate-metatile-cell", index: 0, delta: 1 });
  s = appReducer(s, { type: "field-comp", key: "layout", value: "brick" });
  const composition = (s.project as FieldTileProject).composition;
  expect(composition.layout).toBe("brick");
  expect(composition.metatile.cells).toEqual(transforms(1, 0, 0, 0));
});

test("field tile undo and redo cover orientation, layout, and symmetry in order", () => {
  let s = fieldTile();
  s = appReducer(s, { type: "rotate-metatile-cell", index: 0, delta: 1 });
  s = appReducer(s, { type: "field-comp", key: "layout", value: "half-drop" });
  s = appReducer(s, {
    type: "field-comp",
    key: "symmetry",
    value: "mirror-grid",
  });
  s = appReducer(s, { type: "undo" });
  expect((s.project as FieldTileProject).composition.symmetry).toBe("none");
  s = appReducer(s, { type: "undo" });
  expect((s.project as FieldTileProject).composition.layout).toBe("straight");
  s = appReducer(s, { type: "undo" });
  expect(
    (s.project as FieldTileProject).composition.metatile.cells,
  ).toEqual(transforms(0, 0, 0, 0));
  s = appReducer(s, { type: "redo" });
  expect(
    (s.project as FieldTileProject).composition.metatile.cells,
  ).toEqual(transforms(1, 0, 0, 0));
  // a new change after undo clears redo
  s = appReducer(s, { type: "field-comp", key: "gap", value: 12 });
  expect((s.project as FieldTileProject).history.future).toHaveLength(0);
});

test("presets populate editable state rather than locking cells", () => {
  let s = fieldTile();
  s = appReducer(s, {
    type: "apply-metatile-preset",
    cells: transforms(0, 1, 3, 2),
  });
  s = appReducer(s, { type: "rotate-metatile-cell", index: 3, delta: 1 });
  expect(
    (s.project as FieldTileProject).composition.metatile.cells,
  ).toEqual(transforms(0, 1, 3, 3));
});

test("field composition clamps zoom and scale", () => {
  let s = fieldTile();
  s = appReducer(s, { type: "field-comp", key: "sourceZoom", value: 99 });
  s = appReducer(s, { type: "field-comp", key: "tileScale", value: 1 });
  const composition = (s.project as FieldTileProject).composition;
  expect(composition.sourceZoom).toBe(3);
  expect(composition.tileScale).toBe(50);
});

// ---------------------------------------------------------------------------
// Tile Set: roles, isolation of role crop state, history
// ---------------------------------------------------------------------------

test("role crop edits are independent between Field, Edge, and Corner", () => {
  let s = tileSet();
  s = appReducer(s, {
    type: "crop-set-corner",
    index: 0,
    point: { x: 0.3, y: 0.3 },
  });
  s = appReducer(s, { type: "set-active-role", role: "border" });
  s = appReducer(s, {
    type: "crop-set-corner",
    index: 0,
    point: { x: 0.22, y: 0.1 },
  });
  const project = s.project as TileSetProject;
  expect(project.roles.field.crop.selectionQuad[0]).toEqual({
    x: 0.3,
    y: 0.3,
  });
  expect(project.roles.border.crop.selectionQuad[0]).toEqual({
    x: 0.22,
    y: 0.1,
  });
  expect(project.roles.corner.crop.selectionQuad[0]).toEqual({
    x: 0.12,
    y: 0.12,
  });
});

test("switching roles preserves each role's geometry and bundled image status", () => {
  let s = tileSet();
  s = appReducer(s, { type: "role-image", role: "field", hasImage: true });
  s = appReducer(s, { type: "set-active-role", role: "corner" });
  s = appReducer(s, { type: "set-active-role", role: "field" });
  const project = s.project as TileSetProject;
  expect(project.roles.field.hasImage).toBe(true);
  expect(project.roles.corner.hasImage).toBe(true);
  expect(project.activeRole).toBe("field");
});

test("tile set history spans composition, corner overrides, and set look", () => {
  let s = tileSet();
  s = appReducer(s, { type: "tile-set-comp", key: "borderPhase", value: 1 });
  s = appReducer(s, {
    type: "corner-override",
    corner: "top-right",
    rotation: 270,
  });
  s = appReducer(s, { type: "set-look", key: "warmth", value: 30 });
  let project = s.project as TileSetProject;
  expect(project.setLook.warmth).toBe(30);
  expect(project.composition.cornerOverrides["top-right"]).toBe(270);
  s = appReducer(s, { type: "undo" });
  s = appReducer(s, { type: "undo" });
  s = appReducer(s, { type: "undo" });
  project = s.project as TileSetProject;
  expect(project.setLook.warmth).toBe(0);
  expect(project.composition.cornerOverrides).toEqual({});
  expect(project.composition.borderPhase).toBe(0);
  s = appReducer(s, { type: "redo" });
  project = s.project as TileSetProject;
  expect(project.composition.borderPhase).toBe(1);
});

test("reset set look restores identity without touching role geometry", () => {
  let s = tileSet();
  s = appReducer(s, {
    type: "crop-set-corner",
    index: 2,
    point: { x: 0.9, y: 0.9 },
  });
  s = appReducer(s, { type: "set-look", key: "contrast", value: 40 });
  s = appReducer(s, { type: "reset-set-look" });
  const project = s.project as TileSetProject;
  expect(project.setLook.contrast).toBe(0);
  expect(project.roles.field.crop.selectionQuad[2]).toEqual({
    x: 0.9,
    y: 0.9,
  });
});

// ---------------------------------------------------------------------------
// Tessellate: square crop + output families
// ---------------------------------------------------------------------------

test("Tessellate starts with one square-crop source and no selected output family", () => {
  const project = createProject("tessellate") as TessellateProject;
  expect(project.sourceAsset?.id).toBe("bundled-demo-field");
  expect(project.crop.selectionQuad).toEqual([
    { x: 0.12, y: 0.12 },
    { x: 0.88, y: 0.12 },
    { x: 0.88, y: 0.88 },
    { x: 0.12, y: 0.88 },
  ]);
  expect(project.family).toBeNull();
});

test("Tessellate square crop resizing keeps width and height equal", () => {
  let state = tessellate();
  state = appReducer(state, {
    type: "crop-set-square-corner", index: 0, point: { x: 0.3, y: 0.42 },
  });
  const [topLeft, topRight, bottomRight, bottomLeft] = (state.project as TessellateProject).crop.selectionQuad;
  expect(topLeft.x).toBeCloseTo(0.3);
  expect(topLeft.y).toBeCloseTo(0.3);
  expect(topRight.x - topLeft.x).toBeCloseTo(bottomRight.y - topRight.y);
  expect(bottomLeft.x).toBe(topLeft.x);
});

test("Tessellate stores a selected output family and visibly relevant controls", () => {
  let state = tessellate();
  state = appReducer(state, { type: "set-tessellate-family", family: "prism" });
  state = appReducer(state, { type: "tessellate-control", key: "density", value: 7 });
  const project = state.project as TessellateProject;
  expect(project.family).toBe("prism");
  expect(project.controls.density).toBe(7);
  state = appReducer(state, { type: "undo" });
  expect((state.project as TessellateProject).controls.density).toBe(4);
});

// ---------------------------------------------------------------------------
// Isolation and scoping
// ---------------------------------------------------------------------------

test("undo history is scoped per project and cleared by new projects", () => {
  let s = fieldTile();
  s = appReducer(s, { type: "field-comp", key: "gap", value: 30 });
  expect((s.project as FieldTileProject).history.past).toHaveLength(1);
  s = appReducer(s, { type: "create-project", workflow: "tile-set" });
  expect((s.project as TileSetProject).history.past).toHaveLength(0);
  s = appReducer(s, { type: "undo" });
  expect(s.project?.workflow).toBe("tile-set");
});

test("field-tile actions do not leak into tile-set or tessellate projects", () => {
  let s = tileSet();
  const before = s;
  s = appReducer(s, { type: "rotate-metatile-cell", index: 0, delta: 1 });
  expect(s).toBe(before);
  let t = tessellate();
  const beforeT = t;
  t = appReducer(t, { type: "field-comp", key: "gap", value: 10 });
  expect(t).toBe(beforeT);
  // Tessellate now supports its dedicated square crop action.
  t = appReducer(t, {
    type: "crop-set-square-corner",
    index: 0,
    point: { x: 0.5, y: 0.5 },
  });
  expect(t).not.toBe(beforeT);
});

test("history is bounded to fifty snapshots", () => {
  let s = fieldTile();
  for (let value = 1; value <= 60; value++)
    s = appReducer(s, { type: "field-comp", key: "gap", value });
  expect((s.project as FieldTileProject).history.past).toHaveLength(50);
});

// ---------------------------------------------------------------------------
// Export helpers (unchanged contract)
// ---------------------------------------------------------------------------

test("validates export dimensions and filename", () => {
  expect(validateExport(1920, 1080)).toEqual({ width: 1920, height: 1080 });
  expect(() => validateExport(9000, 9000)).toThrow(/pixel budget/i);
  expect(exportFilename("Radial Kaleidoscope", 1920, 1080)).toBe(
    "repeatfield-radial-kaleidoscope-1920x1080.png",
  );
});
