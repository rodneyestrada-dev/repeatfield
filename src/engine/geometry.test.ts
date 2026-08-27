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
