import { vi } from "vitest";
import { applyCellTransform } from "./renderer";

test("applies quarter-turn rotation and selected-cell reflection to the canvas context", () => {
  const ctx = {
    rotate: vi.fn(),
    scale: vi.fn(),
  } as unknown as CanvasRenderingContext2D;

  applyCellTransform(ctx, { rotation: 3, flipX: true, flipY: false });

  expect(ctx.rotate).toHaveBeenCalledWith((3 * Math.PI) / 2);
  expect(ctx.scale).toHaveBeenCalledWith(-1, 1);
});

test("unreflected cells retain identity scale", () => {
  const ctx = {
    rotate: vi.fn(),
    scale: vi.fn(),
  } as unknown as CanvasRenderingContext2D;

  applyCellTransform(ctx, { rotation: 0, flipX: false, flipY: false });

  expect(ctx.scale).toHaveBeenCalledWith(1, 1);
});
