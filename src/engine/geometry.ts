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
export function invertHomography(m: Homography): Homography {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h,
    B = c * h - b * i,
    C = b * f - c * e,
    D = f * g - d * i,
    E = a * i - c * g,
    F = c * d - a * f,
    G = d * h - e * g,
    H = b * g - a * h,
    I = a * e - b * d;
  const det = a * A + b * D + c * G;
  const s = Math.abs(det) < 1e-12 ? 0 : 1 / det;
  return [A * s, B * s, C * s, D * s, E * s, F * s, G * s, H * s, I * s];
}
export function mapQuadToUnitSquare(quad: Quad, p: Point): Point {
  return mapHomography(invertHomography(homographyFromUnitSquare(quad)), p);
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
export function translateQuad(quad: Quad, delta: Point): Quad {
  return quad.map((point) => ({
    x: point.x + delta.x,
    y: point.y + delta.y,
  })) as unknown as Quad;
}
export function clampQuadTranslation(quad: Quad, delta: Point): Point {
  const xs = quad.map((point) => point.x);
  const ys = quad.map((point) => point.y);
  const clampedX = Math.max(
    -Math.min(...xs),
    Math.min(1 - Math.max(...xs), delta.x),
  );
  const clampedY = Math.max(
    -Math.min(...ys),
    Math.min(1 - Math.max(...ys), delta.y),
  );
  return { x: clampedX, y: clampedY };
}
export function moveQuadEdge(quad: Quad, edgeIndex: number, delta: Point): Quad {
  const next = quad.map((point) => ({ ...point })) as unknown as [
    Point,
    Point,
    Point,
    Point,
  ];
  const a = edgeIndex % 4;
  const b = (edgeIndex + 1) % 4;
  next[a] = { x: next[a].x + delta.x, y: next[a].y + delta.y };
  next[b] = { x: next[b].x + delta.x, y: next[b].y + delta.y };
  return next;
}
export function isSimpleConvexQuad(quad: Quad): boolean {
  let sign = 0;
  for (let index = 0; index < 4; index++) {
    const a = quad[index];
    const b = quad[(index + 1) % 4];
    const c = quad[(index + 2) % 4];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-9) return false;
    const current = Math.sign(cross);
    if (sign === 0) sign = current;
    else if (current !== sign) return false;
  }
  return true;
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
