import { METATILE_PRESETS, presetById } from "./metatilePresets";

test("presets are unnumbered, uniquely named, and editable orientation data", () => {
  const names = METATILE_PRESETS.map((p) => p.name);
  expect(new Set(names).size).toBe(METATILE_PRESETS.length);
  for (const name of names) expect(name).not.toMatch(/^\d/);
  expect(METATILE_PRESETS.length).toBeGreaterThanOrEqual(5);
});

test("core presets write the expected row-major cell orientations", () => {
  expect(presetById("aligned")!.cells).toEqual([0, 0, 0, 0]);
  expect(presetById("checker")!.cells).toEqual([0, 2, 2, 0]);
  expect(presetById("pinwheel")!.cells).toEqual([0, 1, 3, 2]);
  expect(presetById("rows")!.cells).toEqual([0, 0, 2, 2]);
  expect(presetById("columns")!.cells).toEqual([0, 2, 0, 2]);
});
