// Contour extraction from binary alpha masks.
// Boundary tracing over pixel-grid edges (marching-squares-equivalent):
// keeps the largest outer contour, reports interior holes separately.

export interface ContourPoint {
  x: number;
  y: number;
}

export interface ContourResult {
  outer: ContourPoint[] | null;
  holes: ContourPoint[][];
}

export function contourArea(contour: ContourPoint[]): number {
  let sum = 0;
  for (let i = 0; i < contour.length; i++) {
    const a = contour[i];
    const b = contour[(i + 1) % contour.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

function largestComponent(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
): Uint8Array | null {
  const labels = new Int32Array(width * height).fill(-1);
  let best = -1;
  let bestSize = 0;
  let next = 0;
  const queue: number[] = [];
  for (let start = 0; start < width * height; start++) {
    if (!data[start] || labels[start] !== -1) continue;
    const label = next++;
    let size = 0;
    queue.length = 0;
    queue.push(start);
    labels[start] = label;
    while (queue.length) {
      const index = queue.pop()!;
      size++;
      const x = index % width;
      const y = (index / width) | 0;
      const neighbors = [
        x > 0 ? index - 1 : -1,
        x < width - 1 ? index + 1 : -1,
        y > 0 ? index - width : -1,
        y < height - 1 ? index + width : -1,
      ];
      for (const n of neighbors)
        if (n >= 0 && data[n] && labels[n] === -1) {
          labels[n] = label;
          queue.push(n);
        }
    }
    if (size > bestSize) {
      bestSize = size;
      best = label;
    }
  }
  if (best === -1) return null;
  const mask = new Uint8Array(width * height);
  for (let index = 0; index < mask.length; index++)
    if (labels[index] === best) mask[index] = 1;
  return mask;
}

/** Trace all closed boundary loops of a binary mask on the pixel-corner grid. */
function traceLoops(
  mask: Uint8Array,
  width: number,
  height: number,
): ContourPoint[][] {
  const filled = (x: number, y: number) =>
    x >= 0 && x < width && y >= 0 && y < height && mask[y * width + x] === 1;
  // Directed edges keep the filled region on the left:
  // outer loops trace counter-clockwise in screen space, holes clockwise.
  const edges = new Map<string, ContourPoint[]>();
  const key = (p: ContourPoint) => `${p.x},${p.y}`;
  const addEdge = (from: ContourPoint, to: ContourPoint) => {
    const k = key(from);
    if (!edges.has(k)) edges.set(k, []);
    edges.get(k)!.push(to);
  };
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (!filled(x, y)) continue;
      if (!filled(x, y - 1)) addEdge({ x, y }, { x: x + 1, y });
      if (!filled(x + 1, y)) addEdge({ x: x + 1, y }, { x: x + 1, y: y + 1 });
      if (!filled(x, y + 1)) addEdge({ x: x + 1, y: y + 1 }, { x, y: y + 1 });
      if (!filled(x - 1, y)) addEdge({ x, y: y + 1 }, { x, y });
    }
  const loops: ContourPoint[][] = [];
  while (edges.size) {
    const [startKey, targets] = edges.entries().next().value as [
      string,
      ContourPoint[],
    ];
    const [sx, sy] = startKey.split(",").map(Number);
    const loop: ContourPoint[] = [{ x: sx, y: sy }];
    let current = targets.shift()!;
    if (!targets.length) edges.delete(startKey);
    while (current.x !== sx || current.y !== sy) {
      loop.push(current);
      const k = key(current);
      const nextTargets = edges.get(k);
      if (!nextTargets || !nextTargets.length) break;
      current = nextTargets.shift()!;
      if (!nextTargets.length) edges.delete(k);
    }
    if (loop.length >= 3) loops.push(loop);
  }
  return loops;
}

export function extractContours(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  options: { minArea?: number } = {},
): ContourResult {
  const minArea = options.minArea ?? 1;
  const component = largestComponent(data, width, height);
  if (!component) return { outer: null, holes: [] };
  const loops = traceLoops(component, width, height);
  if (!loops.length) return { outer: null, holes: [] };
  let outer: ContourPoint[] | null = null;
  let outerArea = 0;
  for (const loop of loops) {
    const area = Math.abs(contourArea(loop));
    if (area > outerArea) {
      outerArea = area;
      outer = loop;
    }
  }
  if (!outer || outerArea < minArea) return { outer: null, holes: [] };
  const holes = loops.filter(
    (loop) => loop !== outer && Math.abs(contourArea(loop)) >= minArea,
  );
  return { outer, holes };
}

/** Douglas–Peucker simplification for a closed contour. */
export function simplifyContour(
  contour: ContourPoint[],
  tolerance: number,
): ContourPoint[] {
  if (contour.length <= 4) return contour.slice();
  const keep = new Uint8Array(contour.length);
  keep[0] = 1;
  const anchorEnd = Math.floor(contour.length / 2);
  keep[anchorEnd] = 1;
  const distance = (p: ContourPoint, a: ContourPoint, b: ContourPoint) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    if (length < 1e-12) return Math.hypot(p.x - a.x, p.y - a.y);
    return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / length;
  };
  const stack: [number, number][] = [
    [0, anchorEnd],
    [anchorEnd, contour.length],
  ];
  while (stack.length) {
    const [from, to] = stack.pop()!;
    const a = contour[from];
    const b = contour[to % contour.length];
    let maxDistance = 0;
    let farthest = -1;
    for (let index = from + 1; index < to; index++) {
      const d = distance(contour[index], a, b);
      if (d > maxDistance) {
        maxDistance = d;
        farthest = index;
      }
    }
    if (farthest !== -1 && maxDistance > tolerance) {
      keep[farthest] = 1;
      stack.push([from, farthest], [farthest, to]);
    }
  }
  const result = contour.filter((_, index) => keep[index]);
  return result.length >= 3 ? result : contour.slice();
}
