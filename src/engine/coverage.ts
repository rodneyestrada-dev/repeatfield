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
  neighborRange = 1,
): CoverageResult {
  const counts = new Uint8Array(cellWidth * cellHeight);
  for (const stamp of stamps)
    for (let j = -neighborRange; j <= neighborRange; j++)
      for (let i = -neighborRange; i <= neighborRange; i++) {
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
    counts,
    cellWidth,
    cellHeight,
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
