import type { Quad } from "./geometry";
import { mapUnitSquareToQuad } from "./geometry";
import type { PatternId, RepeatSettings } from "./patterns";
import { applyAlphaMask, hexToRgb } from "./background";

export interface CropRenderState {
  aspect: string;
  zoom: number;
  panX: number;
  panY: number;
  rotation: number;
  fineRotation: number;
  flipX: boolean;
  flipY: boolean;
  quad: Quad;
  backgroundRemoval: {
    enabled: boolean;
    color: string;
    tolerance: number;
    feather: number;
  };
}

type SizedSource = CanvasImageSource & { width: number; height: number };
type P = { x: number; y: number };

function canvas(width: number, height: number) {
  const result = document.createElement("canvas");
  result.width = Math.max(1, Math.round(width));
  result.height = Math.max(1, Math.round(height));
  return result;
}

export function orientedSource(
  img: SizedSource,
  crop: CropRenderState,
): HTMLCanvasElement {
  const turns = ((Math.round(crop.rotation / 90) % 4) + 4) % 4;
  const swap = turns % 2 === 1;
  const result = canvas(
    swap ? img.height : img.width,
    swap ? img.width : img.height,
  );
  const ctx = result.getContext("2d")!;
  ctx.translate(result.width / 2, result.height / 2);
  ctx.rotate((turns * Math.PI) / 2);
  ctx.scale(crop.flipX ? -1 : 1, crop.flipY ? -1 : 1);
  ctx.drawImage(img, -img.width / 2, -img.height / 2, img.width, img.height);
  return result;
}

export function preparedSource(
  img: SizedSource,
  crop: CropRenderState,
): HTMLCanvasElement {
  const result = orientedSource(img, crop);
  if (!crop.backgroundRemoval.enabled) return result;
  const ctx = result.getContext("2d", { willReadFrequently: true })!;
  const image = ctx.getImageData(0, 0, result.width, result.height);
  image.data.set(
    applyAlphaMask(
      image.data,
      hexToRgb(crop.backgroundRemoval.color),
      crop.backgroundRemoval.tolerance,
      crop.backgroundRemoval.feather,
    ),
  );
  ctx.putImageData(image, 0, 0);
  return result;
}

function affineTriangle(
  ctx: CanvasRenderingContext2D,
  img: SizedSource,
  s0: P,
  s1: P,
  s2: P,
  d0: P,
  d1: P,
  d2: P,
) {
  const denominator =
    s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y);
  if (Math.abs(denominator) < 1e-8) return;
  const a =
    (d0.x * (s1.y - s2.y) + d1.x * (s2.y - s0.y) + d2.x * (s0.y - s1.y)) /
    denominator;
  const c =
    (d0.x * (s2.x - s1.x) + d1.x * (s0.x - s2.x) + d2.x * (s1.x - s0.x)) /
    denominator;
  const e =
    (d0.x * (s1.x * s2.y - s2.x * s1.y) +
      d1.x * (s2.x * s0.y - s0.x * s2.y) +
      d2.x * (s0.x * s1.y - s1.x * s0.y)) /
    denominator;
  const b =
    (d0.y * (s1.y - s2.y) + d1.y * (s2.y - s0.y) + d2.y * (s0.y - s1.y)) /
    denominator;
  const d =
    (d0.y * (s2.x - s1.x) + d1.y * (s0.x - s2.x) + d2.y * (s1.x - s0.x)) /
    denominator;
  const f =
    (d0.y * (s1.x * s2.y - s2.x * s1.y) +
      d1.y * (s2.x * s0.y - s0.x * s2.y) +
      d2.y * (s0.x * s1.y - s1.x * s0.y)) /
    denominator;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(d0.x, d0.y);
  ctx.lineTo(d1.x, d1.y);
  ctx.lineTo(d2.x, d2.y);
  ctx.closePath();
  ctx.clip();
  ctx.setTransform(a, b, c, d, e, f);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

export function rectifyQuad(
  img: SizedSource,
  quad: Quad,
  size = 512,
  subdivisions = 20,
): HTMLCanvasElement {
  const result = canvas(size, size),
    ctx = result.getContext("2d")!;
  const source = (u: number, v: number) => {
    const p = mapUnitSquareToQuad(quad, { x: u, y: v });
    return { x: p.x * img.width, y: p.y * img.height };
  };
  const destination = (u: number, v: number) => ({ x: u * size, y: v * size });
  for (let row = 0; row < subdivisions; row++)
    for (let column = 0; column < subdivisions; column++) {
      const u0 = column / subdivisions,
        u1 = (column + 1) / subdivisions,
        v0 = row / subdivisions,
        v1 = (row + 1) / subdivisions;
      const s00 = source(u0, v0),
        s10 = source(u1, v0),
        s11 = source(u1, v1),
        s01 = source(u0, v1);
      const d00 = destination(u0, v0),
        d10 = destination(u1, v0),
        d11 = destination(u1, v1),
        d01 = destination(u0, v1);
      affineTriangle(ctx, img, s00, s10, s11, d00, d10, d11);
      affineTriangle(ctx, img, s00, s11, s01, d00, d11, d01);
    }
  return result;
}

function drawTile(
  ctx: CanvasRenderingContext2D,
  tile: SizedSource,
  x: number,
  y: number,
  w: number,
  h: number,
  repeat: RepeatSettings,
  rotation = 0,
  fx = 1,
  fy = 1,
  clip: "rect" | "triangle" = "rect",
) {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(((rotation + repeat.sourceRotation) * Math.PI) / 180);
  ctx.scale(fx, fy);
  ctx.beginPath();
  if (clip === "triangle") {
    ctx.moveTo(-w / 2, h / 2);
    ctx.lineTo(0, -h / 2);
    ctx.lineTo(w / 2, h / 2);
    ctx.closePath();
  } else ctx.rect(-w / 2, -h / 2, w, h);
  ctx.clip();
  const z = repeat.sourceZoom;
  ctx.translate(repeat.sourceOffsetX, repeat.sourceOffsetY);
  ctx.drawImage(tile, (-w * z) / 2, (-h * z) / 2, w * z, h * z);
  ctx.restore();
}

export function renderPattern(
  ctx: CanvasRenderingContext2D,
  img: SizedSource,
  width: number,
  height: number,
  crop: CropRenderState,
  repeat: RepeatSettings,
) {
  const tile = rectifyQuad(preparedSource(img, crop), crop.quad);
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  if (!crop.backgroundRemoval.enabled) {
    ctx.fillStyle = repeat.background;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.translate(width / 2, height / 2);
  ctx.rotate((repeat.fieldRotation * Math.PI) / 180);
  ctx.translate(-width / 2, -height / 2);
  const size = repeat.tileScale,
    gap = repeat.gap,
    step = size + gap,
    over = Math.ceil(Math.hypot(width, height) / step) + 3;
  if (repeat.patternId === "radial-kaleidoscope") {
    const angle = (Math.PI * 2) / repeat.segments,
      radius = size * 0.72;
    for (let row = -2; row < height / step + 2; row++)
      for (let column = -2; column < width / step + 2; column++)
        for (let index = 0; index < repeat.segments; index++) {
          const cx = column * step + size / 2,
            cy = row * step + size / 2;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(index * angle);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(radius, -Math.tan(angle / 2) * radius);
          ctx.lineTo(radius, Math.tan(angle / 2) * radius);
          ctx.closePath();
          ctx.clip();
          if (index % 2) ctx.scale(1, -1);
          drawTile(ctx, tile, -radius, -radius, radius * 2, radius * 2, repeat);
          ctx.restore();
        }
  } else
    for (let row = -over; row < over; row++)
      for (let column = -over; column < over; column++) {
        let x = column * step,
          y = row * step,
          rotation = 0,
          fx = 1,
          fy = 1;
        if (repeat.patternId === "half-drop" && Math.abs(column) % 2 === 1)
          y += step / 2;
        if (repeat.patternId === "brick" && Math.abs(row) % 2 === 1)
          x += step / 2;
        if (repeat.patternId === "checker-rotate" && (row + column) % 2 !== 0)
          rotation = 180;
        if (repeat.patternId === "mirror-grid") {
          fx = column % 2 === 0 ? 1 : -1;
          fy = row % 2 === 0 ? 1 : -1;
        }
        if (repeat.patternId === "quarter-turn-rosette")
          rotation = [
            [0, 90],
            [270, 180],
          ][((row % 2) + 2) % 2][((column % 2) + 2) % 2];
        const triangle = repeat.patternId === "triangle-kaleidoscope";
        if (triangle) {
          rotation = ((row + column) % 2) * 180;
          fx = column % 2 ? -1 : 1;
        }
        drawTile(
          ctx,
          tile,
          x,
          y,
          size,
          size,
          repeat,
          rotation,
          fx,
          fy,
          triangle ? "triangle" : "rect",
        );
      }
  if (repeat.showGuides) {
    ctx.strokeStyle = "rgba(71,49,91,.35)";
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function sourceDisplayRect(
  width: number,
  height: number,
  sourceWidth: number,
  sourceHeight: number,
) {
  const fit = Math.min(width / sourceWidth, height / sourceHeight) * 0.88;
  const w = sourceWidth * fit,
    h = sourceHeight * fit;
  return { x: (width - w) / 2, y: (height - h) / 2, width: w, height: h };
}

export function renderCrop(
  ctx: CanvasRenderingContext2D,
  img: SizedSource,
  width: number,
  height: number,
  crop: CropRenderState,
) {
  ctx.clearRect(0, 0, width, height);
  const checker = 16;
  for (let y = 0; y < height; y += checker)
    for (let x = 0; x < width; x += checker) {
      ctx.fillStyle = (x / checker + y / checker) % 2 ? "#e5e0ea" : "#f7f4f8";
      ctx.fillRect(x, y, checker, checker);
    }
  const source = preparedSource(img, crop),
    rect = sourceDisplayRect(width, height, source.width, source.height);
  ctx.drawImage(source, rect.x, rect.y, rect.width, rect.height);
}

export type { PatternId };
