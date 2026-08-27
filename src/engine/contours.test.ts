import { extractContours, simplifyContour, contourArea } from "./contours";

// Build a binary mask from ASCII art rows; "#" = filled.
function mask(rows: string[]) {
  const height = rows.length;
  const width = rows[0].length;
  const data = new Uint8Array(width * height);
  rows.forEach((row, y) => {
    for (let x = 0; x < width; x++)
      if (row[x] === "#") data[y * width + x] = 1;
  });
  return { data, width, height };
}

test("a solid square yields one outer contour with positive area and no holes", () => {
  const m = mask(["....", ".##.", ".##.", "...."]);
  const result = extractContours(m.data, m.width, m.height);
  expect(result.outer).not.toBeNull();
  expect(result.holes).toHaveLength(0);
  expect(contourArea(result.outer!)).toBeCloseTo(4);
});

test("a shape with an interior hole reports the hole separately", () => {
  const m = mask([
    ".......",
    ".#####.",
    ".#...#.",
    ".#...#.",
    ".#####.",
    ".......",
  ]);
  const result = extractContours(m.data, m.width, m.height);
  expect(result.outer).not.toBeNull();
  expect(contourArea(result.outer!)).toBeCloseTo(20);
  expect(result.holes).toHaveLength(1);
  expect(Math.abs(contourArea(result.holes[0]))).toBeCloseTo(6);
});

test("the largest outer contour wins and tiny specks are filtered", () => {
  const m = mask([
    "..........",
    ".####....#",
    ".####.....",
    ".####.....",
    "..........",
  ]);
  const result = extractContours(m.data, m.width, m.height, { minArea: 2 });
  expect(result.outer).not.toBeNull();
  expect(contourArea(result.outer!)).toBeCloseTo(12);
  // the single-pixel speck was filtered, not returned as a hole
  expect(result.holes).toHaveLength(0);
});

test("a concave shape keeps its concavity in the traced contour", () => {
  const m = mask([
    "......",
    ".####.",
    ".#..#.",
    ".####.",
    "......",
  ]).data;
  const result = extractContours(m, 6, 5);
  // U-ish ring: 12 filled - but the 2px middle void is enclosed → hole
  expect(result.outer).not.toBeNull();
  expect(result.holes).toHaveLength(1);
});

test("an empty mask yields no contours", () => {
  const m = mask(["....", "....", "...."]);
  const result = extractContours(m.data, m.width, m.height);
  expect(result.outer).toBeNull();
  expect(result.holes).toHaveLength(0);
});

test("simplification stays within tolerance and preserves closure", () => {
  // near-straight staircase collapses to few points under generous tolerance
  const contour = Array.from({ length: 21 }, (_, i) => ({
    x: i,
    y: i % 2 === 0 ? 0 : 0.2,
  })).concat([
    { x: 20, y: 10 },
    { x: 0, y: 10 },
  ]);
  const simplified = simplifyContour(contour, 0.5);
  expect(simplified.length).toBeLessThan(contour.length);
  expect(simplified.length).toBeGreaterThanOrEqual(3);
  // area is roughly preserved
  expect(Math.abs(contourArea(simplified))).toBeGreaterThan(
    Math.abs(contourArea(contour)) * 0.9,
  );
});
