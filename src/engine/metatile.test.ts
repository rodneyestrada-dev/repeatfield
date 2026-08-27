import {
  rotateCell,
  rotateMetatile,
  metatileCode,
  canonicalRotationCode,
  enumerateMetatiles,
  enumerateCanonicalMetatiles,
  DEFAULT_METATILE,
  type MetatileState,
} from "./metatile";

// Cell order is row-major: [top-left, top-right, bottom-left, bottom-right].

test("rotateCell steps quarter turns in both directions and wraps", () => {
  expect(rotateCell(0, 1)).toBe(1);
  expect(rotateCell(3, 1)).toBe(0);
  expect(rotateCell(0, -1)).toBe(3);
  expect(rotateCell(2, -1)).toBe(1);
});

test("default metatile is a 2x2 block of unrotated cells", () => {
  expect(DEFAULT_METATILE).toEqual({ size: 2, cells: [0, 0, 0, 0] });
});

test("whole-block rotation permutes positions and increments each cell", () => {
  const block: MetatileState = { size: 2, cells: [0, 1, 2, 3] };
  // CW: new TL = old BL+1, new TR = old TL+1, new BL = old BR+1, new BR = old TR+1
  expect(rotateMetatile(block, 1).cells).toEqual([3, 1, 0, 2]);
  expect(rotateMetatile(rotateMetatile(block, 1), -1).cells).toEqual(
    block.cells,
  );
  // Four CW rotations return to start
  let b = block;
  for (let i = 0; i < 4; i++) b = rotateMetatile(b, 1);
  expect(b.cells).toEqual(block.cells);
});

test("metatile codes are stable digit strings", () => {
  expect(metatileCode({ size: 2, cells: [0, 1, 2, 3] })).toBe("0123");
  expect(metatileCode(DEFAULT_METATILE)).toBe("0000");
});

test("canonical code is invariant under whole-block rotation", () => {
  const block: MetatileState = { size: 2, cells: [0, 1, 2, 3] };
  const canonical = canonicalRotationCode(block);
  let b = block;
  for (let i = 0; i < 3; i++) {
    b = rotateMetatile(b, 1);
    expect(canonicalRotationCode(b)).toBe(canonical);
  }
});

test("raw enumeration yields exactly 256 blocks and canonical yields 70", () => {
  const raw = enumerateMetatiles();
  expect(raw).toHaveLength(256);
  expect(new Set(raw.map(metatileCode)).size).toBe(256);
  const canonical = enumerateCanonicalMetatiles();
  expect(canonical).toHaveLength(70);
  const canonicalCodes = new Set(canonical.map(metatileCode));
  // every raw block maps into the canonical set
  for (const block of raw)
    expect(canonicalCodes.has(canonicalRotationCode(block))).toBe(true);
});
