// Tile Turn algebra — the 2×2 Repeat Block (internally: metatile).
// Cell order is row-major: [top-left, top-right, bottom-left, bottom-right].

export type QuarterTurn = 0 | 1 | 2 | 3;

export interface CellTransform {
  rotation: QuarterTurn;
  flipX: boolean;
  flipY: boolean;
}

export interface MetatileState {
  size: 2;
  cells: readonly [CellTransform, CellTransform, CellTransform, CellTransform];
}

type LegacyMetatile = { size?: number; cells?: readonly unknown[] };

export const IDENTITY_CELL: CellTransform = {
  rotation: 0,
  flipX: false,
  flipY: false,
};

const identityCell = (): CellTransform => ({ ...IDENTITY_CELL });

export const DEFAULT_METATILE: MetatileState = {
  size: 2,
  cells: [identityCell(), identityCell(), identityCell(), identityCell()],
};

export function normalizeCellTransform(value: unknown): CellTransform {
  const candidate: Partial<CellTransform> = typeof value === "object" && value !== null
    ? value as Partial<CellTransform>
    : { rotation: value as QuarterTurn };
  const rawRotation = Number(candidate.rotation);
  const rotation = (((Number.isFinite(rawRotation) ? Math.round(rawRotation) : 0) % 4) + 4) % 4 as QuarterTurn;
  return {
    rotation,
    flipX: candidate.flipX === true,
    flipY: candidate.flipY === true,
  };
}

export function normalizeMetatile(value: unknown): MetatileState {
  const cells = (value as LegacyMetatile | null)?.cells ?? [];
  return {
    size: 2,
    cells: [0, 1, 2, 3].map((index) => normalizeCellTransform(cells[index])) as unknown as MetatileState["cells"],
  };
}

export function rotateCell(cell: CellTransform, delta: 1 | -1): CellTransform {
  return {
    ...cell,
    rotation: (((cell.rotation + delta) % 4) + 4) % 4 as QuarterTurn,
  };
}

export function reflectCell(cell: CellTransform, axis: "x" | "y"): CellTransform {
  return axis === "x"
    ? { ...cell, flipX: !cell.flipX }
    : { ...cell, flipY: !cell.flipY };
}

// Whole-block rotation: positions permute spatially AND each cell gains a turn.
// Reflection flags describe the cell's local axes, so they move with the cell.
export function rotateMetatile(block: MetatileState, delta: 1 | -1): MetatileState {
  const [tl, tr, bl, br] = block.cells;
  const cells: MetatileState["cells"] = delta === 1
    ? [rotateCell(bl, 1), rotateCell(tl, 1), rotateCell(br, 1), rotateCell(tr, 1)]
    : [rotateCell(tr, -1), rotateCell(br, -1), rotateCell(tl, -1), rotateCell(bl, -1)];
  return { size: 2, cells };
}

function cellCode(cell: CellTransform): string {
  return `${cell.rotation}${cell.flipX ? "x" : ""}${cell.flipY ? "y" : ""}`;
}

export function metatileCode(block: MetatileState): string {
  return block.cells.map(cellCode).join("");
}

export function canonicalRotationCode(block: MetatileState): string {
  let best = metatileCode(block);
  let current = block;
  for (let index = 0; index < 3; index++) {
    current = rotateMetatile(current, 1);
    const code = metatileCode(current);
    if (code < best) best = code;
  }
  return best;
}

export function enumerateMetatiles(): MetatileState[] {
  const result: MetatileState[] = [];
  for (let value = 0; value < 256; value++) {
    const rotations = [
      ((value >> 6) & 3) as QuarterTurn,
      ((value >> 4) & 3) as QuarterTurn,
      ((value >> 2) & 3) as QuarterTurn,
      (value & 3) as QuarterTurn,
    ];
    result.push(normalizeMetatile({ size: 2, cells: rotations }));
  }
  return result;
}

export function enumerateCanonicalMetatiles(): MetatileState[] {
  const seen = new Set<string>();
  const result: MetatileState[] = [];
  for (const block of enumerateMetatiles()) {
    const canonical = canonicalRotationCode(block);
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    if (metatileCode(block) === canonical) result.push(block);
  }
  return result;
}
