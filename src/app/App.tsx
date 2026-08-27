import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { appReducer, INITIAL_STATE, type Workspace } from "./state";
import {
  PATTERNS,
  segmentOptions,
  type RepeatSettings,
} from "../engine/patterns";
import {
  orientedSource,
  renderCrop,
  renderPattern,
  sourceDisplayRect,
} from "../engine/renderer";
import { rgbToHex } from "../engine/background";
import { mapUnitSquareToQuad, type Point } from "../engine/geometry";
import { exportFilename, validateExport } from "../engine/export";

export function demoImageUrl(base: string) {
  const normalized = base.endsWith("/") ? base : `${base}/`;
  return `${normalized}source-tile.jpg`;
}

const DEMO = demoImageUrl(import.meta.env.BASE_URL);
type CropMode = "lasso" | "warp" | "remove";
function useImage(src: string) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    const i = new Image();
    i.onload = () => setImg(i);
    i.src = src;
    return () => setImg(null);
  }, [src]);
  return img;
}
function PatternCanvas({
  img,
  crop,
  repeat,
  className = "",
  testId = "pattern-canvas",
  onDrag,
}: {
  img: HTMLImageElement | null;
  crop: typeof INITIAL_STATE.crop;
  repeat: RepeatSettings;
  className?: string;
  testId?: string;
  onDrag?: (dx: number, dy: number) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null),
    drag = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !img) return;
    const paint = () => {
      const r = c.getBoundingClientRect(),
        d = Math.min(devicePixelRatio || 1, 2);
      c.width = Math.max(1, Math.round(r.width * d));
      c.height = Math.max(1, Math.round(r.height * d));
      const x = c.getContext("2d");
      if (!x) return;
      x.setTransform(d, 0, 0, d, 0, 0);
      renderPattern(x, img, r.width, r.height, crop, repeat);
    };
    paint();
    const ro = new ResizeObserver(paint);
    ro.observe(c);
    return () => ro.disconnect();
  }, [img, crop, repeat]);
  return (
    <canvas
      ref={ref}
      className={className}
      data-testid={testId}
      style={{ backgroundColor: repeat.background }}
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, y: e.clientY };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (drag.current && onDrag) {
          onDrag(e.clientX - drag.current.x, e.clientY - drag.current.y);
          drag.current = { x: e.clientX, y: e.clientY };
        }
      }}
      onPointerUp={() => (drag.current = null)}
    />
  );
}
function CropCanvas({
  img,
  crop,
  mode,
  onCorner,
  onPickColor,
}: {
  img: HTMLImageElement | null;
  crop: typeof INITIAL_STATE.crop;
  mode: CropMode;
  onCorner: (index: number, point: Point) => void;
  onPickColor: (point: Point) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [viewport, setViewport] = useState({ width: 1, height: 1 });
  const drag = useRef<number | null>(null);
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
  const points = crop.quad.map(screenPoint);
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    if (drag.current === null || !ref.current) return;
    const bounds = ref.current.getBoundingClientRect();
    onCorner(drag.current, {
      x: (e.clientX - bounds.left - rect.x) / rect.width,
      y: (e.clientY - bounds.top - rect.y) / rect.height,
    });
  };
  const gridLines = Array.from({ length: 18 }, (_, index) => {
    const vertical = index < 9;
    const position = ((index % 9) + 1) / 10;
    const samples = Array.from({ length: 13 }, (_, sample) => {
      const t = sample / 12;
      return screenPoint(
        mapUnitSquareToQuad(
          crop.quad,
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
          if (mode !== "remove" || !ref.current) return;
          const bounds = ref.current.getBoundingClientRect();
          const point = {
            x: (e.clientX - bounds.left - rect.x) / rect.width,
            y: (e.clientY - bounds.top - rect.y) / rect.height,
          };
          if (point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1)
            onPickColor(point);
        }}
        aria-label="Perspective crop lasso"
      >
        <polygon
          points={points.map((p) => `${p.x},${p.y}`).join(" ")}
          className="crop-quad"
        />
        {gridLines}
        {points.map((point, index) => (
          <g
            key={index}
            onPointerDown={(e) => {
              if (mode === "remove") return;
              drag.current = index;
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
      </svg>
    </div>
  );
}
function Range({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="range">
      <span>
        {label}
        <output>
          {value}
          {label.toLowerCase().includes("rotation") ? "°" : ""}
        </output>
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
export function App() {
  const [state, dispatch] = useReducer(appReducer, INITIAL_STATE),
    [src, setSrc] = useState(DEMO),
    [fileName, setFileName] = useState("Demo tile"),
    [dims, setDims] = useState({ width: 1080, height: 1080 }),
    [frame, setFrame] = useState<"square" | "portrait" | "landscape">("square"),
    [cropMode, setCropMode] = useState<CropMode>("lasso");
  const img = useImage(src);
  useEffect(() => {
    history.replaceState(
      { workspace: state.workspace },
      "",
      `#${state.workspace}`,
    );
  }, [state.workspace]);
  useEffect(() => {
    const pop = () => {
      const w = location.hash.slice(1) as Workspace;
      if (["crop", "repeat", "preview"].includes(w))
        dispatch({ type: "set-workspace", value: w });
    };
    addEventListener("popstate", pop);
    return () => removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    const shortcuts = (event: KeyboardEvent) => {
      if (state.workspace !== "repeat" || !(event.metaKey || event.ctrlKey))
        return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.matches("input, select, textarea, [contenteditable='true']")
      )
        return;
      const key = event.key.toLowerCase();
      const redo =
        (key === "z" && event.shiftKey) ||
        (key === "y" && event.ctrlKey && !event.metaKey);
      const undo = key === "z" && !event.shiftKey;
      if (!undo && !redo) return;
      event.preventDefault();
      dispatch({ type: redo ? "redo-repeat" : "undo-repeat" });
    };
    addEventListener("keydown", shortcuts);
    return () => removeEventListener("keydown", shortcuts);
  }, [state.workspace]);
  const active = useMemo(
    () => PATTERNS.find((p) => p.id === state.repeat.patternId)!,
    [state.repeat.patternId],
  );
  const setRepeat = (
    key: keyof RepeatSettings,
    value: RepeatSettings[keyof RepeatSettings],
  ) => dispatch({ type: "repeat", key, value });
  const upload = (file?: File) => {
    if (!file) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      !file.size
    )
      return;
    const url = URL.createObjectURL(file);
    setSrc((old) => {
      if (old.startsWith("blob:")) URL.revokeObjectURL(old);
      return url;
    });
    setFileName(file.name);
  };
  const download = () => {
    if (!img) return;
    const { width, height } = validateExport(dims.width, dims.height),
      canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    renderPattern(canvas.getContext("2d")!, img, width, height, state.crop, {
      ...state.repeat,
      showGuides: false,
      tileScale: state.repeat.tileScale * (width / 900),
    });
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = exportFilename(active.name, width, height);
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, "image/png");
  };
  if (state.workspace === "preview")
    return (
      <main className={`preview preview-${frame}`}>
        <PatternCanvas
          img={img}
          crop={state.crop}
          repeat={{ ...state.repeat, showGuides: false }}
          className="preview-canvas"
        />
        <h1 className="sr-only">Preview field</h1>
        <div className="preview-toolbar">
          <button
            onClick={() => dispatch({ type: "set-workspace", value: "repeat" })}
          >
            Back to edit
          </button>
          <div className="frame-select" aria-label="Preview framing">
            {(["square", "portrait", "landscape"] as const).map((f) => (
              <button
                key={f}
                className={frame === f ? "on" : ""}
                onClick={() => setFrame(f)}
              >
                {f}
              </button>
            ))}
          </div>
          <button
            onClick={() => document.documentElement.requestFullscreen?.()}
          >
            Fullscreen-style preview
          </button>
          <label>
            W{" "}
            <input
              aria-label="Export width"
              type="number"
              min="64"
              max="6000"
              value={dims.width}
              onChange={(e) =>
                setDims({ ...dims, width: Number(e.target.value) })
              }
            />
          </label>
          <label>
            H{" "}
            <input
              aria-label="Export height"
              type="number"
              min="64"
              max="6000"
              value={dims.height}
              onChange={(e) =>
                setDims({ ...dims, height: Number(e.target.value) })
              }
            />
          </label>
          <button className="primary" onClick={download}>
            Download PNG ↗
          </button>
        </div>
      </main>
    );
  return (
    <div className="app-shell">
      <header className="topbar" role="banner">
        <div className="brand">
          <span className="brand-mark">◒</span>
          <span>
            <b>Repeatfield</b>
            <small>One tile. Infinite fields.</small>
          </span>
        </div>
        <nav role="tablist" aria-label="Workspaces">
          {(
            [
              ["crop", "01 Crop"],
              ["repeat", "02 Repeat"],
              ["preview", "03 Preview"],
            ] as [Workspace, string][]
          ).map(([w, n]) => (
            <button
              key={w}
              role="tab"
              aria-selected={state.workspace === w}
              onClick={() => dispatch({ type: "set-workspace", value: w })}
            >
              <i />
              {n}
            </button>
          ))}
        </nav>
        <div className="local">● Browser local</div>
      </header>
      <div className="filebar">
        <div>
          <span
            className="file-thumb"
            style={{ backgroundImage: `url(${src})` }}
          />
          <strong>{fileName}</strong>
          <small>
            {img ? `${img.naturalWidth} × ${img.naturalHeight}` : "Loading…"}
          </small>
        </div>
        <label className="button">
          {fileName === "Demo tile" ? "Upload image" : "Replace image"}
          <input
            aria-label="Upload image"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => upload(e.target.files?.[0])}
          />
        </label>
        <span>Your image never leaves this browser.</span>
      </div>
      {state.workspace === "crop" ? (
        <main className="crop-workspace">
          <section className="intro">
            <span className="eyebrow">01 / SOURCE TILE</span>
            <h1>
              Choose the part
              <br />
              that becomes a field.
            </h1>
            <p>
              Drag the four corners around the source. The square target grid
              shows how the selected quadrilateral will be rectified.
            </p>
            <div className="crop-instructions">
              <b>Drag all 4 corners around one tile</b>
              <span>
                Each corner moves independently · output is always square
              </span>
            </div>
            <div className="crop-mode-toolbar" aria-label="Crop tools">
              <button
                aria-pressed={cropMode === "lasso"}
                onClick={() => setCropMode("lasso")}
              >
                <b>1 · LASSO TILE</b>
                <span>Direct 4-point selection</span>
              </button>
              <button
                aria-pressed={cropMode === "warp"}
                onClick={() => setCropMode("warp")}
              >
                <b>2 · WARP TO SQUARE</b>
                <span>Target grid + rectification</span>
              </button>
              <button
                aria-pressed={cropMode === "remove"}
                onClick={() => setCropMode("remove")}
              >
                <b>3 · REMOVE BACKGROUND</b>
                <span>Click an unwanted color</span>
              </button>
            </div>
          </section>
          <section className="crop-stage">
            <CropCanvas
              img={img}
              crop={state.crop}
              mode={cropMode}
              onCorner={(index, point) =>
                dispatch({ type: "set-crop-corner", index, point })
              }
              onPickColor={(point) => {
                if (!img) return;
                const source = orientedSource(img, state.crop);
                const pixel = source
                  .getContext("2d", { willReadFrequently: true })!
                  .getImageData(
                    Math.min(
                      source.width - 1,
                      Math.floor(point.x * source.width),
                    ),
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
                dispatch({
                  type: "crop-background",
                  key: "enabled",
                  value: true,
                });
              }}
            />
            <div className="stage-label">
              Drag a corner · square target grid previews rectification
            </div>
          </section>
          <aside className="crop-tools">
            <h2>Orient the source</h2>
            <p className="tool-note">
              Use the lasso directly on the image. These actions rotate or
              mirror the source before rectification.
            </p>
            {cropMode === "remove" && (
              <div className="background-tools">
                <p>
                  <b>Click an unwanted color in the image.</b> Similar pixels
                  become transparent locally in your browser.
                </p>
                <label className="color">
                  Sampled color{" "}
                  <input
                    aria-label="Background color"
                    type="color"
                    value={state.crop.backgroundRemoval.color}
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
                  <code>{state.crop.backgroundRemoval.color}</code>
                </label>
                <Range
                  label="Removal tolerance"
                  value={state.crop.backgroundRemoval.tolerance}
                  min={0}
                  max={100}
                  onChange={(value) =>
                    dispatch({
                      type: "crop-background",
                      key: "tolerance",
                      value,
                    })
                  }
                />
                <Range
                  label="Edge feather"
                  value={state.crop.backgroundRemoval.feather}
                  min={0}
                  max={50}
                  onChange={(value) =>
                    dispatch({ type: "crop-background", key: "feather", value })
                  }
                />
                <button
                  className="remove-reset"
                  disabled={!state.crop.backgroundRemoval.enabled}
                  onClick={() =>
                    dispatch({
                      type: "crop-background",
                      key: "enabled",
                      value: false,
                    })
                  }
                >
                  Reset background removal
                </button>
              </div>
            )}
            <div className="tool-grid">
              <button onClick={() => dispatch({ type: "rotate-crop" })}>
                Rotate 90°
              </button>
              <button
                onClick={() => dispatch({ type: "flip-crop", axis: "x" })}
              >
                Flip H
              </button>
              <button
                onClick={() => dispatch({ type: "flip-crop", axis: "y" })}
              >
                Flip V
              </button>
              <button onClick={() => dispatch({ type: "reset-crop" })}>
                Reset crop
              </button>
            </div>
            <div className="seam">
              <div>
                <span className="eyebrow">2 × 2 SEAM CHECK</span>
                <small>Inspect how your chosen edges meet.</small>
              </div>
              <PatternCanvas
                img={img}
                crop={state.crop}
                repeat={{
                  ...state.repeat,
                  patternId: "straight",
                  tileScale: 72,
                  gap: 0,
                  showGuides: true,
                }}
                testId="seam-check"
              />
            </div>
            <button
              className="primary continue"
              onClick={() =>
                dispatch({ type: "set-workspace", value: "repeat" })
              }
            >
              Continue to Repeat →
            </button>
          </aside>
        </main>
      ) : (
        <main className="repeat-workspace">
          <aside className="preset-rail">
            <span className="eyebrow">WAYS TO REPEAT</span>
            <h1>
              Find the field
              <br />
              inside one tile.
            </h1>
            <p>Rotate, reflect and fold your image into new visual systems.</p>
            <div className="presets">
              {PATTERNS.map((p) => (
                <button
                  key={p.id}
                  aria-label={p.name}
                  aria-pressed={state.repeat.patternId === p.id}
                  onClick={() => setRepeat("patternId", p.id)}
                >
                  <span
                    className={`preset-art art-${p.id}`}
                    style={{ backgroundImage: `url(${src})` }}
                  />
                  <b>{p.name}</b>
                  <small>{p.code}</small>
                </button>
              ))}
            </div>
          </aside>
          <section className="field-stage">
            <PatternCanvas
              img={img}
              crop={state.crop}
              repeat={state.repeat}
              onDrag={(dx, dy) => {
                setRepeat("sourceOffsetX", state.repeat.sourceOffsetX + dx);
                setRepeat("sourceOffsetY", state.repeat.sourceOffsetY + dy);
              }}
            />
            <div className="field-title">
              <b>{active.name}</b>
              <small>Live pattern field</small>
            </div>
            <div className="field-hint">
              DRAG TO MOVE SOURCE · USE CONTROLS TO SHAPE
            </div>
          </section>
          <aside className="inspector">
            <div className="inspector-head">
              <div>
                <h2>Shape the field</h2>
                <small>{active.code} / 08</small>
              </div>
              <div className="history-actions" aria-label="Repeat history">
                <button
                  aria-label="Undo Repeat change"
                  title="Undo Repeat change (⌘/Ctrl+Z)"
                  disabled={!state.repeatHistory.past.length}
                  onClick={() => dispatch({ type: "undo-repeat" })}
                >
                  ↶
                </button>
                <button
                  aria-label="Redo Repeat change"
                  title="Redo Repeat change (⌘/Ctrl+Shift+Z or Ctrl+Y)"
                  disabled={!state.repeatHistory.future.length}
                  onClick={() => dispatch({ type: "redo-repeat" })}
                >
                  ↷
                </button>
              </div>
            </div>
            <section>
              <h3>Source</h3>
              <Range
                label="Source zoom"
                value={state.repeat.sourceZoom}
                min={0.25}
                max={3}
                step={0.01}
                onChange={(v) => setRepeat("sourceZoom", v)}
              />
              <Range
                label="Horizontal offset"
                value={state.repeat.sourceOffsetX}
                min={-150}
                max={150}
                onChange={(v) => setRepeat("sourceOffsetX", v)}
              />
              <Range
                label="Vertical offset"
                value={state.repeat.sourceOffsetY}
                min={-150}
                max={150}
                onChange={(v) => setRepeat("sourceOffsetY", v)}
              />
              <Range
                label="Source rotation"
                value={state.repeat.sourceRotation}
                min={-180}
                max={180}
                onChange={(v) => setRepeat("sourceRotation", v)}
              />
            </section>
            <section>
              <h3>Field</h3>
              <Range
                label="Tile scale"
                value={state.repeat.tileScale}
                min={50}
                max={320}
                onChange={(v) => setRepeat("tileScale", v)}
              />
              <Range
                label="Gap"
                value={state.repeat.gap}
                min={0}
                max={80}
                onChange={(v) => setRepeat("gap", v)}
              />
              <Range
                label="Field rotation"
                value={state.repeat.fieldRotation}
                min={-45}
                max={45}
                onChange={(v) => setRepeat("fieldRotation", v)}
              />
              <label className="toggle">
                Cell guides
                <input
                  type="checkbox"
                  checked={state.repeat.showGuides}
                  onChange={(e) => setRepeat("showGuides", e.target.checked)}
                />
              </label>
            </section>
            <section>
              <h3>Symmetry</h3>
              <div className="segments">
                {segmentOptions.map((n) => (
                  <button
                    key={n}
                    className={state.repeat.segments === n ? "on" : ""}
                    onClick={() => setRepeat("segments", n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </section>
            <section>
              <h3>Canvas</h3>
              <label className="color">
                Background{" "}
                <input
                  aria-label="Background"
                  type="color"
                  value={state.repeat.background}
                  onChange={(e) => setRepeat("background", e.target.value)}
                />
                <code>{state.repeat.background}</code>
              </label>
            </section>
            <div className="inspector-actions">
              <button onClick={() => dispatch({ type: "reset-repeat" })}>
                Reset pattern
              </button>
              <button
                className="primary"
                onClick={() =>
                  dispatch({ type: "set-workspace", value: "preview" })
                }
              >
                Preview output →
              </button>
            </div>
          </aside>
        </main>
      )}
    </div>
  );
}
