import {
  METATILE_PRESET_GROUPS,
  METATILE_PRESETS,
  generateRandomMetatile,
  presetById,
} from "./metatilePresets";

const t = (rotation: 0 | 1 | 2 | 3, flipX = false, flipY = false) => ({ rotation, flipX, flipY });

test("curated presets are grouped into the approved Repeat, Turn, Reflect, and Generate sets", () => {
  expect(METATILE_PRESET_GROUPS.map((group) => [group.id, group.presets.map((preset) => preset.name)])).toEqual([
    ["repeat", ["Aligned", "Alternating Rows", "Alternating Columns"]],
    ["turn", ["Checker 90° CW", "Checker 90° CCW", "Checker 180°", "Pinwheel", "Inward Corners", "Outward Corners"]],
    ["reflect", ["Checker Reflect H", "Checker Reflect V", "Unfold", "Mirror Grid"]],
    ["generate", ["Random Turn", "Random Turn + Reflect"]],
  ]);
  expect(METATILE_PRESETS).toHaveLength(15);
  expect(METATILE_PRESETS.some((preset) => /45|Blend Borders|Expand/.test(preset.name))).toBe(false);
});

test("curated static presets expose exact editable transforms", () => {
  expect(presetById("aligned")!.cells).toEqual([t(0), t(0), t(0), t(0)]);
  expect(presetById("alternating-rows")!.cells).toEqual([t(0), t(0), t(2), t(2)]);
  expect(presetById("alternating-columns")!.cells).toEqual([t(0), t(2), t(0), t(2)]);
  expect(presetById("checker-90-cw")!.cells).toEqual([t(0), t(1), t(1), t(0)]);
  expect(presetById("checker-90-ccw")!.cells).toEqual([t(0), t(3), t(3), t(0)]);
  expect(presetById("checker-180")!.cells).toEqual([t(0), t(2), t(2), t(0)]);
  expect(presetById("pinwheel")!.cells).toEqual([t(0), t(1), t(3), t(2)]);
  expect(presetById("inward-corners")!.cells).toEqual([t(1), t(2), t(0), t(3)]);
  expect(presetById("outward-corners")!.cells).toEqual([t(3), t(0), t(2), t(1)]);
  expect(presetById("checker-reflect-h")!.cells).toEqual([t(0), t(0, true), t(0, true), t(0)]);
  expect(presetById("checker-reflect-v")!.cells).toEqual([t(0), t(0, false, true), t(0, false, true), t(0)]);
  expect(presetById("unfold")!.cells).toEqual([t(0), t(1, true), t(3, false, true), t(2, true, true)]);
  expect(presetById("mirror-grid")!.cells).toEqual([t(0), t(0, true), t(0, false, true), t(0, true, true)]);
});

test("all curated static presets have distinct transform signatures", () => {
  const staticPresets = METATILE_PRESETS.filter((preset) => preset.cells);
  const signatures = staticPresets.map((preset) => JSON.stringify(preset.cells));
  expect(new Set(signatures).size).toBe(staticPresets.length);
});

test("Random Turn consumes one random value per cell and never reflects", () => {
  const values = [0, 0.26, 0.51, 0.99];
  const cells = generateRandomMetatile("turn", () => values.shift()!);
  expect(cells).toEqual([t(0), t(1), t(2), t(3)]);
});

test("Random Turn + Reflect consumes rotation, H, and V values per cell", () => {
  const values = [0.3, 0.6, 0.4, 0.8, 0.1, 0.9, 0, 0.51, 0.5, 0.99, 0.49, 0.5];
  const cells = generateRandomMetatile("turn-reflect", () => values.shift()!);
  expect(cells).toEqual([
    t(1, true, false),
    t(3, false, true),
    t(0, true, true),
    t(3, false, true),
  ]);
});
