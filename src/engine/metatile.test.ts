import {
  rotateCell,
  rotateMetatile,
  reflectCell,
  metatileCode,
  canonicalRotationCode,
  enumerateMetatiles,
  enumerateCanonicalMetatiles,
  DEFAULT_METATILE,
  normalizeMetatile,
  type CellTransform,
  type MetatileState,
} from "./metatile";

const cell = (rotation: 0 | 1 | 2 | 3, flipX = false, flipY = false): CellTransform => ({
  rotation,
  flipX,
  flipY,
});
const block = (rotations: readonly [0 | 1 | 2 | 3, 0 | 1 | 2 | 3, 0 | 1 | 2 | 3, 0 | 1 | 2 | 3]): MetatileState =>
  normalizeMetatile({ size: 2, cells: rotations });

test("normalizes legacy scalar quarter turns into explicit cell transforms", () => {
  expect(normalizeMetatile({ size: 2, cells: [0, 1, 2, 3] })).toEqual({
    size: 2,
    cells: [cell(0), cell(1), cell(2), cell(3)],
  });
});

test("normalization sanitizes malformed transforms without sharing cell objects", () => {
  const normalized = normalizeMetatile({ cells: [{ rotation: 9, flipX: 1 }, null] });
  expect(normalized.cells).toEqual([cell(1), cell(0), cell(0), cell(0)]);
  expect(normalized.cells[2]).not.toBe(normalized.cells[3]);
});

test("reflectCell toggles only the requested local axis", () => {
  expect(reflectCell(cell(1, false, true), "x")).toEqual(cell(1, true, true));
  expect(reflectCell(cell(1, false, true), "y")).toEqual(cell(1, false, false));
});

test("rotateCell steps quarter turns in both directions, wraps, and preserves reflections", () => {
  expect(rotateCell(cell(0, true), 1)).toEqual(cell(1, true));
  expect(rotateCell(cell(3), 1)).toEqual(cell(0));
  expect(rotateCell(cell(0, false, true), -1)).toEqual(cell(3, false, true));
  expect(rotateCell(cell(2), -1)).toEqual(cell(1));
});

test("default metatile is a 2x2 block of identity transforms", () => {
  expect(DEFAULT_METATILE).toEqual({ size: 2, cells: [cell(0), cell(0), cell(0), cell(0)] });
});

test("whole-block rotation moves cells, rotates artwork, and preserves reflection flags", () => {
  const source: MetatileState = {
    size: 2,
    cells: [cell(0, true), cell(1, false, true), cell(2, true, true), cell(3)],
  };
  expect(rotateMetatile(source, 1).cells).toEqual([
    cell(3, true, true),
    cell(1, true),
    cell(0),
    cell(2, false, true),
  ]);
  expect(rotateMetatile(rotateMetatile(source, 1), -1)).toEqual(source);
  let current = source;
  for (let index = 0; index < 4; index++) current = rotateMetatile(current, 1);
  expect(current).toEqual(source);
});

test("metatile codes are stable and include reflection state", () => {
  expect(metatileCode(block([0, 1, 2, 3]))).toBe("0123");
  expect(metatileCode({ size: 2, cells: [cell(0, true), cell(1), cell(2), cell(3, false, true)] })).toBe("0x123y");
});

test("canonical code is invariant under whole-block rotation", () => {
  const source = block([0, 1, 2, 3]);
  const canonical = canonicalRotationCode(source);
  let current = source;
  for (let index = 0; index < 3; index++) {
    current = rotateMetatile(current, 1);
    expect(canonicalRotationCode(current)).toBe(canonical);
  }
});

test("raw enumeration yields exactly 256 blocks and canonical yields 70", () => {
  const raw = enumerateMetatiles();
  expect(raw).toHaveLength(256);
  expect(new Set(raw.map(metatileCode)).size).toBe(256);
  const canonical = enumerateCanonicalMetatiles();
  expect(canonical).toHaveLength(70);
  const canonicalCodes = new Set(canonical.map(metatileCode));
  for (const item of raw)
    expect(canonicalCodes.has(canonicalRotationCode(item))).toBe(true);
});
