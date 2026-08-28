// Phase 1.5 context proof: a single polished framed-poster scene rendered in
// Canvas 2D. The pattern is mapped into a predefined print area; wall, frame,
// mat, lighting, and shadow are a fixed template. No 3D, no scene assets.

export type PosterAspect = "square" | "portrait" | "landscape";

export interface PosterSceneOptions {
  /** Pattern density inside the print: >1 zooms in (fewer tiles visible). */
  zoom: number;
  /** Print pan as a fraction of the print size, -0.6 … 0.6. */
  offsetX: number;
  offsetY: number;
  frameColor: string;
  matColor: string;
}

export const DEFAULT_POSTER_OPTIONS: PosterSceneOptions = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
  frameColor: "#17151a",
  matColor: "#fffdf5",
};

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PosterSceneLayout {
  frame: Rect;
  mat: Rect;
  print: Rect;
  frameThickness: number;
  matWidth: number;
  shadowOffset: number;
}

const ASPECT_RATIO: Record<PosterAspect, number> = {
  square: 1,
  portrait: 4 / 5,
  landscape: 5 / 4,
};

/** Deterministic scene geometry: print ⊂ mat ⊂ frame ⊂ scene, all centered. */
export function posterSceneLayout(
  width: number,
  height: number,
  aspect: PosterAspect,
): PosterSceneLayout {
  const unit = Math.min(width, height);
  const frameThickness = Math.max(6, Math.round(unit * 0.02));
  const matWidth = Math.max(10, Math.round(unit * 0.055));
  const ratio = ASPECT_RATIO[aspect];

  // Fit the print inside the available area, then wrap mat and frame around it.
  const availableW = width * 0.86 - 2 * (frameThickness + matWidth);
  const availableH = height * 0.8 - 2 * (frameThickness + matWidth);
  let printW = availableW;
  let printH = printW / ratio;
  if (printH > availableH) {
    printH = availableH;
    printW = printH * ratio;
  }
  printW = Math.max(1, Math.round(printW));
  printH = Math.max(1, Math.round(printH));

  const matW = printW + 2 * matWidth;
  const matH = printH + 2 * matWidth;
  const frameW = matW + 2 * frameThickness;
  const frameH = matH + 2 * frameThickness;
  // Slightly above center reads as hung on a wall.
  const frameX = Math.round((width - frameW) / 2);
  const frameY = Math.round((height - frameH) / 2 - height * 0.015);

  return {
    frame: { x: frameX, y: frameY, width: frameW, height: frameH },
    mat: {
      x: frameX + frameThickness,
      y: frameY + frameThickness,
      width: matW,
      height: matH,
    },
    print: {
      x: frameX + frameThickness + matWidth,
      y: frameY + frameThickness + matWidth,
      width: printW,
      height: printH,
    },
    frameThickness,
    matWidth,
    shadowOffset: Math.max(4, Math.round(unit * 0.016)),
  };
}

type SizedSource = CanvasImageSource & { width: number; height: number };

/**
 * Paint the framed-poster scene. `pattern` is the finished field rendered
 * elsewhere (same renderer as the clean preview/export); the scene only
 * composes it into the print area with cover-fit, zoom, and pan.
 */
export function renderPosterScene(
  ctx: CanvasRenderingContext2D,
  pattern: SizedSource,
  width: number,
  height: number,
  aspect: PosterAspect,
  options: PosterSceneOptions = DEFAULT_POSTER_OPTIONS,
) {
  const { frame, mat, print, frameThickness, shadowOffset } =
    posterSceneLayout(width, height, aspect);

  // Wall: warm paper with a soft top-left light. Scene content, not chrome.
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#e9e2d8";
  ctx.fillRect(0, 0, width, height);
  const light = ctx.createRadialGradient(
    width * 0.3,
    height * 0.18,
    0,
    width * 0.3,
    height * 0.18,
    Math.max(width, height) * 0.95,
  );
  light.addColorStop(0, "rgba(255,252,244,0.5)");
  light.addColorStop(1, "rgba(120,100,84,0.16)");
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, width, height);

  // Hard offset shadow — the frame hangs off the wall.
  ctx.fillStyle = "rgba(23,21,26,0.3)";
  ctx.fillRect(
    frame.x + shadowOffset,
    frame.y + shadowOffset,
    frame.width,
    frame.height,
  );

  // Frame with a simple bevel.
  ctx.fillStyle = options.frameColor;
  ctx.fillRect(frame.x, frame.y, frame.width, frame.height);
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = Math.max(1, frameThickness * 0.12);
  ctx.strokeRect(
    frame.x + frameThickness * 0.28,
    frame.y + frameThickness * 0.28,
    frame.width - frameThickness * 0.56,
    frame.height - frameThickness * 0.56,
  );

  // Mat.
  ctx.fillStyle = options.matColor;
  ctx.fillRect(mat.x, mat.y, mat.width, mat.height);

  // Print: cover-fit the pattern with zoom and pan, clipped to the print area.
  const zoom = Math.max(0.2, options.zoom);
  const scale =
    Math.max(print.width / pattern.width, print.height / pattern.height) * zoom;
  const drawW = pattern.width * scale;
  const drawH = pattern.height * scale;
  const dx =
    print.x + (print.width - drawW) / 2 + options.offsetX * print.width;
  const dy =
    print.y + (print.height - drawH) / 2 + options.offsetY * print.height;
  ctx.save();
  ctx.beginPath();
  ctx.rect(print.x, print.y, print.width, print.height);
  ctx.clip();
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(pattern, dx, dy, drawW, drawH);
  // Glass sheen across the print.
  const sheen = ctx.createLinearGradient(
    print.x,
    print.y,
    print.x + print.width,
    print.y + print.height,
  );
  sheen.addColorStop(0, "rgba(255,255,255,0.14)");
  sheen.addColorStop(0.45, "rgba(255,255,255,0)");
  sheen.addColorStop(1, "rgba(23,21,26,0.05)");
  ctx.fillStyle = sheen;
  ctx.fillRect(print.x, print.y, print.width, print.height);
  ctx.restore();

  // Mat bevel against the print.
  ctx.strokeStyle = "rgba(23,21,26,0.18)";
  ctx.lineWidth = 1;
  ctx.strokeRect(print.x - 0.5, print.y - 0.5, print.width + 1, print.height + 1);
  ctx.restore();
}
