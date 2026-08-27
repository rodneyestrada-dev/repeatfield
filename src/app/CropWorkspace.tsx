import { useEffect, useRef, useState } from "react";
import type { CropState, CropToolId, Action } from "./state";
import {
  orientedSource,
  rectifiedTile,
  renderCrop,
  renderSeamCheck,
  sourceDisplayRect,
} from "../engine/renderer";
import { mapUnitSquareToQuad, type Point } from "../engine/geometry";
import { rgbToHex } from "../engine/background";
import { CROP_TOOLS } from "./cropTools";
import { Range } from "./common";

const NUDGE = 0.005;
const NUDGE_LARGE = 0.05;

function CropToolOptions({
  tool,
  crop,
  dispatch,
  onClose,
}: {
  tool: CropToolId;
  crop: CropState;
  dispatch: (action: Action) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [onClose]);
  return (
    <div
      ref={ref}
      className="tool-options"
      role="group"
      aria-label={`${tool} tool options`}
      data-testid="tool-options"
    >
      {tool === "select" && (
        <>
          <p>
            Drag corners, edges, or the inside of the selection. Arrow keys
            nudge · Shift+Arrow moves faster.
          </p>
          <button onClick={() => dispatch({ type: "crop-reset-selection" })}>
            Reset selection
          </button>
        </>
      )}
      {tool === "warp" && (
        <>
          <p>
            Drag the round warp pins to change how the selected pixels map
            into the square tile. The inset shows the live rectified result.
          </p>
          <button onClick={() => dispatch({ type: "crop-reset-warp" })}>
            Reset warp
          </button>
        </>
      )}
      {tool === "background" && (
        <>
          <p>Click a color in the image to make similar pixels transparent.</p>
          <label className="color">
            Sampled color{" "}
            <input
              aria-label="Background color"
              type="color"
              value={crop.backgroundRemoval.color}
              onChange={(e) => {
                dispatch({
                  type: "crop-background",
                  key: "color",
                  value: e.target.value,
                });
                dispatch({
                  type: "crop-background",
                  key: "enabled",
                  value: true,
                });
              }}
            />
            <code>{crop.backgroundRemoval.color}</code>
          </label>
          <Range
            label="Removal tolerance"
            value={crop.backgroundRemoval.tolerance}
            min={0}
            max={100}
            onChange={(value) =>
              dispatch({ type: "crop-background", key: "tolerance", value })
            }
          />
          <Range
            label="Edge feather"
            value={crop.backgroundRemoval.feather}
            min={0}
            max={50}
            onChange={(value) =>
              dispatch({ type: "crop-background", key: "feather", value })
            }
          />
          <button
            disabled={!crop.backgroundRemoval.enabled}
            onClick={() =>
              dispatch({ type: "crop-background", key: "enabled", value: false })
            }
          >
            Reset background removal
          </button>
        </>
      )}
    </div>
  );
}

function CropCanvas({
  img,
  crop,
  dispatch,
}: {
  img: HTMLImageElement | null;
  crop: CropState;
  dispatch: (action: Action) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const insetRef = useRef<HTMLCanvasElement>(null);
  const [viewport, setViewport] = useState({ width: 1, height: 1 });
  const drag = useRef<
    | { kind: "corner"; index: number }
    | { kind: "pin"; index: number }
    | { kind: "polygon"; last: Point }
    | null
  >(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !img) return;
    const paint = () => {
      const r = c.getBoundingClientRect();
      const d = Math.min(devicePixelRatio || 1, 2);
      c.width = Math.max(1, Math.round(r.width * d));
      c.height = Math.max(1, Math.round(r.height * d));
      const x = c.getContext("2d")!;
      x.setTransform(d, 0, 0, d, 0, 0);
      renderCrop(x, img, r.width, r.height, crop);
      setViewport({ width: r.width, height: r.height });
    };
    paint();
    const ro = new ResizeObserver(paint);
    ro.observe(c);
    return () => ro.disconnect();
  }, [img, crop]);
  // Live rectified inset while Warp is active
  useEffect(() => {
    const inset = insetRef.current;
    if (!inset || !img || crop.activeTool !== "warp") return;
    const tile = rectifiedTile(img, crop, 180);
    inset.width = 180;
    inset.height = 180;
    inset.getContext("2d")!.drawImage(tile, 0, 0);
  }, [img, crop]);
  if (!img)
    return (
      <canvas ref={ref} className="crop-canvas" data-testid="pattern-canvas" />
    );
  const turns = ((Math.round(crop.rotation / 90) % 4) + 4) % 4;
  const sourceWidth = turns % 2 ? img.height : img.width;
  const sourceHeight = turns % 2 ? img.width : img.height;
  const rect = sourceDisplayRect(
    viewport.width,
    viewport.height,
    sourceWidth,
    sourceHeight,
  );
  const screenPoint = (point: Point) => ({
    x: rect.x + point.x * rect.width,
    y: rect.y + point.y * rect.height,
  });
  const toSource = (clientX: number, clientY: number): Point => {
    const bounds = ref.current!.getBoundingClientRect();
    return {
      x: (clientX - bounds.left - rect.x) / rect.width,
      y: (clientY - bounds.top - rect.y) / rect.height,
    };
  };
  const points = crop.selectionQuad.map(screenPoint);
  const warpPoints = crop.warpQuad
    .map((pin) => mapUnitSquareToQuad(crop.selectionQuad, pin))
    .map(screenPoint);
  const mode = crop.activeTool;
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    const current = drag.current;
    if (!current || !ref.current) return;
    const point = toSource(e.clientX, e.clientY);
    if (current.kind === "corner")
      dispatch({ type: "crop-set-corner", index: current.index, point });
    else if (current.kind === "pin") {
      // Convert absolute source point back into selection-relative units by
      // solving through the selection quad's inverse homography.
      dispatch({
        type: "crop-set-warp-pin",
        index: current.index,
        point: inverseSelectionPoint(crop, point),
      });
    } else {
      dispatch({
        type: "crop-translate-selection",
        delta: { x: point.x - current.last.x, y: point.y - current.last.y },
      });
      drag.current = { kind: "polygon", last: point };
    }
  };
  const keyNudge = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? NUDGE_LARGE : NUDGE;
    const deltas: Record<string, Point> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    };
    const delta = deltas[e.key];
    if (!delta) return;
    e.preventDefault();
    dispatch({ type: "crop-translate-selection", delta });
  };
  const gridLines = Array.from({ length: 18 }, (_, index) => {
    const vertical = index < 9;
    const position = ((index % 9) + 1) / 10;
    const samples = Array.from({ length: 13 }, (_, sample) => {
      const t = sample / 12;
      return screenPoint(
        mapUnitSquareToQuad(
          crop.selectionQuad,
          vertical ? { x: position, y: t } : { x: t, y: position },
        ),
      );
    });
    return (
      <polyline
        key={index}
        points={samples.map((p) => `${p.x},${p.y}`).join(" ")}
        className={position === 0.5 ? "crop-grid-major" : "crop-grid-line"}
      />
    );
  });
  return (
    <div className="crop-canvas-wrap">
      <canvas ref={ref} className="crop-canvas" data-testid="pattern-canvas" />
      <svg
        className={`crop-lasso crop-mode-${mode}`}
        viewBox={`0 0 ${viewport.width} ${viewport.height}`}
        onPointerMove={move}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onClick={(e) => {
          if (mode !== "background" || !ref.current) return;
          const point = toSource(e.clientX, e.clientY);
          if (point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) return;
          const source = orientedSource(img, crop);
          const pixel = source
            .getContext("2d", { willReadFrequently: true })!
            .getImageData(
              Math.min(source.width - 1, Math.floor(point.x * source.width)),
              Math.min(
                source.height - 1,
                Math.floor(point.y * source.height),
              ),
              1,
              1,
            ).data;
          dispatch({
            type: "crop-background",
            key: "color",
            value: rgbToHex({ r: pixel[0], g: pixel[1], b: pixel[2] }),
          });
          dispatch({ type: "crop-background", key: "enabled", value: true });
        }}
        aria-label="Perspective crop lasso"
      >
        <polygon
          points={points.map((p) => `${p.x},${p.y}`).join(" ")}
          className="crop-quad"
          data-testid="crop-selection"
          tabIndex={mode === "select" ? 0 : -1}
          aria-label="Tile selection — drag or use arrow keys to move"
          onKeyDown={keyNudge}
          onPointerDown={(e) => {
            if (mode !== "select") return;
            drag.current = {
              kind: "polygon",
              last: toSource(e.clientX, e.clientY),
            };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
        />
        {gridLines}
        {mode !== "warp" &&
          points.map((point, index) => (
            <g
              key={index}
              onPointerDown={(e) => {
                if (mode === "background") return;
                drag.current = { kind: "corner", index };
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
            >
              <circle
                data-testid={`crop-handle-${index}`}
                aria-label={`Crop corner ${index + 1}`}
                className="crop-handle-hit"
                cx={point.x}
                cy={point.y}
                r="22"
              />
              <circle className="crop-handle" cx={point.x} cy={point.y} r="8" />
            </g>
          ))}
        {mode === "warp" &&
          warpPoints.map((point, index) => (
            <g
              key={index}
              onPointerDown={(e) => {
                drag.current = { kind: "pin", index };
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
            >
              <circle
                data-testid={`warp-pin-${index}`}
                aria-label={`Warp pin ${index + 1}`}
                className="warp-pin-hit"
                cx={point.x}
                cy={point.y}
                r="22"
              />
              <circle className="warp-pin" cx={point.x} cy={point.y} r="7" />
            </g>
          ))}
      </svg>
      {mode === "warp" && (
        <div className="warp-inset" data-testid="warp-inset">
          <canvas ref={insetRef} data-testid="rectified-preview" />
          <small>Rectified tile</small>
        </div>
      )}
    </div>
  );
}

import { mapQuadToUnitSquare } from "../engine/geometry";
function inverseSelectionPoint(crop: CropState, point: Point): Point {
  return mapQuadToUnitSquare(crop.selectionQuad, point);
}

export function CropWorkspace({
  img,
  crop,
  dispatch,
  continueLabel,
  onContinue,
  aside,
  showSeam = true,
}: {
  img: HTMLImageElement | null;
  crop: CropState;
  dispatch: (action: Action) => void;
  continueLabel: string;
  onContinue: () => void;
  aside?: React.ReactNode;
  showSeam?: boolean;
}) {
  const seamRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = seamRef.current;
    if (!c || !img || !showSeam) return;
    const paint = () => {
      const r = c.getBoundingClientRect();
      const d = Math.min(devicePixelRatio || 1, 2);
      c.width = Math.max(1, Math.round(r.width * d));
      c.height = Math.max(1, Math.round(r.height * d));
      const x = c.getContext("2d")!;
      x.setTransform(d, 0, 0, d, 0, 0);
      renderSeamCheck(x, img, r.width, r.height, crop);
    };
    paint();
    const ro = new ResizeObserver(paint);
    ro.observe(c);
    return () => ro.disconnect();
  }, [img, crop, showSeam]);
  const runCommand = (id: string) => {
    if (id === "rotate") dispatch({ type: "crop-rotate" });
    else if (id === "flip-x") dispatch({ type: "crop-flip", axis: "x" });
    else if (id === "flip-y") dispatch({ type: "crop-flip", axis: "y" });
    else if (id === "reset") dispatch({ type: "crop-reset" });
  };
  return (
    <div className="crop-shell">
      <div className="crop-body">
        <div className="tool-dock" role="toolbar" aria-label="Crop tools">
          {CROP_TOOLS.map((tool) => (
            <button
              key={tool.id}
              className="tool-button"
              title={tool.label}
              aria-label={tool.label}
              aria-pressed={
                tool.kind === "modal" ? crop.activeTool === tool.id : undefined
              }
              onClick={() => {
                if (tool.kind === "command") runCommand(tool.id);
                else if (crop.activeTool === tool.id)
                  dispatch({
                    type: "crop-toggle-options",
                    tool: tool.id as CropToolId,
                  });
                else
                  dispatch({
                    type: "crop-set-tool",
                    tool: tool.id as CropToolId,
                  });
              }}
            >
              {tool.icon}
              <span className="tool-tip">{tool.label}</span>
            </button>
          ))}
        </div>
        <section className="crop-stage">
          <CropCanvas img={img} crop={crop} dispatch={dispatch} />
          {crop.openToolOptions && (
            <CropToolOptions
              tool={crop.openToolOptions}
              crop={crop}
              dispatch={dispatch}
              onClose={() => dispatch({ type: "crop-toggle-options", tool: null })}
            />
          )}
        </section>
        <aside className="crop-side">
          {aside}
          {showSeam && (
            <div className="seam">
              <div>
                <span className="eyebrow">2 × 2 SEAM CHECK</span>
                <small>Inspect how your chosen edges meet.</small>
              </div>
              <canvas ref={seamRef} data-testid="seam-check" />
            </div>
          )}
        </aside>
      </div>
      <div className="crop-action-bar">
        <button className="primary continue" onClick={onContinue}>
          {continueLabel}
        </button>
      </div>
    </div>
  );
}
