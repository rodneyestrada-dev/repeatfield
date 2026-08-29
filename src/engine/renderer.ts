import type { Quad } from "./geometry";
import { mapUnitSquareToQuad } from "./geometry";
import { applyAlphaMask, hexToRgb } from "./background";
import type { CellTransform, MetatileState } from "./metatile";
import { computeFrameLayout, edgePhaseFraction, type TileRole } from "./frameLayout";
import { applyLook, isDefaultLook, type SetLook } from "./appearance";
import type {
  CropState,
  FieldComposition,
  TessellateComposition,
  TileSetComposition,
} from "../app/state";
import type { ShapeInstance } from "./tessellation";
import { analyzeParallelogramCoverage, type CoverageResult, type StampMask } from "./coverage";

type SizedSource = CanvasImageSource & { width: number; height: number };
type P = { x: number; y: number };

function canvas(width: number, height: number) {
  const result = document.createElement("canvas");
  result.width = Math.max(1, Math.round(width));
  result.height = Math.max(1, Math.round(height));
  return result;
}

// ---------------------------------------------------------------------------
// Source preparation
// ---------------------------------------------------------------------------

export function orientedSource(
  img: SizedSource,
  crop: Pick<CropState, "rotation" | "flipX" | "flipY">,
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
  crop: CropState,
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

// ---------------------------------------------------------------------------
// Warp: the sampling quad is the warpQuad expressed inside the selection.
// Moving the selection moves the whole sample; moving warp pins changes the
// mapping into the square target without moving the selection.
// ---------------------------------------------------------------------------

export function effectiveSamplingQuad(crop: CropState): Quad {
  return crop.warpQuad.map((pin) =>
    mapUnitSquareToQuad(crop.selectionQuad, pin),
  ) as unknown as Quad;
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

/** The single rectified square tile every downstream stage consumes. */
export function rectifiedTile(
  img: SizedSource,
  crop: CropState,
  size = 512,
): HTMLCanvasElement {
  return rectifyQuad(preparedSource(img, crop), effectiveSamplingQuad(crop), size);
}

// ---------------------------------------------------------------------------
// Tile Turn: render the 2×2 Repeat Block (metatile)
// ---------------------------------------------------------------------------

export function applyCellTransform(
  ctx: Pick<CanvasRenderingContext2D, "rotate" | "scale">,
  cell: CellTransform,
) {
  ctx.rotate((cell.rotation * Math.PI) / 2);
  ctx.scale(cell.flipX ? -1 : 1, cell.flipY ? -1 : 1);
}

export function renderMetatile(
  sourceTile: SizedSource,
  metatile: MetatileState,
  cellSize: number,
): HTMLCanvasElement {
  const result = canvas(cellSize * 2, cellSize * 2);
  const ctx = result.getContext("2d")!;
  metatile.cells.forEach((cell, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    ctx.save();
    ctx.translate(
      column * cellSize + cellSize / 2,
      row * cellSize + cellSize / 2,
    );
    applyCellTransform(ctx, cell);
    ctx.drawImage(sourceTile, -cellSize / 2, -cellSize / 2, cellSize, cellSize);
    ctx.restore();
  });
  return result;
}

// ---------------------------------------------------------------------------
// Field Tile: Tile Turn → Field Layout → optional Advanced Symmetry
// ---------------------------------------------------------------------------

function sourceAdjustedTile(
  tile: SizedSource,
  composition: FieldComposition,
  size: number,
): HTMLCanvasElement {
  const result = canvas(size, size);
  const ctx = result.getContext("2d")!;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, size, size);
  ctx.clip();
  ctx.translate(size / 2, size / 2);
  ctx.rotate((composition.sourceRotation * Math.PI) / 180);
  ctx.translate(composition.sourceOffsetX, composition.sourceOffsetY);
  const z = composition.sourceZoom;
  ctx.drawImage(tile, (-size * z) / 2, (-size * z) / 2, size * z, size * z);
  ctx.restore();
  return result;
}

export function renderFieldComposition(
  ctx: CanvasRenderingContext2D,
  img: SizedSource,
  width: number,
  height: number,
  crop: CropState,
  composition: FieldComposition,
) {
  const base = rectifiedTile(img, crop);
  const cell = Math.max(8, composition.tileScale);
  const adjusted = sourceAdjustedTile(base, composition, 256);
  const block = renderMetatile(adjusted, composition.metatile, cell);
  const transparent = crop.backgroundRemoval.enabled;

  ctx.save();
  ctx.clearRect(0, 0, width, height);
  if (!transparent) {
    ctx.fillStyle = composition.background;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.translate(width / 2, height / 2);
  ctx.rotate((composition.fieldRotation * Math.PI) / 180);
  ctx.translate(-width / 2, -height / 2);

  const gap = composition.gap;
  const blockStep = cell * 2 + gap;

  if (composition.symmetry === "radial-kaleidoscope") {
    const segments = composition.segments;
    const angle = (Math.PI * 2) / segments;
    const radius = cell * 1.45;
    const step = radius * 2 + gap;
    for (let row = -2; row < height / step + 2; row++)
      for (let column = -2; column < width / step + 2; column++)
        for (let index = 0; index < segments; index++) {
          const cx = column * step + radius;
          const cy = row * step + radius;
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
          ctx.drawImage(adjusted, -radius, -radius, radius * 2, radius * 2);
          ctx.restore();
        }
  } else if (composition.symmetry === "triangle-kaleidoscope") {
    const step = cell + gap;
    const over = Math.ceil(Math.hypot(width, height) / step) + 3;
    for (let row = -over; row < over; row++)
      for (let column = -over; column < over; column++) {
        const rotation = ((row + column) % 2) * 180;
        const fx = column % 2 ? -1 : 1;
        ctx.save();
        ctx.translate(column * step + cell / 2, row * step + cell / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.scale(fx, 1);
        ctx.beginPath();
        ctx.moveTo(-cell / 2, cell / 2);
        ctx.lineTo(0, -cell / 2);
        ctx.lineTo(cell / 2, cell / 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(adjusted, -cell / 2, -cell / 2, cell, cell);
        ctx.restore();
      }
  } else {
    const over = Math.ceil(Math.hypot(width, height) / blockStep) + 2;
    for (let row = -over; row < over; row++)
      for (let column = -over; column < over; column++) {
        let x = column * blockStep;
        let y = row * blockStep;
        if (composition.layout === "brick" && Math.abs(row) % 2 === 1)
          x += blockStep / 2;
        if (composition.layout === "half-drop" && Math.abs(column) % 2 === 1)
          y += blockStep / 2;
        let fx = 1;
        let fy = 1;
        if (composition.symmetry === "mirror-grid") {
          fx = column % 2 === 0 ? 1 : -1;
          fy = row % 2 === 0 ? 1 : -1;
        }
        ctx.save();
        ctx.translate(x + cell, y + cell);
        ctx.scale(fx, fy);
        ctx.drawImage(block, -cell, -cell, cell * 2, cell * 2);
        ctx.restore();
      }
  }

  if (composition.showGuides) {
    ctx.strokeStyle = "rgba(71,49,91,.35)";
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += blockStep) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += blockStep) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Simple 2×2 straight seam preview used by the Crop stage. */
export function renderSeamCheck(
  ctx: CanvasRenderingContext2D,
  img: SizedSource,
  width: number,
  height: number,
  crop: CropState,
) {
  const tile = rectifiedTile(img, crop, 256);
  ctx.clearRect(0, 0, width, height);
  const cell = Math.min(width, height) / 2;
  for (let row = 0; row < Math.ceil(height / cell); row++)
    for (let column = 0; column < Math.ceil(width / cell); column++)
      ctx.drawImage(tile, column * cell, row * cell, cell, cell);
  ctx.strokeStyle = "rgba(71,49,91,.35)";
  ctx.lineWidth = 1;
  ctx.strokeRect(cell, 0, 0.5, height);
  ctx.strokeRect(0, cell, width, 0.5);
}

// ---------------------------------------------------------------------------
// Tile Set: Field interior + Edge runs + Corner joins
// ---------------------------------------------------------------------------

export interface RoleTiles {
  field: HTMLCanvasElement | null;
  border: HTMLCanvasElement | null;
  corner: HTMLCanvasElement | null;
}


export function lookedTile(
  tile: HTMLCanvasElement,
  look: SetLook,
): HTMLCanvasElement {
  if (isDefaultLook(look)) return tile;
  const result = canvas(tile.width, tile.height);
  const ctx = result.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(tile, 0, 0);
  const image = ctx.getImageData(0, 0, result.width, result.height);
  image.data.set(applyLook(image.data, look));
  ctx.putImageData(image, 0, 0);
  return result;
}

export function renderTileSetComposition(
  ctx: CanvasRenderingContext2D,
  roles: RoleTiles,
  composition: TileSetComposition,
  look: SetLook,
  width: number,
  height: number,
) {
  const borderOn = composition.borderEnabled && roles.border !== null;
  const placements = computeFrameLayout({
    fieldColumns: composition.fieldColumns,
    fieldRows: composition.fieldRows,
    tileSize: 100,
    borderEnabled: borderOn,
    cornerEnabled:
      borderOn && composition.cornerEnabled && roles.corner !== null,
    borderPhase: composition.borderPhase,
    borderAlternate: composition.borderAlternate,
    borderReverse: composition.borderReverse,
    cornerBaseRotation: composition.cornerBaseRotation,
    fieldRotation: composition.fieldRotation,
    cornerOverrides: composition.cornerOverrides,
  });
  const columns = composition.fieldColumns + (borderOn ? 2 : 0);
  const rows = composition.fieldRows + (borderOn ? 2 : 0);
  const grout = composition.groutWidth;
  const cell = Math.min(
    (width - grout * (columns + 1)) / columns,
    (height - grout * (rows + 1)) / rows,
  );
  const totalWidth = columns * cell + (columns + 1) * grout;
  const totalHeight = rows * cell + (rows + 1) * grout;
  const originX = (width - totalWidth) / 2;
  const originY = (height - totalHeight) / 2;

  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = composition.groutColor;
  ctx.fillRect(originX, originY, totalWidth, totalHeight);

  const cache = new Map<TileRole, HTMLCanvasElement | null>();
  const roleTile = (role: TileRole) => {
    if (!cache.has(role)) {
      const tile = roles[role];
      cache.set(role, tile ? lookedTile(tile, look) : null);
    }
    return cache.get(role)!;
  };

  for (const placement of placements) {
    if (composition.viewMode !== "set" && placement.role !== composition.viewMode) continue;
    const column = placement.x / 100;
    const row = placement.y / 100;
    const x = originX + grout + column * (cell + grout);
    const y = originY + grout + row * (cell + grout);
    const tile = roleTile(placement.role);
    ctx.save();
    ctx.translate(x + cell / 2, y + cell / 2);
    ctx.rotate((placement.rotation * Math.PI) / 180);
    if (tile) {
      if (placement.role === "border") {
        const phase = edgePhaseFraction(composition.borderPhase) * cell;
        ctx.beginPath();
        ctx.rect(-cell / 2, -cell / 2, cell, cell);
        ctx.clip();
        ctx.drawImage(tile, -cell / 2 + phase, -cell / 2, cell, cell);
        if (phase) ctx.drawImage(tile, -cell / 2 + phase - cell, -cell / 2, cell, cell);
      } else ctx.drawImage(tile, -cell / 2, -cell / 2, cell, cell);
    }
    ctx.restore();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Tessellate: shape instances repeated across the U/V lattice
// ---------------------------------------------------------------------------

export interface ShapeSources {
  primary: HTMLCanvasElement | null;
  infill: HTMLCanvasElement | null;
}

const insetCache = new WeakMap<HTMLCanvasElement, Map<number, HTMLCanvasElement>>();

/** Binary alpha erosion: each edge retreats half the requested grout width. */
function insetAlpha(source: HTMLCanvasElement, radius: number) {
  const r = Math.max(0, Math.round(radius));
  if (!r) return source;
  let byRadius = insetCache.get(source);
  if (!byRadius) insetCache.set(source, (byRadius = new Map()));
  const cached = byRadius.get(r);
  if (cached) return cached;
  const result = canvas(source.width, source.height);
  const ctx = result.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0);
  const image = ctx.getImageData(0, 0, result.width, result.height);
  const original = new Uint8ClampedArray(image.data);
  for (let y = 0; y < result.height; y++)
    for (let x = 0; x < result.width; x++) {
      let keep = true;
      for (let yy = y - r; keep && yy <= y + r; yy++)
        for (let xx = x - r; xx <= x + r; xx++)
          if (xx < 0 || yy < 0 || xx >= result.width || yy >= result.height || original[(yy * result.width + xx) * 4 + 3] < 96) {
            keep = false;
            break;
          }
      if (!keep) image.data[(y * result.width + x) * 4 + 3] = 0;
    }
  ctx.putImageData(image, 0, 0);
  byRadius.set(r, result);
  return result;
}

function drawInstance(ctx: CanvasRenderingContext2D, source: HTMLCanvasElement, instance: ShapeInstance, offsetX: number, offsetY: number, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(instance.position.x + offsetX, instance.position.y + offsetY);
  ctx.rotate((instance.rotation * Math.PI) / 180);
  if (instance.reflected) ctx.scale(-1, 1);
  ctx.drawImage(source, -source.width / 2, -source.height / 2);
  ctx.restore();
}

function latticeRange(width: number, height: number, composition: TessellateComposition, shapes: ShapeSources) {
  const { u, v } = composition.lattice;
  const det = u.x * v.y - u.y * v.x;
  if (Math.abs(det) < 1e-8) return null;
  let pad = 0;
  for (const instance of composition.instances) {
    const source = instance.shapeId === "infill" ? shapes.infill : shapes.primary;
    if (source) pad = Math.max(pad, Math.hypot(source.width, source.height) / 2 + Math.max(Math.abs(instance.position.x), Math.abs(instance.position.y)));
  }
  const toLattice = (x: number, y: number) => ({ i: (x * v.y - y * v.x) / det, j: (u.x * y - u.y * x) / det });
  const corners = [toLattice(-pad, -pad), toLattice(width + pad, -pad), toLattice(-pad, height + pad), toLattice(width + pad, height + pad)];
  return {
    minI: Math.floor(Math.min(...corners.map((p) => p.i))) - 1,
    maxI: Math.ceil(Math.max(...corners.map((p) => p.i))) + 1,
    minJ: Math.floor(Math.min(...corners.map((p) => p.j))) - 1,
    maxJ: Math.ceil(Math.max(...corners.map((p) => p.j))) + 1,
  };
}

export function renderTessellation(ctx: CanvasRenderingContext2D, shapes: ShapeSources, composition: TessellateComposition, width: number, height: number, options: { ghostCells?: boolean; export?: boolean } = {}) {
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  const { u, v } = composition.lattice;
  const isField = composition.outputMode === "field";
  const offsets: P[] = [];
  const range = isField ? latticeRange(width, height, composition, shapes) : null;
  if (range) {
    for (let j = range.minJ; j <= range.maxJ; j++)
      for (let i = range.minI; i <= range.maxI; i++) offsets.push({ x: i * u.x + j * v.x, y: i * u.y + j * v.y });
  } else if (options.ghostCells) {
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) offsets.push({ x: i * u.x + j * v.x, y: i * u.y + j * v.y });
  } else offsets.push({ x: 0, y: 0 });
  for (const offset of offsets) {
    const isCenter = offset.x === 0 && offset.y === 0;
    const alpha = isCenter || isField || options.export ? 1 : 0.35;
    if (!isField && !isCenter && !options.ghostCells) continue;
    if (!isField && !isCenter && options.export) continue;
    for (const instance of composition.instances) {
      const image = instance.shapeId === "infill" ? shapes.infill : shapes.primary;
      if (image) drawInstance(ctx, composition.groutMode === "grout" ? insetAlpha(image, composition.groutWidth / 2) : image, instance, offset.x, offset.y, alpha);
    }
  }
  ctx.restore();
}

export function drawRepeatCellBoundary(ctx: CanvasRenderingContext2D, composition: TessellateComposition, originX: number, originY: number) {
  const { u, v } = composition.lattice;
  ctx.save();
  ctx.setLineDash([6, 5]);
  ctx.strokeStyle = "rgba(96,64,150,.7)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(originX, originY);
  ctx.lineTo(originX + u.x, originY + u.y);
  ctx.lineTo(originX + u.x + v.x, originY + u.y + v.y);
  ctx.lineTo(originX + v.x, originY + v.y);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function rasterStamp(source: HTMLCanvasElement, instance: ShapeInstance, scale: number): StampMask {
  const diagonal = Math.max(2, Math.ceil(Math.hypot(source.width, source.height) * scale) + 2);
  const stampCanvas = canvas(diagonal, diagonal);
  const stampCtx = stampCanvas.getContext("2d", { willReadFrequently: true })!;
  stampCtx.translate(diagonal / 2, diagonal / 2);
  stampCtx.rotate((instance.rotation * Math.PI) / 180);
  if (instance.reflected) stampCtx.scale(-1, 1);
  stampCtx.drawImage(source, (-source.width * scale) / 2, (-source.height * scale) / 2, source.width * scale, source.height * scale);
  const pixels = stampCtx.getImageData(0, 0, diagonal, diagonal).data;
  const mask = new Uint8Array(diagonal * diagonal);
  for (let index = 0; index < mask.length; index++) mask[index] = pixels[index * 4 + 3] > 96 ? 1 : 0;
  return { data: mask, width: diagonal, height: diagonal, offsetX: instance.position.x * scale - diagonal / 2, offsetY: instance.position.y * scale - diagonal / 2 };
}

export function tessellationCoverage(shapes: ShapeSources, composition: TessellateComposition, scale = 0.5): CoverageResult | null {
  const { u, v } = composition.lattice;
  const cellWidth = Math.max(8, Math.min(256, Math.round(Math.hypot(u.x, u.y) * scale)));
  const cellHeight = Math.max(8, Math.min(256, Math.round(Math.hypot(v.x, v.y) * scale)));
  if (!composition.instances.length) return null;
  const stamps: StampMask[] = [];
  const rawStamps: StampMask[] = [];
  for (const instance of composition.instances) {
    const image = instance.shapeId === "infill" ? shapes.infill : shapes.primary;
    if (!image) continue;
    rawStamps.push(rasterStamp(image, instance, scale));
    stamps.push(rasterStamp(composition.groutMode === "grout" ? insetAlpha(image, composition.groutWidth / 2) : image, instance, scale));
  }
  if (!stamps.length) return null;
  return analyzeParallelogramCoverage(cellWidth, cellHeight, stamps, { x: u.x * scale, y: u.y * scale }, { x: v.x * scale, y: v.y * scale }, composition.groutMode === "grout" ? rawStamps : stamps);
}

export function renderCoverageHeatmap(ctx: CanvasRenderingContext2D, result: CoverageResult, u: P, v: P) {
  const image = ctx.createImageData(result.cellWidth, result.cellHeight);
  for (let index = 0; index < result.counts.length; index++) {
    const count = result.counts[index];
    const offset = index * 4;
    if (count === 0) {
      image.data[offset] = 225; image.data[offset + 1] = 60; image.data[offset + 2] = 60; image.data[offset + 3] = 190;
    } else if (count === 254) {
      image.data[offset] = 225; image.data[offset + 1] = 225; image.data[offset + 2] = 235; image.data[offset + 3] = 135;
    } else if (count >= 2) {
      image.data[offset] = 220; image.data[offset + 1] = 60; image.data[offset + 2] = 220; image.data[offset + 3] = 190;
    }
  }
  const buffer = canvas(result.cellWidth, result.cellHeight);
  buffer.getContext("2d")!.putImageData(image, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.save();
  ctx.transform(u.x / result.cellWidth, u.y / result.cellWidth, v.x / result.cellHeight, v.y / result.cellHeight, 0, 0);
  ctx.drawImage(buffer, 0, 0);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Crop stage backdrop
// ---------------------------------------------------------------------------

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
  crop: CropState,
) {
  ctx.clearRect(0, 0, width, height);
  const checker = 16;
  for (let y = 0; y < height; y += checker)
    for (let x = 0; x < width; x += checker) {
      ctx.fillStyle = (x / checker + y / checker) % 2 ? "#ece2d6" : "#faf5ee";
      ctx.fillRect(x, y, checker, checker);
    }
  const source = preparedSource(img, crop),
    rect = sourceDisplayRect(width, height, source.width, source.height);
  ctx.drawImage(source, rect.x, rect.y, rect.width, rect.height);
}
