import { test, expect } from "vitest";
import { posterSceneLayout, DEFAULT_POSTER_OPTIONS } from "./posterScene";

const inside = (inner: { x: number; y: number; width: number; height: number }, outer: { x: number; y: number; width: number; height: number }) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

test("poster layout nests print ⊂ mat ⊂ frame ⊂ scene for every aspect", () => {
  for (const aspect of ["square", "portrait", "landscape"] as const) {
    const layout = posterSceneLayout(1600, 1000, aspect);
    const scene = { x: 0, y: 0, width: 1600, height: 1000 };
    expect(inside(layout.frame, scene)).toBe(true);
    expect(inside(layout.mat, layout.frame)).toBe(true);
    expect(inside(layout.print, layout.mat)).toBe(true);
    expect(layout.frame.width).toBeGreaterThan(layout.print.width);
    expect(layout.frame.height).toBeGreaterThan(layout.print.height);
  }
});

test("poster print area honors the requested aspect ratio", () => {
  expect(posterSceneLayout(1200, 1200, "square").print.width).toBeCloseTo(
    posterSceneLayout(1200, 1200, "square").print.height,
    0,
  );
  const portrait = posterSceneLayout(1600, 1000, "portrait");
  expect(portrait.print.width / portrait.print.height).toBeCloseTo(4 / 5, 2);
  const landscape = posterSceneLayout(1000, 1600, "landscape");
  expect(landscape.print.width / landscape.print.height).toBeCloseTo(5 / 4, 2);
});

test("poster layout is deterministic and centered horizontally", () => {
  const a = posterSceneLayout(1440, 900, "square");
  const b = posterSceneLayout(1440, 900, "square");
  expect(a).toEqual(b);
  const centerX = a.frame.x + a.frame.width / 2;
  expect(centerX).toBeCloseTo(720, 0);
});

test("default poster options are neutral", () => {
  expect(DEFAULT_POSTER_OPTIONS.zoom).toBe(1);
  expect(DEFAULT_POSTER_OPTIONS.offsetX).toBe(0);
  expect(DEFAULT_POSTER_OPTIONS.offsetY).toBe(0);
});
