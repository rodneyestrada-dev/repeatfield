// Tile Turn algebra — the 2×2 Repeat Block (internally: metatile).
// Cell order is row-major: [top-left, top-right, bottom-left, bottom-right].

export type QuarterTurn = 0 | 1 | 2 | 3;

export interface MetatileState {
  size: 2;
  cells: readonly [QuarterTurn, QuarterTurn, QuarterTurn, QuarterTurn];
}

export const DEFAULT_METATILE: MetatileState = {
  size: 2,
  cells: [0, 0, 0, 0],
};

export function rotateCell(turn: QuarterTurn, delta: 1 | -1): QuarterTurn {
  return (((turn + delta) % 4) + 4) % 4 as QuarterTurn;
}

// Whole-block rotation: positions permute spatially AND each cell gains a turn.
// CW (delta=1): new TL ← old BL, new TR ← old TL, new BR ← old TR, new BL ← old BR.
export function rotateMetatile(
  block: MetatileState,
  delta: 1 | -1,
): MetatileState {
  const [tl, tr, bl, br] = block.cells;
  const cells: [QuarterTurn, QuarterTurn, QuarterTurn, QuarterTurn] =
    delta === 1
      ? [rotateCell(bl, 1), rotateCell(tl, 1), rotateCell(br, 1), rotateCell(tr, 1)]
      : [rotateCell(tr, -1), rotateCell(br, -1), rotateCell(tl, -1), rotateCell(bl, -1)];
  return { size: 2, cells };
}

export function metatileCode(block: MetatileState): string {
  return block.cells.join("");
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
  for (let value = 0; value < 256; value++)
    result.push({
      size: 2,
      cells: [
        ((value >> 6) & 3) as QuarterTurn,
        ((value >> 4) & 3) as QuarterTurn,
        ((value >> 2) & 3) as QuarterTurn,
        (value & 3) as QuarterTurn,
      ],
    });
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
