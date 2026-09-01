import type { TessellateControls, TessellateFamily } from "../app/state";

export type { TessellateFamily } from "../app/state";

type Source = CanvasImageSource & { width: number; height: number };

function drawSquare(
  context: CanvasRenderingContext2D,
  source: Source,
  x: number,
  y: number,
  size: number,
  rotation: number,
  mirror: boolean,
) {
  context.save();
  context.translate(x + size / 2, y + size / 2);
  context.rotate((rotation * Math.PI) / 180);
  context.scale(mirror ? -1 : 1, 1);
  context.drawImage(source, -size / 2, -size / 2, size, size);
  context.restore();
}

function triangle(
  context: CanvasRenderingContext2D,
  source: Source,
  x: number,
  y: number,
  size: number,
  rotation: number,
  mirror: boolean,
) {
  context.save();
  context.translate(x + size / 2, y + size / 2);
  context.rotate((rotation * Math.PI) / 180);
  context.scale(mirror ? -1 : 1, 1);
  context.beginPath();
  context.moveTo(-size / 2, size / 2);
  context.lineTo(0, -size / 2);
  context.lineTo(size / 2, size / 2);
  context.closePath();
  context.clip();
  context.drawImage(source, -size / 2, -size / 2, size, size);
  context.restore();
}

/** Draw a deliberately visual pattern field; it never performs object extraction. */
export function renderTessellateFamily(
  context: CanvasRenderingContext2D,
  source: Source,
  family: TessellateFamily,
  controls: TessellateControls,
  width: number,
  height: number,
) {
  const size = Math.max(16, controls.scale);
  const density = Math.max(2, controls.density);
  context.save();
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#f2ece3";
  context.fillRect(0, 0, width, height);

  if (family === "kaleidoscope") {
    const step = Math.max(40, size * 1.5);
    for (let y = -step; y < height + step; y += step)
      for (let x = -step; x < width + step; x += step)
        for (let index = 0; index < controls.segments; index++) {
          context.save();
          context.translate(x + step / 2, y + step / 2);
          context.rotate((index * 360) / controls.segments + controls.rotation);
          context.scale(index % 2 && controls.mirror ? -1 : 1, 1);
          context.beginPath();
          context.moveTo(0, 0);
          context.lineTo(step, -step / 2);
          context.lineTo(step, step / 2);
          context.closePath();
          context.clip();
          context.drawImage(source, 0, -step / 2, step, step);
          context.restore();
        }
  } else if (family === "tetra" || family === "triangles") {
    const step = family === "tetra" ? size * 0.85 : size;
    const rise = step * 0.86;
    for (let row = -2; row < height / rise + 2; row++)
      for (let column = -2; column < width / step + 2; column++) {
        const x = column * step + (row % 2 ? step / 2 : 0);
        const y = row * rise;
        triangle(context, source, x, y, size, controls.rotation + ((row + column) % 2 ? 180 : 0), controls.mirror && (row + column) % 2 === 1);
      }
  } else if (family === "prism") {
    const step = size * 0.8;
    for (let row = -2; row < height / step + 2; row++)
      for (let column = -2; column < width / step + 2; column++) {
        const x = column * step + (row % 2 ? step / 2 : 0);
        const y = row * step;
        triangle(context, source, x, y, size, controls.rotation + 30, controls.mirror && column % 2 === 1);
        triangle(context, source, x + size / 3, y + size / 3, size, controls.rotation + 210, false);
      }
  } else {
    const step = size / Math.max(0.5, density / 4);
    for (let row = -2; row < height / step + 2; row++)
      for (let column = -2; column < width / step + 2; column++) {
        const turn = ((row * 2 + column * 3) % 4) * 90 + controls.rotation;
        drawSquare(context, source, column * step, row * step, size, turn, controls.mirror && (row + column) % 2 === 1);
      }
  }
  context.restore();
}
