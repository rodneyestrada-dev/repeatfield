import { applyLook, DEFAULT_LOOK, type SetLook } from "./appearance";

const px = (values: number[]) => new Uint8ClampedArray(values);

test("the default look is an exact identity transform", () => {
  const source = px([10, 128, 250, 255, 0, 64, 200, 30]);
  expect(Array.from(applyLook(source, DEFAULT_LOOK))).toEqual(
    Array.from(source),
  );
});

test("brightness shifts channels while alpha never changes", () => {
  const out = applyLook(px([100, 100, 100, 200]), {
    ...DEFAULT_LOOK,
    brightness: 20,
  });
  expect(out[0]).toBeGreaterThan(100);
  expect(out[1]).toBeGreaterThan(100);
  expect(out[2]).toBeGreaterThan(100);
  expect(out[3]).toBe(200);
});

test("contrast pushes values away from mid gray and clamps safely", () => {
  const look: SetLook = { ...DEFAULT_LOOK, contrast: 50 };
  const out = applyLook(px([40, 128, 220, 255]), look);
  expect(out[0]).toBeLessThan(40);
  expect(out[1]).toBe(128);
  expect(out[2]).toBeGreaterThan(220);
  const extreme = applyLook(px([0, 255, 128, 255]), {
    ...DEFAULT_LOOK,
    contrast: 100,
  });
  expect(extreme[0]).toBe(0);
  expect(extreme[1]).toBe(255);
});

test("saturation moves colors toward or away from their luma", () => {
  const desaturated = applyLook(px([200, 50, 50, 255]), {
    ...DEFAULT_LOOK,
    saturation: -100,
  });
  expect(desaturated[0]).toBe(desaturated[1]);
  expect(desaturated[1]).toBe(desaturated[2]);
  const saturated = applyLook(px([200, 50, 50, 255]), {
    ...DEFAULT_LOOK,
    saturation: 50,
  });
  expect(saturated[0]).toBeGreaterThan(200);
});

test("warmth raises red and lowers blue symmetrically", () => {
  const warm = applyLook(px([100, 100, 100, 255]), {
    ...DEFAULT_LOOK,
    warmth: 40,
  });
  expect(warm[0]).toBeGreaterThan(100);
  expect(warm[2]).toBeLessThan(100);
  expect(warm[1]).toBe(100);
});
