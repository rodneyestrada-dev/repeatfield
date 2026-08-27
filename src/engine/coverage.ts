// Raster coverage analysis for Tessellate — per-pixel 0/1/2+ classification
// including the contribution of neighboring repeat cells.

export interface StampMask {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

export interface CoverageResult {
  validPct: number;
  gapPct: number;
  overlapPct: number;
  /** Deliberately removed spacing in Grout mode; never counted as a gap. */
  groutPct: number;
  counts: Uint8Array;
  cellWidth: number;
  cellHeight: number;
}

export type CoverageStatusLabel =
  | "Gap-free"
  | "Near fit — inspect edges"
  | "Gaps detected"
  | "Overlaps detected"
  | "Decorative packing";

export function analyzeCoverage(
  cellWidth: number,
  cellHeight: number,
  stamps: StampMask[],
  u: { x: number; y: number },
  v: { x: number; y: number },
  neighborRange?: number,
): CoverageResult {
  const shortest = Math.max(1, Math.min(Math.hypot(u.x, u.y), Math.hypot(v.x, v.y)));
  const extent = stamps.reduce(
    (max, stamp) => Math.max(max, Math.abs(stamp.offsetX), Math.abs(stamp.offsetY), stamp.width, stamp.height),
    Math.max(cellWidth, cellHeight),
  );
  const range = neighborRange ?? Math.ceil((extent + Math.hypot(cellWidth, cellHeight)) / shortest) + 1;
  const counts = new Uint8Array(cellWidth * cellHeight);
  for (const stamp of stamps)
    for (let j = -range; j <= range; j++)
      for (let i = -range; i <= range; i++) {
        const baseX = Math.round(stamp.offsetX + i * u.x + j * v.x);
        const baseY = Math.round(stamp.offsetY + i * u.y + j * v.y);
        for (let sy = 0; sy < stamp.height; sy++) {
          const y = baseY + sy;
          if (y < 0 || y >= cellHeight) continue;
          for (let sx = 0; sx < stamp.width; sx++) {
            const x = baseX + sx;
            if (x < 0 || x >= cellWidth) continue;
            if (stamp.data[sy * stamp.width + sx]) {
              const index = y * cellWidth + x;
              if (counts[index] < 255) counts[index]++;
            }
          }
        }
      }
  let gap = 0;
  let valid = 0;
  let overlap = 0;
  for (let index = 0; index < counts.length; index++) {
    if (counts[index] === 0) gap++;
    else if (counts[index] === 1) valid++;
    else overlap++;
  }
  const total = counts.length || 1;
  return {
    validPct: (valid / total) * 100,
    gapPct: (gap / total) * 100,
    overlapPct: (overlap / total) * 100,
    groutPct: 0,
    counts,
    cellWidth,
    cellHeight,
  };
}

type Point = { x: number; y: number };

const latticeCoordinates = (point: Point, u: Point, v: Point) => {
  const det = u.x * v.y - u.y * v.x;
  if (Math.abs(det) < 1e-8) throw new Error("Repeat vectors must form a non-singular cell");
  return {
    i: (point.x * v.y - point.y * v.x) / det,
    j: (u.x * point.y - u.y * point.x) / det,
  };
};

function countAt(point: Point, stamps: StampMask[], u: Point, v: Point) {
  let count = 0;
  for (const stamp of stamps) {
    const latticeCorners = [
      { x: point.x - stamp.offsetX, y: point.y - stamp.offsetY },
      { x: point.x - stamp.offsetX - stamp.width, y: point.y - stamp.offsetY },
      { x: point.x - stamp.offsetX, y: point.y - stamp.offsetY - stamp.height },
      { x: point.x - stamp.offsetX - stamp.width, y: point.y - stamp.offsetY - stamp.height },
    ].map((p) => latticeCoordinates(p, u, v));
    const minI = Math.floor(Math.min(...latticeCorners.map((p) => p.i))) - 1;
    const maxI = Math.ceil(Math.max(...latticeCorners.map((p) => p.i))) + 1;
    const minJ = Math.floor(Math.min(...latticeCorners.map((p) => p.j))) - 1;
    const maxJ = Math.ceil(Math.max(...latticeCorners.map((p) => p.j))) + 1;
    for (let j = minJ; j <= maxJ; j++)
      for (let i = minI; i <= maxI; i++) {
        const x = Math.floor(point.x - i * u.x - j * v.x - stamp.offsetX);
        const y = Math.floor(point.y - i * u.y - j * v.y - stamp.offsetY);
        if (x >= 0 && x < stamp.width && y >= 0 && y < stamp.height && stamp.data[y * stamp.width + x])
          count++;
      }
  }
  return count;
}

/**
 * Canonical raster rule: sample pixel centers in unit lattice coordinates,
 * map them through U/V into the world parallelogram, and classify repeated
 * alpha masks there. In Grout mode, zero inset coverage with raw coverage is
 * intentional grout; only zero raw coverage is an accidental gap.
 */
export function analyzeParallelogramCoverage(
  samplesU: number,
  samplesV: number,
  stamps: StampMask[],
  u: Point,
  v: Point,
  rawStamps: StampMask[] = stamps,
): CoverageResult {
  latticeCoordinates({ x: 0, y: 0 }, u, v);
  const counts = new Uint8Array(samplesU * samplesV);
  let gap = 0, valid = 0, overlap = 0, grout = 0;
  for (let y = 0; y < samplesV; y++)
    for (let x = 0; x < samplesU; x++) {
      const a = (x + 0.5) / samplesU;
      const b = (y + 0.5) / samplesV;
      const point = { x: a * u.x + b * v.x, y: a * u.y + b * v.y };
      const count = countAt(point, stamps, u, v);
      const index = y * samplesU + x;
      if (count > 1) { counts[index] = Math.min(253, count); overlap++; }
      else if (count === 1) { counts[index] = 1; valid++; }
      else if (rawStamps !== stamps && countAt(point, rawStamps, u, v) > 0) {
        counts[index] = 254; grout++;
      } else gap++;
    }
  const total = counts.length || 1;
  return {
    validPct: (valid / total) * 100,
    gapPct: (gap / total) * 100,
    overlapPct: (overlap / total) * 100,
    groutPct: (grout / total) * 100,
    counts,
    cellWidth: samplesU,
    cellHeight: samplesV,
  };
}

export function coverageStatus(result: CoverageResult): CoverageStatusLabel {
  const { gapPct, overlapPct } = result;
  if (gapPct === 0 && overlapPct === 0) return "Gap-free";
  if (gapPct < 0.5 && overlapPct < 0.5) return "Near fit — inspect edges";
  if (overlapPct >= 0.5 && overlapPct >= gapPct) return "Overlaps detected";
  if (gapPct >= 50) return "Decorative packing";
  return "Gaps detected";
}
