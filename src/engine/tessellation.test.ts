import {
  transformPoint,
  transformContour,
  latticeOffsets,
  instanceLabel,
  type ShapeInstance,
} from "./tessellation";

const instance = (over: Partial<ShapeInstance> = {}): ShapeInstance => ({
  id: "i1",
  shapeId: "s1",
  position: { x: 0, y: 0 },
  rotation: 0,
  reflected: false,
  ...over,
});

test("rotation turns contour points around the instance position", () => {
  const p = transformPoint({ x: 10, y: 0 }, instance({ rotation: 90 }));
  expect(p.x).toBeCloseTo(0);
  expect(p.y).toBeCloseTo(10);
});

test("reflection flips x before rotation and translation", () => {
  const p = transformPoint(
    { x: 10, y: 4 },
    instance({ reflected: true, position: { x: 100, y: 50 } }),
  );
  expect(p.x).toBeCloseTo(90);
  expect(p.y).toBeCloseTo(54);
});

test("contours transform point-for-point", () => {
  const contour = [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 4 },
  ];
  const moved = transformContour(contour, instance({ position: { x: 5, y: 5 } }));
  expect(moved).toEqual([
    { x: 5, y: 5 },
    { x: 9, y: 5 },
    { x: 9, y: 9 },
  ]);
});

test("lattice offsets enumerate the neighboring cell grid deterministically", () => {
  const offsets = latticeOffsets({ x: 100, y: 0 }, { x: 0, y: 80 }, 1);
  expect(offsets).toHaveLength(9);
  expect(offsets).toContainEqual({ x: 0, y: 0 });
  expect(offsets).toContainEqual({ x: 100, y: 80 });
  expect(offsets).toContainEqual({ x: -100, y: -80 });
});

test("instances describe themselves for accessible selection labels", () => {
  expect(instanceLabel(instance({ rotation: 90 }), "Primary")).toMatch(
    /Primary.*90/,
  );
});
