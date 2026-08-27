import {
  cellTransform,
  wedgeGeometry,
  cropRectForAspect,
  homographyFromUnitSquare,
  mapHomography,
  mapUnitSquareToQuad,
} from "./geometry";

test("quarter-turn and mirror transforms are deterministic", () => {
  expect(
    [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ].map(([r, c]) => cellTransform("quarter-turn-rosette", r, c, 100)),
  ).toMatchObject([
    { rotation: 0 },
    { rotation: 90 },
    { rotation: 270 },
    { rotation: 180 },
  ]);
  expect(cellTransform("mirror-grid", 1, 1, 100)).toMatchObject({
    scaleX: -1,
    scaleY: -1,
  });
});

test("half-drop and brick offset alternate axes by half a cell", () => {
  expect(cellTransform("half-drop", 0, 1, 100).y).toBe(50);
  expect(cellTransform("brick", 1, 0, 100).x).toBe(50);
});

test("wedge segments cover one circle and alternate reflection", () => {
  const wedges = wedgeGeometry(8, 100);
  expect(wedges.reduce((sum, w) => sum + w.angle, 0)).toBeCloseTo(Math.PI * 2);
  expect(wedges.map((w) => w.mirrored)).toEqual([
    false,
    true,
    false,
    true,
    false,
    true,
    false,
    true,
  ]);
  expect(wedges.flatMap((w) => w.points.flat()).every(Number.isFinite)).toBe(
    true,
  );
});

test("crop aspect fits centrally within any source", () => {
  expect(cropRectForAspect(1200, 800, "square")).toEqual({
    x: 200,
    y: 0,
    width: 800,
    height: 800,
  });
  expect(cropRectForAspect(800, 1200, "landscape")).toEqual({
    x: 0,
    y: 375,
    width: 800,
    height: 450,
  });
  expect(cropRectForAspect(1200, 800, "free")).toEqual({
    x: 0,
    y: 0,
    width: 1200,
    height: 800,
  });
});

test("unit-square homography maps every corner into a perspective quadrilateral", () => {
  const quad = [
    { x: 120, y: 30 },
    { x: 630, y: 80 },
    { x: 570, y: 440 },
    { x: 60, y: 390 },
  ] as const;
  const h = homographyFromUnitSquare(quad);
  expect(mapHomography(h, { x: 0, y: 0 })).toEqual(quad[0]);
  expect(mapHomography(h, { x: 1, y: 0 })).toEqual(quad[1]);
  expect(mapHomography(h, { x: 1, y: 1 })).toEqual(quad[2]);
  expect(mapHomography(h, { x: 0, y: 1 })).toEqual(quad[3]);
});

test("quad mapping preserves projective interior points and identity", () => {
  const identity = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ] as const;
  expect(mapUnitSquareToQuad(identity, { x: 0.25, y: 0.75 })).toEqual({
    x: 0.25,
    y: 0.75,
  });
  const skewed = [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 1.6, y: 1 },
    { x: 0.2, y: 1 },
  ] as const;
  const midpoint = mapUnitSquareToQuad(skewed, { x: 0.5, y: 0.5 });
  expect(midpoint.x).toBeCloseTo(0.94117647);
  expect(midpoint.y).toBeCloseTo(0.58823529);
});

import {
  translateQuad,
  moveQuadEdge,
  isSimpleConvexQuad,
  clampQuadTranslation,
  type Quad,
} from "./geometry";

const UNIT_QUAD: Quad = [
  { x: 0.2, y: 0.2 },
  { x: 0.8, y: 0.2 },
  { x: 0.8, y: 0.8 },
  { x: 0.2, y: 0.8 },
];

test("whole-quad translation preserves side vectors", () => {
  const moved = translateQuad(UNIT_QUAD, { x: 0.1, y: -0.05 });
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    expect(moved[j].x - moved[i].x).toBeCloseTo(UNIT_QUAD[j].x - UNIT_QUAD[i].x);
    expect(moved[j].y - moved[i].y).toBeCloseTo(UNIT_QUAD[j].y - UNIT_QUAD[i].y);
  }
  expect(moved[0].x).toBeCloseTo(0.3);
  expect(moved[0].y).toBeCloseTo(0.15);
});

test("translation clamps as one unit at every source bound", () => {
  const right = clampQuadTranslation(UNIT_QUAD, { x: 0.5, y: 0 });
  expect(right.x).toBeCloseTo(0.2);
  expect(right.y).toBeCloseTo(0);
  const upLeft = clampQuadTranslation(UNIT_QUAD, { x: -0.5, y: -0.9 });
  expect(upLeft.x).toBeCloseTo(-0.2);
  expect(upLeft.y).toBeCloseTo(-0.2);
  const clamped = translateQuad(
    UNIT_QUAD,
    clampQuadTranslation(UNIT_QUAD, { x: 5, y: 5 }),
  );
  expect(Math.max(...clamped.map((p) => p.x))).toBeLessThanOrEqual(1);
  expect(Math.max(...clamped.map((p) => p.y))).toBeLessThanOrEqual(1);
});

test("edge movement changes only that edge's two endpoints", () => {
  const moved = moveQuadEdge(UNIT_QUAD, 0, { x: 0, y: -0.1 });
  expect(moved[0]).toEqual({ x: 0.2, y: 0.1 });
  expect(moved[1]).toEqual({ x: 0.8, y: 0.1 });
  expect(moved[2]).toEqual(UNIT_QUAD[2]);
  expect(moved[3]).toEqual(UNIT_QUAD[3]);
});

test("crossed and degenerate quadrilaterals are rejected", () => {
  expect(isSimpleConvexQuad(UNIT_QUAD)).toBe(true);
  const crossed: Quad = [
    { x: 0.2, y: 0.2 },
    { x: 0.8, y: 0.8 },
    { x: 0.8, y: 0.2 },
    { x: 0.2, y: 0.8 },
  ];
  expect(isSimpleConvexQuad(crossed)).toBe(false);
  const degenerate: Quad = [
    { x: 0.5, y: 0.5 },
    { x: 0.5, y: 0.5 },
    { x: 0.5, y: 0.5 },
    { x: 0.5, y: 0.5 },
  ];
  expect(isSimpleConvexQuad(degenerate)).toBe(false);
});
