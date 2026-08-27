// Framed Tile Set layout — Field interior, Edge (internally "border") runs,
// and Corner joins. Public UI label for the border role is "Edge".

export type TileRole = "field" | "border" | "corner";
export type TileRotation = 0 | 90 | 180 | 270;
export type FrameSide = "top" | "right" | "bottom" | "left";
export type FrameCorner =
  | "top-left"
  | "top-right"
  | "bottom-right"
  | "bottom-left";

export interface FrameLayoutInput {
  fieldColumns: number;
  fieldRows: number;
  tileSize: number;
  borderEnabled: boolean;
  cornerEnabled: boolean;
  borderPhase: number;
  borderAlternate: boolean;
  borderReverse: boolean;
  cornerBaseRotation: TileRotation;
  cornerOverrides: Partial<Record<FrameCorner, TileRotation>>;
}

export interface TilePlacement {
  role: TileRole;
  x: number;
  y: number;
  rotation: TileRotation;
  side?: FrameSide;
  corner?: FrameCorner;
}

const turn = (base: TileRotation, quarter: number): TileRotation =>
  (((base + quarter * 90) % 360) + 360) % 360 as TileRotation;

const SIDE_ROTATION: Record<FrameSide, TileRotation> = {
  top: 0,
  right: 90,
  bottom: 180,
  left: 270,
};

const CORNER_TURNS: Record<FrameCorner, number> = {
  "top-left": 0,
  "top-right": 1,
  "bottom-right": 2,
  "bottom-left": 3,
};

export function computeFrameLayout(input: FrameLayoutInput): TilePlacement[] {
  const {
    fieldColumns,
    fieldRows,
    tileSize,
    borderEnabled,
    cornerEnabled,
    borderPhase,
    borderAlternate,
    borderReverse,
    cornerBaseRotation,
    cornerOverrides,
  } = input;
  const placements: TilePlacement[] = [];
  const inset = borderEnabled ? tileSize : 0;

  for (let row = 0; row < fieldRows; row++)
    for (let column = 0; column < fieldColumns; column++)
      placements.push({
        role: "field",
        x: inset + column * tileSize,
        y: inset + row * tileSize,
        rotation: 0,
      });

  if (!borderEnabled) return placements;

  const totalColumns = fieldColumns + 2;
  const totalRows = fieldRows + 2;
  const maxX = (totalColumns - 1) * tileSize;
  const maxY = (totalRows - 1) * tileSize;

  const borderRotation = (side: FrameSide, index: number): TileRotation => {
    let rotation = SIDE_ROTATION[side];
    if (borderAlternate && (index + borderPhase) % 2 === 1)
      rotation = turn(rotation, 2);
    if (borderReverse) rotation = turn(rotation, 2);
    return rotation;
  };

  for (let column = 1; column <= fieldColumns; column++) {
    placements.push({
      role: "border",
      x: column * tileSize,
      y: 0,
      rotation: borderRotation("top", column - 1),
      side: "top",
    });
    placements.push({
      role: "border",
      x: column * tileSize,
      y: maxY,
      rotation: borderRotation("bottom", column - 1),
      side: "bottom",
    });
  }
  for (let row = 1; row <= fieldRows; row++) {
    placements.push({
      role: "border",
      x: 0,
      y: row * tileSize,
      rotation: borderRotation("left", row - 1),
      side: "left",
    });
    placements.push({
      role: "border",
      x: maxX,
      y: row * tileSize,
      rotation: borderRotation("right", row - 1),
      side: "right",
    });
  }

  if (!cornerEnabled) return placements;

  const cornerPositions: Record<FrameCorner, { x: number; y: number }> = {
    "top-left": { x: 0, y: 0 },
    "top-right": { x: maxX, y: 0 },
    "bottom-right": { x: maxX, y: maxY },
    "bottom-left": { x: 0, y: maxY },
  };
  (Object.keys(cornerPositions) as FrameCorner[]).forEach((corner) => {
    placements.push({
      role: "corner",
      ...cornerPositions[corner],
      rotation:
        cornerOverrides[corner] ??
        turn(cornerBaseRotation, CORNER_TURNS[corner]),
      corner,
    });
  });
  return placements;
}
