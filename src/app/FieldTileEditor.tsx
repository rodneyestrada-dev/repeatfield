import { useEffect, useRef, useState } from "react";
import type { Action, FieldTileProject, PreviewSceneState } from "./state";
import { renderFieldComposition, rectifiedTile, applyCellTransform } from "../engine/renderer";
import { renderPosterScene, type PosterAspect } from "../engine/posterScene";
import { METATILE_PRESET_GROUPS, generateRandomMetatile } from "../engine/metatilePresets";
import { Range, downloadCanvas } from "./common";
import { CropWorkspace } from "./CropWorkspace";
import { exportFilename, validateExport } from "../engine/export";

function FieldCanvas({
  img,
  project,
  className = "",
  testId = "pattern-canvas",
  overrides,
}: {
  img: HTMLImageElement | null;
  project: FieldTileProject;
  className?: string;
  testId?: string;
  overrides?: Partial<FieldTileProject["composition"]>;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
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
      renderFieldComposition(x, img, r.width, r.height, project.crop, {
        ...project.composition,
        ...overrides,
      });
    };
    paint();
    const ro = new ResizeObserver(paint);
    ro.observe(c);
    return () => ro.disconnect();
  }, [img, project, overrides]);
  return <canvas ref={ref} className={className} data-testid={testId} />;
}

function TileTurn({
  img,
  project,
  dispatch,
}: {
  img: HTMLImageElement | null;
  project: FieldTileProject;
  dispatch: (action: Action) => void;
}) {
  const cellRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const cells = project.composition.metatile.cells;
  useEffect(() => {
    if (!img) return;
    const tile = rectifiedTile(img, project.crop, 128);
    cells.forEach((cell, index) => {
      const c = cellRefs.current[index];
      if (!c) return;
      c.width = 96;
      c.height = 96;
      const x = c.getContext("2d")!;
      x.clearRect(0, 0, 96, 96);
      x.save();
      x.translate(48, 48);
      applyCellTransform(x, cell);
      x.drawImage(tile, -48, -48, 96, 96);
      x.restore();
    });
  }, [img, project.crop, cells]);
  const names = ["Top left", "Top right", "Bottom left", "Bottom right"];
  return (
    <section className="tile-turn" aria-label="Tile Turn">
      <h3>Tile Turn</h3>
      <p className="tool-note">
        Rotate each tile to build a repeat block. Click a tile to rotate it.
        Shift-click rotates backward.
      </p>
      <div className="metatile-grid" aria-label="2 × 2 Repeat Block">
        {cells.map((cell, index) => {
          const stateLabel = `${names[index]} tile — ${cell.rotation * 90}° — ${cell.flipX ? "reflected" : "not reflected"} horizontally — ${cell.flipY ? "reflected" : "not reflected"} vertically`;
          return (
            <div className="metatile-cell-wrap" key={index}>
              <button
                className="metatile-cell"
                aria-label={stateLabel}
                title={`${names[index]} · ${cell.rotation * 90}° — click to rotate`}
                onClick={(event) => dispatch({
                  type: "rotate-metatile-cell",
                  index,
                  delta: event.shiftKey ? -1 : 1,
                })}
              >
                <canvas
                  ref={(element) => {
                    cellRefs.current[index] = element;
                  }}
                  aria-hidden="true"
                />
                <span className="cell-angle">
                  {cell.rotation * 90}°{cell.flipX ? " H" : ""}{cell.flipY ? " V" : ""}
                </span>
              </button>
              <div className="cell-transform-actions" role="group" aria-label={`${names[index]} reflections`}>
                <button
                  aria-label={`Reflect ${names[index]} horizontally`}
                  aria-pressed={cell.flipX}
                  onClick={() => dispatch({ type: "reflect-metatile-cell", index, axis: "x" })}
                >H</button>
                <button
                  aria-label={`Reflect ${names[index]} vertically`}
                  aria-pressed={cell.flipY}
                  onClick={() => dispatch({ type: "reflect-metatile-cell", index, axis: "y" })}
                >V</button>
                <button
                  aria-label={`Reset ${names[index]} transform`}
                  onClick={() => dispatch({ type: "reset-metatile-cell", index })}
                >↺</button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="block-actions">
        <button
          aria-label="Rotate whole block clockwise"
          title="Rotate whole block clockwise"
          onClick={() => dispatch({ type: "rotate-metatile-block", delta: 1 })}
        >
          ⟳ Block
        </button>
        <button
          aria-label="Rotate whole block counter-clockwise"
          title="Rotate whole block counter-clockwise"
          onClick={() => dispatch({ type: "rotate-metatile-block", delta: -1 })}
        >
          ⟲ Block
        </button>
        <button
          aria-label="Reset all cells"
          onClick={() => dispatch({
            type: "apply-metatile-preset",
            cells: METATILE_PRESET_GROUPS[0].presets[0].cells!,
          })}
        >
          Reset
        </button>
      </div>
      <div className="metatile-preset-groups" aria-label="Orientation presets">
        {METATILE_PRESET_GROUPS.map((group) => (
          <section key={group.id} className="metatile-preset-group" aria-label={`${group.name} presets`}>
            <h4>{group.name}</h4>
            <div className="metatile-presets">
              {group.presets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => dispatch({
                    type: "apply-metatile-preset",
                    cells: preset.generate
                      ? generateRandomMetatile(preset.generate)
                      : preset.cells!,
                  })}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

export function FieldTileEditor({
  img,
  project,
  dispatch,
  filebar,
}: {
  img: HTMLImageElement | null;
  project: FieldTileProject;
  dispatch: (action: Action) => void;
  filebar: React.ReactNode;
}) {
  const setComposition = (
    key: keyof FieldTileProject["composition"],
    value: FieldTileProject["composition"][keyof FieldTileProject["composition"]],
  ) => dispatch({ type: "field-comp", key, value });
  const composition = project.composition;

  const download = (width: number, height: number) => {
    if (!img) return;
    const dims = validateExport(width, height);
    const canvas = document.createElement("canvas");
    canvas.width = dims.width;
    canvas.height = dims.height;
    renderFieldComposition(
      canvas.getContext("2d")!,
      img,
      dims.width,
      dims.height,
      project.crop,
      {
        ...composition,
        showGuides: false,
        tileScale: composition.tileScale * (dims.width / 900),
      },
    );
    downloadCanvas(
      canvas,
      exportFilename(`field-tile-${composition.layout}`, dims.width, dims.height),
    );
  };

  if (project.stage === "crop")
    return (
      <>
        {filebar}
        <main className="workspace">
          <CropWorkspace
            img={img}
            crop={project.crop}
            dispatch={dispatch}
            continueLabel="Repeat"
            onContinue={() => dispatch({ type: "set-stage", stage: "repeat" })}
            aside={
              <div className="crop-guide">
                <span className="eyebrow">SOURCE TILE</span>
                <h2>Choose the part that becomes a field.</h2>
              </div>
            }
          />
        </main>
      </>
    );

  if (project.stage === "preview")
    return (
      <PreviewStage
        img={img}
        project={project}
        dispatch={dispatch}
        download={download}
      />
    );

  return (
    <>
      {filebar}
      <main className="repeat-workspace">
        <aside className="preset-rail">
          <TileTurn img={img} project={project} dispatch={dispatch} />
        </aside>
        <section className="field-stage">
          <FieldCanvas img={img} project={project} />
          <div className="field-hint">
            THE 2×2 REPEAT BLOCK TILES THE FIELD
          </div>
        </section>
        <aside className="inspector">
          <div className="inspector-head">
            <div>
              <h2>Shape the field</h2>
            </div>
            <div className="history-actions" aria-label="Repeat history">
              <button
                aria-label="Undo Repeat change"
                title="Undo Repeat change (⌘/Ctrl+Z)"
                disabled={!project.history.past.length}
                onClick={() => dispatch({ type: "undo" })}
              >
                ↶
              </button>
              <button
                aria-label="Redo Repeat change"
                title="Redo Repeat change (⌘/Ctrl+Shift+Z or Ctrl+Y)"
                disabled={!project.history.future.length}
                onClick={() => dispatch({ type: "redo" })}
              >
                ↷
              </button>
            </div>
          </div>
          <section aria-label="Field Layout">
            <h3>Field Layout</h3>
            <div className="segments" role="group" aria-label="Field Layout options">
              {(
                [
                  ["straight", "Straight"],
                  ["brick", "Brick"],
                  ["half-drop", "Half-Drop"],
                ] as const
              ).map(([id, name]) => (
                <button
                  key={id}
                  aria-pressed={composition.layout === id}
                  className={composition.layout === id ? "on" : ""}
                  onClick={() => setComposition("layout", id)}
                >
                  {name}
                </button>
              ))}
            </div>
          </section>
          <section>
            <h3>Field</h3>
            <Range
              label="Tile scale"
              value={composition.tileScale}
              min={50}
              max={320}
              onChange={(v) => setComposition("tileScale", v)}
            />
            <Range
              label="Gap"
              value={composition.gap}
              min={0}
              max={80}
              onChange={(v) => setComposition("gap", v)}
            />
            <Range
              label="Field rotation"
              value={composition.fieldRotation}
              min={-45}
              max={45}
              onChange={(v) => setComposition("fieldRotation", v)}
            />
            <label className="toggle">
              Cell guides
              <input
                type="checkbox"
                checked={composition.showGuides}
                onChange={(e) => setComposition("showGuides", e.target.checked)}
              />
            </label>
          </section>
          <section>
            <h3>Source</h3>
            <Range
              label="Source zoom"
              value={composition.sourceZoom}
              min={0.25}
              max={3}
              step={0.01}
              onChange={(v) => setComposition("sourceZoom", v)}
            />
            <Range
              label="Source rotation"
              value={composition.sourceRotation}
              min={-180}
              max={180}
              onChange={(v) => setComposition("sourceRotation", v)}
            />
          </section>
          <details className="advanced" data-testid="advanced-symmetry">
            <summary>Advanced Symmetry</summary>
            <div className="segments" role="group" aria-label="Symmetry system">
              {(
                [
                  ["none", "None"],
                  ["mirror-grid", "Mirror Grid"],
                  ["triangle-kaleidoscope", "Triangle Kaleidoscope"],
                  ["radial-kaleidoscope", "Radial Kaleidoscope"],
                ] as const
              ).map(([id, name]) => (
                <button
                  key={id}
                  aria-pressed={composition.symmetry === id}
                  className={composition.symmetry === id ? "on" : ""}
                  onClick={() => setComposition("symmetry", id)}
                >
                  {name}
                </button>
              ))}
            </div>
            {(composition.symmetry === "radial-kaleidoscope" ||
              composition.symmetry === "triangle-kaleidoscope") && (
              <div className="segments" role="group" aria-label="Segments">
                {[3, 4, 6, 8, 12].map((n) => (
                  <button
                    key={n}
                    className={composition.segments === n ? "on" : ""}
                    onClick={() => setComposition("segments", n as 3)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
          </details>
          <section>
            <h3>Canvas</h3>
            <label className="color">
              Background{" "}
              <input
                aria-label="Background"
                type="color"
                value={composition.background}
                onChange={(e) => setComposition("background", e.target.value)}
              />
              <code>{composition.background}</code>
            </label>
          </section>
          <div className="inspector-actions">
            <button onClick={() => dispatch({ type: "reset-field-comp" })}>
              Reset pattern
            </button>
            <button
              className="primary"
              onClick={() => dispatch({ type: "set-stage", stage: "preview" })}
            >
              Preview
            </button>
          </div>
        </aside>
      </main>
    </>
  );
}

/** Render the finished field into an offscreen canvas both scene and export share. */
function renderPatternCanvas(
  img: HTMLImageElement,
  project: FieldTileProject,
  size: number,
) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  renderFieldComposition(
    canvas.getContext("2d")!,
    img,
    size,
    size,
    project.crop,
    { ...project.composition, showGuides: false },
  );
  return canvas;
}

function PosterScene({
  img,
  project,
  frame,
}: {
  img: HTMLImageElement | null;
  project: FieldTileProject;
  frame: PosterAspect;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !img) return;
    const paint = () => {
      const r = c.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const d = Math.min(devicePixelRatio || 1, 2);
      c.width = Math.max(1, Math.round(r.width * d));
      c.height = Math.max(1, Math.round(r.height * d));
      const x = c.getContext("2d")!;
      x.setTransform(d, 0, 0, d, 0, 0);
      const { posterZoom, posterOffsetX, posterOffsetY, frameColor, matColor } =
        project.scene;
      renderPosterScene(x, renderPatternCanvas(img, project, 1200), r.width, r.height, frame, {
        zoom: posterZoom,
        offsetX: posterOffsetX,
        offsetY: posterOffsetY,
        frameColor,
        matColor,
      });
    };
    paint();
    const ro = new ResizeObserver(paint);
    ro.observe(c);
    return () => ro.disconnect();
  }, [img, project, frame]);
  return <canvas ref={ref} className="preview-scene" data-testid="poster-scene" />;
}

function PreviewStage({
  img,
  project,
  dispatch,
  download,
}: {
  img: HTMLImageElement | null;
  project: FieldTileProject;
  dispatch: (action: Action) => void;
  download: (width: number, height: number) => void;
}) {
  const [dims, setDims] = useState({ width: 1080, height: 1080 });
  const [frame, setFrame] = useState<PosterAspect>("square");
  const scene = project.scene;
  const setScene = <K extends keyof PreviewSceneState>(
    key: K,
    value: PreviewSceneState[K],
  ) => dispatch({ type: "field-scene", key, value });

  const downloadScene = (width: number, height: number) => {
    if (!img) return;
    const dimsValid = validateExport(width, height);
    const canvas = document.createElement("canvas");
    canvas.width = dimsValid.width;
    canvas.height = dimsValid.height;
    renderPosterScene(
      canvas.getContext("2d")!,
      renderPatternCanvas(img, project, 1600),
      dimsValid.width,
      dimsValid.height,
      frame,
      {
        zoom: scene.posterZoom,
        offsetX: scene.posterOffsetX,
        offsetY: scene.posterOffsetY,
        frameColor: scene.frameColor,
        matColor: scene.matColor,
      },
    );
    downloadCanvas(
      canvas,
      exportFilename("field-tile-poster", dimsValid.width, dimsValid.height),
    );
  };

  return (
    <main className={`preview preview-${frame}`}>
      {scene.mode === "poster" ? (
        <PosterScene img={img} project={project} frame={frame} />
      ) : (
        <FieldCanvas
          img={img}
          project={project}
          className="preview-canvas"
          overrides={{ showGuides: false }}
        />
      )}
      <h1 className="sr-only">Preview field</h1>
      <div className="preview-toolbar">
        <button className="preview-back" onClick={() => dispatch({ type: "set-stage", stage: "repeat" })}>
          Back
        </button>
        <div className="frame-select" aria-label="Preview mode">
          {(["clean", "poster"] as const).map((mode) => (
            <button
              key={mode}
              className={scene.mode === mode ? "on" : ""}
              aria-pressed={scene.mode === mode}
              onClick={() => setScene("mode", mode)}
            >
              {mode}
            </button>
          ))}
        </div>
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
        <label>
          W{" "}
          <input
            aria-label="Export width"
            type="number"
            min="64"
            max="6000"
            value={dims.width}
            onChange={(e) => setDims({ ...dims, width: Number(e.target.value) })}
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
        {scene.mode === "poster" ? (
          <button
            className="primary"
            onClick={() => downloadScene(dims.width, dims.height)}
          >
            Save Scene ↓
          </button>
        ) : (
          <button
            className="primary"
            onClick={() => download(dims.width, dims.height)}
          >
            Save Field ↓
          </button>
        )}
      </div>
      {scene.mode === "poster" && (
        <div className="scene-toolbar" aria-label="Poster scene adjustments">
          <label>
            Density{" "}
            <input
              aria-label="Poster density"
              type="range"
              min="0.6"
              max="2.2"
              step="0.01"
              value={scene.posterZoom}
              onChange={(e) => setScene("posterZoom", Number(e.target.value))}
            />
          </label>
          <label>
            Pan X{" "}
            <input
              aria-label="Poster pan X"
              type="range"
              min="-0.6"
              max="0.6"
              step="0.01"
              value={scene.posterOffsetX}
              onChange={(e) => setScene("posterOffsetX", Number(e.target.value))}
            />
          </label>
          <label>
            Pan Y{" "}
            <input
              aria-label="Poster pan Y"
              type="range"
              min="-0.6"
              max="0.6"
              step="0.01"
              value={scene.posterOffsetY}
              onChange={(e) => setScene("posterOffsetY", Number(e.target.value))}
            />
          </label>
          <label>
            Frame{" "}
            <input
              aria-label="Frame color"
              type="color"
              value={scene.frameColor}
              onChange={(e) => setScene("frameColor", e.target.value)}
            />
          </label>
          <label>
            Mat{" "}
            <input
              aria-label="Mat color"
              type="color"
              value={scene.matColor}
              onChange={(e) => setScene("matColor", e.target.value)}
            />
          </label>
        </div>
      )}
    </main>
  );
}
