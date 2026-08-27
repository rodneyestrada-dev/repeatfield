import { appReducer, INITIAL_STATE } from "./state";
import { validateExport, exportFilename } from "../engine/export";

test("editor state preserves edits across workspaces and clamps controls", () => {
  let s = appReducer(INITIAL_STATE, { type: "set-workspace", value: "repeat" });
  s = appReducer(s, { type: "repeat", key: "sourceZoom", value: 99 });
  s = appReducer(s, { type: "set-workspace", value: "preview" });
  s = appReducer(s, { type: "set-workspace", value: "repeat" });
  expect(s.repeat.sourceZoom).toBe(3);
  expect(s.workspace).toBe("repeat");
});

test("crop transforms rotate by ninety and toggle flips", () => {
  let s = appReducer(INITIAL_STATE, { type: "rotate-crop" });
  s = appReducer(s, { type: "flip-crop", axis: "x" });
  expect(s.crop).toMatchObject({ rotation: 90, flipX: true, flipY: false });
});

test("a crop corner can move independently within normalized source bounds", () => {
  const s = appReducer(INITIAL_STATE, {
    type: "set-crop-corner",
    index: 0,
    point: { x: -1, y: 0.23 },
  });
  expect(s.crop.quad[0]).toEqual({ x: 0, y: 0.23 });
  expect(s.crop.quad[1]).toEqual(INITIAL_STATE.crop.quad[1]);
});

test("background removal is optional, configurable, and reset with crop", () => {
  let s = appReducer(INITIAL_STATE, {
    type: "crop-background",
    key: "enabled",
    value: true,
  });
  s = appReducer(s, {
    type: "crop-background",
    key: "color",
    value: "#f0e0d0",
  });
  s = appReducer(s, { type: "crop-background", key: "tolerance", value: 44 });
  expect(s.crop.backgroundRemoval).toEqual({
    enabled: true,
    color: "#f0e0d0",
    tolerance: 44,
    feather: 12,
  });
  s = appReducer(s, { type: "reset-crop" });
  expect(s.crop.backgroundRemoval.enabled).toBe(false);
});

test("repeat history is bounded, clears redo after a new edit, and restores values", () => {
  let s = appReducer(INITIAL_STATE, { type: "set-workspace", value: "repeat" });
  for (let value = 1; value <= 60; value++)
    s = appReducer(s, { type: "repeat", key: "gap", value });
  expect(s.repeatHistory.past).toHaveLength(50);
  s = appReducer(s, { type: "undo-repeat" });
  expect(s.repeat.gap).toBe(59);
  expect(s.repeatHistory.future).toHaveLength(1);
  s = appReducer(s, { type: "repeat", key: "gap", value: 12 });
  expect(s.repeatHistory.future).toHaveLength(0);
  expect(s.repeat.gap).toBe(12);
});

test("entering Repeat from Crop establishes a fresh undo baseline", () => {
  let s = appReducer(INITIAL_STATE, { type: "set-workspace", value: "repeat" });
  s = appReducer(s, { type: "repeat", key: "gap", value: 20 });
  s = appReducer(s, { type: "set-workspace", value: "crop" });
  s = appReducer(s, { type: "set-workspace", value: "repeat" });
  expect(s.repeatHistory.past).toHaveLength(0);
  s = appReducer(s, { type: "undo-repeat" });
  expect(s.repeat.gap).toBe(20);
});

test("redo reapplies the most recently undone Repeat settings", () => {
  let s = appReducer(INITIAL_STATE, { type: "set-workspace", value: "repeat" });
  s = appReducer(s, { type: "repeat", key: "tileScale", value: 210 });
  s = appReducer(s, { type: "undo-repeat" });
  s = appReducer(s, { type: "redo-repeat" });
  expect(s.repeat.tileScale).toBe(210);
});

test("validates export dimensions and filename", () => {
  expect(validateExport(1920, 1080)).toEqual({ width: 1920, height: 1080 });
  expect(() => validateExport(9000, 9000)).toThrow(/pixel budget/i);
  expect(exportFilename("Radial Kaleidoscope", 1920, 1080)).toBe(
    "repeatfield-radial-kaleidoscope-1920x1080.png",
  );
});
