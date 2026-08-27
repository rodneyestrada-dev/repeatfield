import { PATTERNS, DEFAULT_REPEAT, segmentOptions } from "./patterns";

test("defines the eight required unique pattern families", () => {
  expect(PATTERNS.map((p) => p.id)).toEqual([
    "straight",
    "half-drop",
    "brick",
    "checker-rotate",
    "mirror-grid",
    "quarter-turn-rosette",
    "triangle-kaleidoscope",
    "radial-kaleidoscope",
  ]);
  expect(new Set(PATTERNS.map((p) => p.id)).size).toBe(8);
});

test("provides stable creative defaults and supported segments", () => {
  expect(segmentOptions).toEqual([3, 4, 6, 8, 12]);
  expect(DEFAULT_REPEAT).toMatchObject({
    patternId: "quarter-turn-rosette",
    sourceZoom: 1,
    tileScale: 150,
    gap: 0,
    segments: 8,
    showGuides: false,
  });
});
