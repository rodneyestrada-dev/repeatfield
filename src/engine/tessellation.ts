// Tessellate instance transforms and repeat-lattice helpers.

export interface Point {
  x: number;
  y: number;
}

export interface RepeatLattice {
  u: Point;
  v: Point;
}

export interface ShapeInstance {
  id: string;
  shapeId: string;
  position: Point;
  rotation: number; // degrees
  reflected: boolean;
}

/** Reflect (x) → rotate → translate, matching canvas draw order. */
export function transformPoint(point: Point, instance: ShapeInstance): Point {
  const x0 = instance.reflected ? -point.x : point.x;
  const y0 = point.y;
  const radians = (instance.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: instance.position.x + x0 * cos - y0 * sin,
    y: instance.position.y + x0 * sin + y0 * cos,
  };
}

export function transformContour(
  contour: Point[],
  instance: ShapeInstance,
): Point[] {
  return contour.map((point) => transformPoint(point, instance));
}

/** All lattice translations within ±range cells, row-major, deterministic. */
export function latticeOffsets(u: Point, v: Point, range: number): Point[] {
  const offsets: Point[] = [];
  for (let j = -range; j <= range; j++)
    for (let i = -range; i <= range; i++)
      offsets.push({ x: i * u.x + j * v.x, y: i * u.y + j * v.y });
  return offsets;
}

export function instanceLabel(
  instance: ShapeInstance,
  shapeName: string,
): string {
  const parts = [shapeName, `${instance.rotation}°`];
  if (instance.reflected) parts.push("reflected");
  return parts.join(" · ");
}
