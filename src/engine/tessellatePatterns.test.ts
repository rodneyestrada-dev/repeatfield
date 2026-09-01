import { vi } from "vitest";
import { renderTessellateFamily, type TessellateFamily } from "./tessellatePatterns";

const families: TessellateFamily[] = [
  "penrose-inspired",
  "kaleidoscope",
  "tetra",
  "triangles",
  "prism",
];

function context() {
  return {
    save: vi.fn(), restore: vi.fn(), clearRect: vi.fn(), fillRect: vi.fn(),
    translate: vi.fn(), rotate: vi.fn(), scale: vi.fn(), drawImage: vi.fn(),
    beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn(), clip: vi.fn(),
    fillStyle: "",
  } as unknown as CanvasRenderingContext2D;
}

const source = { width: 32, height: 32 } as unknown as HTMLCanvasElement;

test.each(families)("%s fills a full pattern field deterministically", (family) => {
  const first = context();
  const second = context();
  const options = { scale: 48, rotation: 0, mirror: true, density: 4, segments: 8 };

  renderTessellateFamily(first, source, family, options, 160, 120);
  renderTessellateFamily(second, source, family, options, 160, 120);

  expect(first.fillRect).toHaveBeenCalledWith(0, 0, 160, 120);
  expect(first.drawImage).toHaveBeenCalled();
  expect((first.drawImage as unknown as { mock: { calls: unknown[] } }).mock.calls)
    .toEqual((second.drawImage as unknown as { mock: { calls: unknown[] } }).mock.calls);
});
