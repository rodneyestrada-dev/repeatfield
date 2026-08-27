import { computeFrameLayout } from "./frameLayout";

const base = {
  fieldColumns: 2,
  fieldRows: 2,
  tileSize: 100,
  borderEnabled: true,
  cornerEnabled: true,
  borderPhase: 0,
  borderAlternate: false,
  borderReverse: false,
  cornerBaseRotation: 0 as const,
  cornerOverrides: {},
};

test("a 2x2 interior with a full frame yields 4 field, 8 border, 4 corner tiles", () => {
  const placements = computeFrameLayout(base);
  const count = (role: string) =>
    placements.filter((p) => p.role === role).length;
  expect(count("field")).toBe(4);
  expect(count("border")).toBe(8);
  expect(count("corner")).toBe(4);
  // no duplicated positions
  const keys = placements.map((p) => `${p.x},${p.y}`);
  expect(new Set(keys).size).toBe(placements.length);
});

test("border sides rotate by convention: top 0, right 90, bottom 180, left 270", () => {
  const placements = computeFrameLayout(base);
  const side = (s: string) =>
    placements.filter((p) => p.role === "border" && p.side === s);
  expect(side("top").every((p) => p.rotation === 0)).toBe(true);
  expect(side("right").every((p) => p.rotation === 90)).toBe(true);
  expect(side("bottom").every((p) => p.rotation === 180)).toBe(true);
  expect(side("left").every((p) => p.rotation === 270)).toBe(true);
});

test("corners rotate from the top-left baseline and honor per-corner overrides", () => {
  const placements = computeFrameLayout(base);
  const corner = (c: string) =>
    placements.find((p) => p.role === "corner" && p.corner === c)!;
  expect(corner("top-left").rotation).toBe(0);
  expect(corner("top-right").rotation).toBe(90);
  expect(corner("bottom-right").rotation).toBe(180);
  expect(corner("bottom-left").rotation).toBe(270);
  const overridden = computeFrameLayout({
    ...base,
    cornerOverrides: { "top-right": 270 },
  });
  expect(
    overridden.find((p) => p.corner === "top-right")!.rotation,
  ).toBe(270);
  expect(overridden.find((p) => p.corner === "top-left")!.rotation).toBe(0);
});

test("layout dimensions are exact and field stays inside the frame", () => {
  const placements = computeFrameLayout(base);
  const fields = placements.filter((p) => p.role === "field");
  for (const f of fields) {
    expect(f.x).toBeGreaterThanOrEqual(100);
    expect(f.y).toBeGreaterThanOrEqual(100);
    expect(f.x + 100).toBeLessThanOrEqual(300);
    expect(f.y + 100).toBeLessThanOrEqual(300);
  }
  const xs = placements.map((p) => p.x);
  const ys = placements.map((p) => p.y);
  expect(Math.min(...xs)).toBe(0);
  expect(Math.max(...xs)).toBe(300);
  expect(Math.min(...ys)).toBe(0);
  expect(Math.max(...ys)).toBe(300);
});

test("disabling the border returns a field-only layout at origin", () => {
  const placements = computeFrameLayout({
    ...base,
    borderEnabled: false,
    cornerEnabled: false,
  });
  expect(placements.every((p) => p.role === "field")).toBe(true);
  expect(placements).toHaveLength(4);
  expect(Math.min(...placements.map((p) => p.x))).toBe(0);
});

test("alternate rotation flips every other border tile deterministically", () => {
  const placements = computeFrameLayout({ ...base, borderAlternate: true });
  const top = placements
    .filter((p) => p.side === "top")
    .sort((a, b) => a.x - b.x);
  expect(top.map((p) => p.rotation)).toEqual([0, 180]);
  // phase shifts the alternation start without moving tiles
  const phased = computeFrameLayout({
    ...base,
    borderAlternate: true,
    borderPhase: 1,
  });
  const topPhased = phased
    .filter((p) => p.side === "top")
    .sort((a, b) => a.x - b.x);
  expect(topPhased.map((p) => p.rotation)).toEqual([180, 0]);
  expect(topPhased.map((p) => p.x)).toEqual(top.map((p) => p.x));
});

test("reverse adds a half turn to border runs without moving tiles", () => {
  const normal = computeFrameLayout(base);
  const reversed = computeFrameLayout({ ...base, borderReverse: true });
  const top = (list: typeof normal) =>
    list.filter((p) => p.side === "top").sort((a, b) => a.x - b.x);
  expect(top(reversed).map((p) => p.x)).toEqual(top(normal).map((p) => p.x));
  expect(top(reversed).map((p) => p.rotation)).toEqual([180, 180]);
});
