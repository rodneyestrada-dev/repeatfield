import { analyzeCoverage, coverageStatus, type StampMask } from "./coverage";

function rectStamp(
  width: number,
  height: number,
  offsetX = 0,
  offsetY = 0,
): StampMask {
  return {
    data: new Uint8Array(width * height).fill(1),
    width,
    height,
    offsetX,
    offsetY,
  };
}

test("a perfect square grid covers the cell exactly once everywhere", () => {
  const result = analyzeCoverage(
    10,
    10,
    [rectStamp(10, 10)],
    { x: 10, y: 0 },
    { x: 0, y: 10 },
  );
  expect(result.validPct).toBe(100);
  expect(result.gapPct).toBe(0);
  expect(result.overlapPct).toBe(0);
});

test("undersized shapes leave measured gaps", () => {
  const result = analyzeCoverage(
    10,
    10,
    [rectStamp(6, 6, 2, 2)],
    { x: 10, y: 0 },
    { x: 0, y: 10 },
  );
  expect(result.gapPct).toBeCloseTo(64);
  expect(result.overlapPct).toBe(0);
});

test("oversized shapes overlap their repeated neighbors", () => {
  const result = analyzeCoverage(
    10,
    10,
    [rectStamp(12, 12, -1, -1)],
    { x: 10, y: 0 },
    { x: 0, y: 10 },
  );
  expect(result.gapPct).toBe(0);
  expect(result.overlapPct).toBeGreaterThan(0);
});

test("a primary plus a matching infill reaches full coverage that either alone misses", () => {
  const primary = rectStamp(10, 5, 0, 0);
  const infill = rectStamp(10, 5, 0, 5);
  const u = { x: 10, y: 0 };
  const v = { x: 0, y: 10 };
  const alone = analyzeCoverage(10, 10, [primary], u, v);
  expect(alone.gapPct).toBeCloseTo(50);
  const pair = analyzeCoverage(10, 10, [primary, infill], u, v);
  expect(pair.validPct).toBe(100);
});

test("neighboring cells contribute coverage across the cell boundary", () => {
  // stamp hangs off the right edge; its translated neighbor covers the left band
  const stamp = rectStamp(10, 10, 5, 0);
  const result = analyzeCoverage(10, 10, [stamp], { x: 10, y: 0 }, { x: 0, y: 10 });
  expect(result.gapPct).toBe(0);
  expect(result.validPct).toBe(100);
});

test("status labels stay honest for gap, overlap, and decorative cases", () => {
  const u = { x: 10, y: 0 };
  const v = { x: 0, y: 10 };
  const full = analyzeCoverage(10, 10, [rectStamp(10, 10)], u, v);
  expect(coverageStatus(full)).toBe("Gap-free");
  const gappy = analyzeCoverage(10, 10, [rectStamp(8, 10)], u, v);
  expect(coverageStatus(gappy)).toBe("Gaps detected");
  const sparse = analyzeCoverage(10, 10, [rectStamp(5, 5)], u, v);
  expect(coverageStatus(sparse)).toBe("Decorative packing");
  const overlapping = analyzeCoverage(10, 10, [rectStamp(11, 10)], u, v);
  expect(coverageStatus(overlapping)).toBe("Overlaps detected");
  const nearlyFull = analyzeCoverage(
    1000,
    1,
    [rectStamp(999, 1)],
    { x: 1000, y: 0 },
    { x: 0, y: 1 },
  );
  expect(coverageStatus(nearlyFull)).toBe("Near fit — inspect edges");
});
