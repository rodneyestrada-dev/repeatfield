import type { PatternId } from "./patterns";
export type CropAspect = "square" | "portrait" | "landscape" | "free";
export interface Point {
  x: number;
  y: number;
}
export type Quad = readonly [Point, Point, Point, Point];
export type Homography = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

export function homographyFromUnitSquare([p0, p1, p2, p3]: Quad): Homography {
  const dx1 = p1.x - p2.x,
    dx2 = p3.x - p2.x,
    sx = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y,
    dy2 = p3.y - p2.y,
    sy = p0.y - p1.y + p2.y - p3.y;
  const denominator = dx1 * dy2 - dx2 * dy1;
  const g =
    Math.abs(denominator) < 1e-12 ? 0 : (sx * dy2 - dx2 * sy) / denominator;
  const h =
    Math.abs(denominator) < 1e-12 ? 0 : (dx1 * sy - sx * dy1) / denominator;
  return [
    p1.x - p0.x + g * p1.x,
    p3.x - p0.x + h * p3.x,
    p0.x,
    p1.y - p0.y + g * p1.y,
    p3.y - p0.y + h * p3.y,
    p0.y,
    g,
    h,
    1,
  ];
}
export function mapHomography(m: Homography, p: Point): Point {
  const w = m[6] * p.x + m[7] * p.y + m[8];
  return {
    x: (m[0] * p.x + m[1] * p.y + m[2]) / w,
    y: (m[3] * p.x + m[4] * p.y + m[5]) / w,
  };
}
export function mapUnitSquareToQuad(quad: Quad, p: Point): Point {
  return mapHomography(homographyFromUnitSquare(quad), p);
}
export function cellTransform(
  id: PatternId,
  row: number,
  column: number,
  size: number,
) {
  let x = column * size,
    y = row * size,
    rotation = 0,
    scaleX = 1,
    scaleY = 1;
  if (id === "half-drop" && Math.abs(column) % 2 === 1) y += size / 2;
  if (id === "brick" && Math.abs(row) % 2 === 1) x += size / 2;
  if (id === "checker-rotate" && (row + column) % 2 !== 0) rotation = 180;
  if (id === "mirror-grid") {
    scaleX = column % 2 === 0 ? 1 : -1;
    scaleY = row % 2 === 0 ? 1 : -1;
  }
  if (id === "quarter-turn-rosette")
    rotation = [
      [0, 90],
      [270, 180],
    ][((row % 2) + 2) % 2][((column % 2) + 2) % 2];
  return { x, y, rotation, scaleX, scaleY };
}
export function wedgeGeometry(segments: number, radius: number) {
  const angle = (Math.PI * 2) / segments;
  return Array.from({ length: segments }, (_, i) => ({
    angle,
    rotation: i * angle,
    mirrored: i % 2 === 1,
    points: [
      [0, 0],
      [radius, -Math.tan(angle / 2) * radius],
      [radius, Math.tan(angle / 2) * radius],
    ],
  }));
}
export function cropRectForAspect(
  width: number,
  height: number,
  aspect: CropAspect,
) {
  if (aspect === "free") return { x: 0, y: 0, width, height };
  const ratio =
    aspect === "square" ? 1 : aspect === "portrait" ? 4 / 5 : 16 / 9;
  let w = width,
    h = w / ratio;
  if (h > height) {
    h = height;
    w = h * ratio;
  }
  return { x: (width - w) / 2, y: (height - h) / 2, width: w, height: h };
}
