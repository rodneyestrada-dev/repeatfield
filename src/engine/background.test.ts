import { alphaForColor, applyAlphaMask, colorDistance } from "./background";

test("color distance is perceptual-scale RGB distance from zero to 255", () => {
  expect(colorDistance({ r: 20, g: 30, b: 40 }, { r: 20, g: 30, b: 40 })).toBe(
    0,
  );
  expect(colorDistance({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBe(
    255,
  );
});

test("alpha mask removes matching color and feathers the tolerance edge", () => {
  const target = { r: 100, g: 100, b: 100 };
  expect(alphaForColor(target, target, 10, 20)).toBe(0);
  expect(alphaForColor({ r: 130, g: 130, b: 130 }, target, 10, 20)).toBe(255);
  expect(alphaForColor({ r: 120, g: 120, b: 120 }, target, 10, 20)).toBeCloseTo(
    127.5,
  );
});

test("alpha mask preserves original transparency and changes only alpha", () => {
  const pixels = new Uint8ClampedArray([100, 100, 100, 255, 200, 20, 20, 128]);
  const masked = applyAlphaMask(pixels, { r: 100, g: 100, b: 100 }, 15, 0);
  expect([...masked]).toEqual([100, 100, 100, 0, 200, 20, 20, 128]);
  expect([...pixels]).toEqual([100, 100, 100, 255, 200, 20, 20, 128]);
});
