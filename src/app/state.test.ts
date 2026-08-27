import {
  appReducer,
  createProject,
  deserializeProject,
  isProjectDirty,
  serializeProject,
  validateFieldTile,
  validateTessellate,
  validateTileSet,
  INITIAL_STATE,
  type AppState,
  type FieldTileProject,
  type TessellateProject,
  type TileSetProject,
} from "./state";
import { validateExport, exportFilename } from "../engine/export";

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

test("fresh projects are untouched while geometry and asset edits are meaningful", () => {
  const fresh = createProject("field-tile");
  expect(isProjectDirty(fresh)).toBe(false);
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

test.each([
  ["crossed", { x: 0.95, y: 0.95 }],
  ["near-zero-area", { x: 0.879999, y: 0.120001 }],
  ["non-convex", { x: 0.5, y: 0.5 }],
])("crop rejects %s corner edits and preserves the last valid quad", (_name, point) => {
  const state = fieldTile();
  const before = (state.project as FieldTileProject).crop.selectionQuad;
  const next = appReducer(state, { type: "crop-set-corner", index: 0, point });
  expect((next.project as FieldTileProject).crop.selectionQuad).toEqual(before);
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

test("rotating one metatile cell leaves the other cells untouched", () => {
  let s = fieldTile();
  s = appReducer(s, { type: "rotate-metatile-cell", index: 1, delta: 1 });
  const cells = (s.project as FieldTileProject).composition.metatile.cells;
  expect(cells).toEqual([0, 1, 0, 0]);
});

test("changing layout never mutates cell orientations", () => {
  let s = fieldTile();
  s = appReducer(s, { type: "rotate-metatile-cell", index: 0, delta: 1 });
  s = appReducer(s, { type: "field-comp", key: "layout", value: "brick" });
  const composition = (s.project as FieldTileProject).composition;
  expect(composition.layout).toBe("brick");
  expect(composition.metatile.cells).toEqual([1, 0, 0, 0]);
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
  ).toEqual([0, 0, 0, 0]);
  s = appReducer(s, { type: "redo" });
  expect(
    (s.project as FieldTileProject).composition.metatile.cells,
  ).toEqual([1, 0, 0, 0]);
  // a new change after undo clears redo
  s = appReducer(s, { type: "field-comp", key: "gap", value: 12 });
  expect((s.project as FieldTileProject).history.future).toHaveLength(0);
});

test("presets populate editable state rather than locking cells", () => {
  let s = fieldTile();
  s = appReducer(s, {
    type: "apply-metatile-preset",
    cells: [0, 1, 3, 2],
  });
  s = appReducer(s, { type: "rotate-metatile-cell", index: 3, delta: 1 });
  expect(
    (s.project as FieldTileProject).composition.metatile.cells,
  ).toEqual([0, 1, 3, 3]);
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

test("switching roles preserves each role's geometry and image status", () => {
  let s = tileSet();
  s = appReducer(s, { type: "role-image", role: "field", hasImage: true });
  s = appReducer(s, { type: "set-active-role", role: "corner" });
  s = appReducer(s, { type: "set-active-role", role: "field" });
  const project = s.project as TileSetProject;
  expect(project.roles.field.hasImage).toBe(true);
  expect(project.roles.corner.hasImage).toBe(false);
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
// Tessellate: shapes, instances, lattice, history
// ---------------------------------------------------------------------------

test("primary and infill shape slots stay independent", () => {
  let s = tessellate();
  s = appReducer(s, { type: "shape-image", shape: "primary", hasImage: true });
  s = appReducer(s, {
    type: "shape-background",
    shape: "primary",
    key: "tolerance",
    value: 60,
  });
  const project = s.project as TessellateProject;
  expect(project.shapes.primary.hasImage).toBe(true);
  expect(project.shapes.primary.backgroundRemoval.tolerance).toBe(60);
  expect(project.shapes.infill.hasImage).toBe(false);
  expect(project.shapes.infill.backgroundRemoval.tolerance).toBe(28);
});

test("instances can be added, transformed, duplicated conceptually, and removed", () => {
  let s = tessellate();
  s = appReducer(s, {
    type: "add-instance",
    instance: {
      id: "a",
      shapeId: "primary",
      position: { x: 10, y: 10 },
      rotation: 0,
      reflected: false,
    },
  });
  s = appReducer(s, {
    type: "update-instance",
    id: "a",
    patch: { rotation: 90, reflected: true },
  });
  let project = s.project as TessellateProject;
  expect(project.composition.instances[0]).toMatchObject({
    rotation: 90,
    reflected: true,
  });
  expect(project.selectedInstanceId).toBe("a");
  s = appReducer(s, { type: "remove-instance", id: "a" });
  project = s.project as TessellateProject;
  expect(project.composition.instances).toHaveLength(0);
  expect(project.selectedInstanceId).toBeNull();
});

test("tessellate undo restores placements and lattice edits in order", () => {
  let s = tessellate();
  s = appReducer(s, {
    type: "add-instance",
    instance: {
      id: "a",
      shapeId: "primary",
      position: { x: 0, y: 0 },
      rotation: 0,
      reflected: false,
    },
  });
  s = appReducer(s, {
    type: "set-lattice",
    lattice: { u: { x: 200, y: 0 }, v: { x: 0, y: 200 } },
  });
  s = appReducer(s, { type: "undo" });
  let project = s.project as TessellateProject;
  expect(project.composition.lattice.u.x).toBe(320);
  expect(project.composition.instances).toHaveLength(1);
  s = appReducer(s, { type: "undo" });
  project = s.project as TessellateProject;
  expect(project.composition.instances).toHaveLength(0);
});

test("output and grout modes are explicit tessellate settings", () => {
  let s = tessellate();
  s = appReducer(s, {
    type: "tessellate-comp",
    key: "outputMode",
    value: "medallion",
  });
  s = appReducer(s, {
    type: "tessellate-comp",
    key: "groutMode",
    value: "grout",
  });
  const project = s.project as TessellateProject;
  expect(project.composition.outputMode).toBe("medallion");
  expect(project.composition.groutMode).toBe("grout");
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
  // tessellate ignores lasso crop actions entirely
  t = appReducer(t, {
    type: "crop-set-corner",
    index: 0,
    point: { x: 0.5, y: 0.5 },
  });
  expect(t).toBe(beforeT);
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
