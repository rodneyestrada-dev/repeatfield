import { useEffect, useMemo, useRef, useState } from "react";
import type { Action, ShapeRole, TessellateProject } from "./state";
import {
  drawRepeatCellBoundary,
  renderCoverageHeatmap,
  renderTessellation,
  tessellationCoverage,
} from "../engine/renderer";
import { extractContours } from "../engine/contours";
import { coverageStatus } from "../engine/coverage";
import { applyAlphaMask, hexToRgb, rgbToHex } from "../engine/background";
import { Range, downloadCanvas, useImage } from "./common";
import { exportFilename, validateExport } from "../engine/export";

const SHAPE_LABELS: Record<ShapeRole, string> = {
  primary: "Primary",
  infill: "Infill",
};

/** Background-removed shape canvas for one slot. */
function useShapeCanvas(
  img: HTMLImageElement | null,
  slot: TessellateProject["shapes"][ShapeRole],
) {
  return useMemo(() => {
    if (!img) return null;
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0);
    if (slot.backgroundRemoval.enabled) {
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      image.data.set(
        applyAlphaMask(
          image.data,
          hexToRgb(slot.backgroundRemoval.color),
          slot.backgroundRemoval.tolerance,
          slot.backgroundRemoval.feather,
        ),
      );
      ctx.putImageData(image, 0, 0);
    }
    return canvas;
  }, [img, slot]);
}

let instanceCounter = 0;
const nextId = () => `shape-${++instanceCounter}`;

export function TessellateEditor({
  project,
  dispatch,
  sources,
  onUpload,
}: {
  project: TessellateProject;
  dispatch: (action: Action) => void;
  sources: Record<ShapeRole, string | null | undefined>;
  onUpload: (shape: ShapeRole, file: File) => Promise<void>;
}) {
  const primaryImg = useImage(sources.primary ?? null);
  const infillImg = useImage(sources.infill ?? null);
  const primaryCanvas = useShapeCanvas(primaryImg, project.shapes.primary);
  const infillCanvas = useShapeCanvas(infillImg, project.shapes.infill);
  const shapeSources = { primary: primaryCanvas, infill: infillCanvas };
  const activeShape = project.activeShape;

  const upload = (shape: ShapeRole) => async (file?: File) => {
    if (!file || !["image/png", "image/jpeg", "image/webp"].includes(file.type) || !file.size) return;
    await onUpload(shape, file);
  };

  if (project.stage === "shapes")
    return (
      <ShapesStage
        project={project}
        dispatch={dispatch}
        upload={upload}
        images={{ primary: primaryImg, infill: infillImg }}
        sources={sources}
        canvases={shapeSources}
        activeShape={activeShape}
      />
    );

  return (
    <AssembleStage
      project={project}
      dispatch={dispatch}
      shapes={shapeSources}
    />
  );
}

function ShapesStage({
  project,
  dispatch,
  upload,
  images,
  sources,
  canvases,
  activeShape,
}: {
  project: TessellateProject;
  dispatch: (action: Action) => void;
  upload: (shape: ShapeRole) => (file?: File) => void;
  images: Record<ShapeRole, HTMLImageElement | null>;
  sources: Record<ShapeRole, string | null | undefined>;
  canvases: Record<ShapeRole, HTMLCanvasElement | null>;
  activeShape: ShapeRole;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const slot = project.shapes[activeShape];
  const canvas = canvases[activeShape];
  useEffect(() => {
    const c = ref.current;
    if (!c || !canvas) return;
    const paint = () => {
      const r = c.getBoundingClientRect();
      const d = Math.min(devicePixelRatio || 1, 2);
      c.width = Math.max(1, Math.round(r.width * d));
      c.height = Math.max(1, Math.round(r.height * d));
      const x = c.getContext("2d");
      if (!x) return;
      x.setTransform(d, 0, 0, d, 0, 0);
      // checkerboard shows real transparency
      const checker = 16;
      for (let y = 0; y < r.height; y += checker)
        for (let xx = 0; xx < r.width; xx += checker) {
          x.fillStyle =
            (xx / checker + y / checker) % 2 ? "#ece2d6" : "#faf5ee";
          x.fillRect(xx, y, checker, checker);
        }
      const fit =
        Math.min(r.width / canvas.width, r.height / canvas.height) * 0.85;
      const w = canvas.width * fit;
      const h = canvas.height * fit;
      const ox = (r.width - w) / 2;
      const oy = (r.height - h) / 2;
      x.drawImage(canvas, ox, oy, w, h);
      // extracted contour overlay: outer boundary + holes, downsampled mask
      try {
        const scale = Math.min(1, 160 / Math.max(canvas.width, canvas.height));
        const mw = Math.max(2, Math.round(canvas.width * scale));
        const mh = Math.max(2, Math.round(canvas.height * scale));
        const probe = document.createElement("canvas");
        probe.width = mw;
        probe.height = mh;
        const pctx = probe.getContext("2d", { willReadFrequently: true });
        if (pctx) {
          pctx.drawImage(canvas, 0, 0, mw, mh);
          const pixels = pctx.getImageData(0, 0, mw, mh).data;
          const mask = new Uint8Array(mw * mh);
          const threshold = slot.alphaThreshold;
          for (let index = 0; index < mask.length; index++)
            mask[index] = pixels[index * 4 + 3] >= threshold ? 1 : 0;
          const { outer, holes } = extractContours(mask, mw, mh, {
            minArea: 4,
          });
          const drawContour = (
            contour: { x: number; y: number }[],
            color: string,
          ) => {
            x.save();
            x.strokeStyle = color;
            x.lineWidth = 1.6;
            x.beginPath();
            contour.forEach((point, index) => {
              const sx = ox + (point.x / mw) * w;
              const sy = oy + (point.y / mh) * h;
              if (index === 0) x.moveTo(sx, sy);
              else x.lineTo(sx, sy);
            });
            x.closePath();
            x.stroke();
            x.restore();
          };
          if (outer) drawContour(outer, "rgba(0, 176, 200, 0.95)");
          for (const hole of holes)
            drawContour(hole, "rgba(200, 100, 0, 0.85)");
        }
      } catch {
        // contour overlay is best-effort; the shape itself is still shown
      }
    };
    paint();
    const ro = new ResizeObserver(paint);
    ro.observe(c);
    return () => ro.disconnect();
  }, [canvas]);
  return (
    <>
      <div className="filebar">
        <div className="role-switcher" role="group" aria-label="Shapes">
          {(["primary", "infill"] as const).map((shape) => (
            <button
              key={shape}
              className={`role-button ${activeShape === shape ? "on" : ""}`}
              aria-pressed={activeShape === shape}
              onClick={() => dispatch({ type: "set-active-shape", shape })}
            >
              <b>{SHAPE_LABELS[shape]}</b>
              <small>
                {sources[shape] ? "Ready" : project.shapes[shape].asset ?
                  (sources[shape] === undefined ? "Loading…" : "Asset unavailable") : shape === "infill" ? "Optional" : "No image yet"}
              </small>
            </button>
          ))}
        </div>
        <label className="button">
          {project.shapes[activeShape].hasImage
            ? `Replace ${SHAPE_LABELS[activeShape]} image`
            : `Upload ${SHAPE_LABELS[activeShape]} image`}
          <input
            key={activeShape}
            aria-label={`Upload ${SHAPE_LABELS[activeShape]} image`}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => upload(activeShape)(e.target.files?.[0])}
          />
        </label>
        <span>Your images never leave this browser.</span>
      </div>
      <main className="workspace">
        {images[activeShape] ? (
          <div className="crop-shell">
            <div className="crop-body tessellate-shape-body">
              <section className="crop-stage">
                <div className="crop-canvas-wrap">
                  <canvas
                    ref={ref}
                    className="crop-canvas"
                    data-testid="pattern-canvas"
                    onClick={(e) => {
                      const img = images[activeShape];
                      if (!img) return;
                      const bounds = e.currentTarget.getBoundingClientRect();
                      const fit =
                        Math.min(
                          bounds.width / img.naturalWidth,
                          bounds.height / img.naturalHeight,
                        ) * 0.85;
                      const w = img.naturalWidth * fit;
                      const h = img.naturalHeight * fit;
                      const px = Math.floor(
                        ((e.clientX - bounds.left - (bounds.width - w) / 2) / w) *
                          img.naturalWidth,
                      );
                      const py = Math.floor(
                        ((e.clientY - bounds.top - (bounds.height - h) / 2) / h) *
                          img.naturalHeight,
                      );
                      if (
                        px < 0 ||
                        py < 0 ||
                        px >= img.naturalWidth ||
                        py >= img.naturalHeight
                      )
                        return;
                      const probe = document.createElement("canvas");
                      probe.width = img.naturalWidth;
                      probe.height = img.naturalHeight;
                      const ctx = probe.getContext("2d", {
                        willReadFrequently: true,
                      })!;
                      ctx.drawImage(img, 0, 0);
                      const pixel = ctx.getImageData(px, py, 1, 1).data;
                      dispatch({
                        type: "shape-background",
                        shape: activeShape,
                        key: "color",
                        value: rgbToHex({
                          r: pixel[0],
                          g: pixel[1],
                          b: pixel[2],
                        }),
                      });
                      dispatch({
                        type: "shape-background",
                        shape: activeShape,
                        key: "enabled",
                        value: true,
                      });
                    }}
                  />
                </div>
              </section>
              <aside className="crop-side">
                <div className="crop-guide">
                  <span className="eyebrow">REMOVE BACKGROUND</span>
                  <h2>Click the background color to make it transparent.</h2>
                </div>
                <label className="color">
                  Sampled color{" "}
                  <input
                    aria-label="Background color"
                    type="color"
                    value={slot.backgroundRemoval.color}
                    onChange={(e) => {
                      dispatch({
                        type: "shape-background",
                        shape: activeShape,
                        key: "color",
                        value: e.target.value,
                      });
                      dispatch({
                        type: "shape-background",
                        shape: activeShape,
                        key: "enabled",
                        value: true,
                      });
                    }}
                  />
                  <code>{slot.backgroundRemoval.color}</code>
                </label>
                <Range
                  label="Removal tolerance"
                  value={slot.backgroundRemoval.tolerance}
                  min={0}
                  max={100}
                  onChange={(value) =>
                    dispatch({
                      type: "shape-background",
                      shape: activeShape,
                      key: "tolerance",
                      value,
                    })
                  }
                />
                <Range
                  label="Edge feather"
                  value={slot.backgroundRemoval.feather}
                  min={0}
                  max={50}
                  onChange={(value) =>
                    dispatch({
                      type: "shape-background",
                      shape: activeShape,
                      key: "feather",
                      value,
                    })
                  }
                />
                <button
                  disabled={!slot.backgroundRemoval.enabled}
                  onClick={() =>
                    dispatch({
                      type: "shape-background",
                      shape: activeShape,
                      key: "enabled",
                      value: false,
                    })
                  }
                >
                  Reset background removal
                </button>
                <div className="contour-tools">
                  <span className="eyebrow">CONTOUR</span>
                  <Range
                    label="Alpha threshold"
                    value={slot.alphaThreshold}
                    min={1}
                    max={254}
                    onChange={(value) =>
                      dispatch({
                        type: "shape-setting",
                        shape: activeShape,
                        key: "alphaThreshold",
                        value,
                      })
                    }
                  />
                  <p className="tool-note">
                    The cyan outline is the extracted outer contour; orange
                    outlines are interior holes. Holes are kept — they may be
                    intentional artwork.
                  </p>
                </div>
              </aside>
            </div>
            <div className="crop-action-bar">
              <button
                className="primary continue"
                onClick={() => dispatch({ type: "set-stage", stage: "assemble" })}
              >
                Repeat
              </button>
            </div>
          </div>
        ) : (
          <div className="empty-state" data-testid="shape-empty-state">
            <h2>Upload a {SHAPE_LABELS[activeShape]} shape to begin</h2>
            <p>
              Tessellate fits transparent tile shapes together without gaps or
              overlaps. Upload a transparent PNG, or any image — you can
              remove its background here.
            </p>
            {project.shapes.primary.hasImage && (
              <div className="crop-action-bar">
                <button
                  className="primary continue"
                  onClick={() =>
                    dispatch({ type: "set-stage", stage: "assemble" })
                  }
                >
                  Repeat
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}

function AssembleStage({
  project,
  dispatch,
  shapes,
}: {
  project: TessellateProject;
  dispatch: (action: Action) => void;
  shapes: { primary: HTMLCanvasElement | null; infill: HTMLCanvasElement | null };
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [dims, setDims] = useState({ width: 1080, height: 1080 });
  const composition = project.composition;
  const drag = useRef<{ id: string; lastX: number; lastY: number } | null>(
    null,
  );

  const coverage = useMemo(() => {
    if (
      project.stage !== "verify" &&
      !composition.showDiagnostics
    )
      return null;
    try {
      return tessellationCoverage(shapes, composition);
    } catch {
      return null;
    }
  }, [project.stage, composition, shapes]);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const paint = () => {
      const r = c.getBoundingClientRect();
      const d = Math.min(devicePixelRatio || 1, 2);
      c.width = Math.max(1, Math.round(r.width * d));
      c.height = Math.max(1, Math.round(r.height * d));
      const x = c.getContext("2d");
      if (!x) return;
      x.setTransform(d, 0, 0, d, 0, 0);
      // checkerboard: coverage gaps stay honestly visible
      const checker = 16;
      for (let y = 0; y < r.height; y += checker)
        for (let xx = 0; xx < r.width; xx += checker) {
          x.fillStyle =
            (xx / checker + y / checker) % 2 ? "#ece2d6" : "#faf5ee";
          x.fillRect(xx, y, checker, checker);
        }
      renderTessellation(x, shapes, composition, r.width, r.height, {
        ghostCells: composition.showGhostCells,
      });
      drawRepeatCellBoundary(x, composition, 0, 0);
      if (project.stage === "verify" && coverage) {
        x.save();
        x.globalAlpha = 0.75;
        renderCoverageHeatmap(
          x,
          coverage,
          composition.lattice.u,
          composition.lattice.v,
        );
        x.restore();
      }
    };
    paint();
    const ro = new ResizeObserver(paint);
    ro.observe(c);
    return () => ro.disconnect();
  }, [project, shapes, composition, coverage]);

  const selected = composition.instances.find(
    (instance) => instance.id === project.selectedInstanceId,
  );

  const addInstance = (shapeId: ShapeRole) =>
    dispatch({
      type: "add-instance",
      instance: {
        id: nextId(),
        shapeId,
        position: { x: 160, y: 160 },
        rotation: 0,
        reflected: false,
      },
    });

  const download = () => {
    const valid = validateExport(dims.width, dims.height);
    const canvas = document.createElement("canvas");
    canvas.width = valid.width;
    canvas.height = valid.height;
    // Transparent export: no background is ever painted behind gaps.
    renderTessellation(
      canvas.getContext("2d")!,
      shapes,
      composition,
      valid.width,
      valid.height,
      { export: true },
    );
    downloadCanvas(
      canvas,
      exportFilename(
        `tessellate-${composition.outputMode}`,
        valid.width,
        valid.height,
      ),
    );
  };

  const status = coverage ? coverageStatus(coverage) : null;

  return (
    <main className="repeat-workspace">
      <aside className="preset-rail">
        <span className="eyebrow">TESSELLATE</span>
        <h1>Fit shapes together.</h1>
        <section aria-label="Stages">
          <div className="segments" role="group" aria-label="Tessellate stages">
            {(
              [
                ["shapes", "Shapes"],
                ["assemble", "Repeat"],
                ["verify", "Verify"],
                ["preview", "Preview"],
              ] as const
            ).map(([id, name]) => (
              <button
                key={id}
                aria-pressed={project.stage === id}
                className={project.stage === id ? "on" : ""}
                onClick={() => dispatch({ type: "set-stage", stage: id })}
              >
                {name}
              </button>
            ))}
          </div>
        </section>
        <section aria-label="Add shapes">
          <h3>Shapes</h3>
          <button
            disabled={!shapes.primary}
            onClick={() => addInstance("primary")}
          >
            + Add Primary
          </button>
          <button
            disabled={!shapes.infill}
            onClick={() => addInstance("infill")}
          >
            + Add Infill
          </button>
          {!shapes.infill && (
            <p className="tool-note">
              No Infill shape loaded — add one in Shapes if the Primary leaves
              voids.
            </p>
          )}
        </section>
        {selected && (
          <section aria-label="Selected shape">
            <h3>Selected shape</h3>
            <div className="segments">
              <button
                aria-label="Rotate selected shape"
                onClick={() =>
                  dispatch({
                    type: "update-instance",
                    id: selected.id,
                    patch: { rotation: (selected.rotation + 90) % 360 },
                  })
                }
              >
                ⟳ 90°
              </button>
              <button
                aria-label="Reflect selected shape"
                onClick={() =>
                  dispatch({
                    type: "update-instance",
                    id: selected.id,
                    patch: { reflected: !selected.reflected },
                  })
                }
              >
                ⇋ Reflect
              </button>
              <button
                aria-label="Duplicate selected shape"
                onClick={() =>
                  dispatch({
                    type: "add-instance",
                    instance: {
                      ...selected,
                      id: nextId(),
                      position: {
                        x: selected.position.x + 40,
                        y: selected.position.y + 40,
                      },
                    },
                  })
                }
              >
                ⧉ Duplicate
              </button>
              <button
                aria-label="Remove selected shape"
                onClick={() =>
                  dispatch({ type: "remove-instance", id: selected.id })
                }
              >
                ✕ Remove
              </button>
            </div>
          </section>
        )}
      </aside>
      <section className="field-stage">
        <canvas
          ref={ref}
          data-testid="pattern-canvas"
          onPointerDown={(e) => {
            // pick the topmost instance near the pointer
            const bounds = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - bounds.left;
            const y = e.clientY - bounds.top;
            const hit = [...composition.instances].reverse().find((instance) => {
              const source =
                instance.shapeId === "infill" ? shapes.infill : shapes.primary;
              if (!source) return false;
              const radius = Math.max(source.width, source.height) / 2;
              return (
                Math.hypot(instance.position.x - x, instance.position.y - y) <=
                radius
              );
            });
            dispatch({ type: "select-instance", id: hit?.id ?? null });
            if (hit) {
              drag.current = { id: hit.id, lastX: x, lastY: y };
              e.currentTarget.setPointerCapture(e.pointerId);
            }
          }}
          onPointerMove={(e) => {
            const current = drag.current;
            if (!current) return;
            const bounds = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - bounds.left;
            const y = e.clientY - bounds.top;
            const instance = composition.instances.find(
              (candidate) => candidate.id === current.id,
            );
            if (!instance) return;
            dispatch({
              type: "update-instance",
              id: current.id,
              patch: {
                position: {
                  x: instance.position.x + x - current.lastX,
                  y: instance.position.y + y - current.lastY,
                },
              },
            });
            drag.current = { id: current.id, lastX: x, lastY: y };
          }}
          onPointerUp={() => (drag.current = null)}
        />
        <div className="field-hint">
          DASHED OUTLINE = REPEAT CELL · GHOST COPIES SHOW NEIGHBOR CELLS
        </div>
      </section>
      <aside className="inspector">
        <div className="inspector-head">
          <div>
            <h2>Repeat Cell</h2>
          </div>
          <div className="history-actions" aria-label="Tessellate history">
            <button
              aria-label="Undo Tessellate change"
              disabled={!project.history.past.length}
              onClick={() => dispatch({ type: "undo" })}
            >
              ↶
            </button>
            <button
              aria-label="Redo Tessellate change"
              disabled={!project.history.future.length}
              onClick={() => dispatch({ type: "redo" })}
            >
              ↷
            </button>
          </div>
        </div>
        <section aria-label="Repeat vectors">
          <h3>Repeat vectors</h3>
          <Range
            label="U length"
            value={Math.round(composition.lattice.u.x)}
            min={64}
            max={720}
            onChange={(v) =>
              dispatch({
                type: "set-lattice",
                lattice: {
                  u: { x: v, y: composition.lattice.u.y },
                  v: composition.lattice.v,
                },
              })
            }
          />
          <Range
            label="V length"
            value={Math.round(composition.lattice.v.y)}
            min={64}
            max={720}
            onChange={(v) =>
              dispatch({
                type: "set-lattice",
                lattice: {
                  u: composition.lattice.u,
                  v: { x: composition.lattice.v.x, y: v },
                },
              })
            }
          />
          <label className="toggle">
            Neighbor ghost cells
            <input
              type="checkbox"
              checked={composition.showGhostCells}
              onChange={(e) =>
                dispatch({
                  type: "tessellate-comp",
                  key: "showGhostCells",
                  value: e.target.checked,
                })
              }
            />
          </label>
        </section>
        <section aria-label="Coverage" data-testid="coverage-panel">
          <h3>Coverage</h3>
          {coverage && status ? (
            <div className="coverage-report" role="status">
              <b data-testid="coverage-status">{status}</b>
              <dl>
                <dt>Coverage</dt>
                <dd data-testid="coverage-valid">
                  {coverage.validPct.toFixed(1)}%
                </dd>
                <dt>Gaps</dt>
                <dd data-testid="coverage-gap">{coverage.gapPct.toFixed(1)}%</dd>
                <dt>Overlap</dt>
                <dd data-testid="coverage-overlap">
                  {coverage.overlapPct.toFixed(1)}%
                </dd>
              </dl>
            </div>
          ) : (
            <p className="tool-note" data-testid="coverage-status">
              Place at least one shape to measure coverage.
            </p>
          )}
          <button
            onClick={() => dispatch({ type: "set-stage", stage: "verify" })}
            aria-pressed={project.stage === "verify"}
          >
            Verify coverage
          </button>
        </section>
        <section aria-label="Spacing">
          <h3>Spacing</h3>
          <div className="segments" role="group" aria-label="Spacing mode">
            {(
              [
                ["touching", "Touching"],
                ["grout", "Grout"],
              ] as const
            ).map(([id, name]) => (
              <button
                key={id}
                aria-pressed={composition.groutMode === id}
                className={composition.groutMode === id ? "on" : ""}
                onClick={() =>
                  dispatch({ type: "tessellate-comp", key: "groutMode", value: id })
                }
              >
                {name}
              </button>
            ))}
          </div>
          {composition.groutMode === "grout" && (
            <Range
              label="Grout width"
              value={composition.groutWidth}
              min={0}
              max={24}
              onChange={(v) =>
                dispatch({ type: "tessellate-comp", key: "groutWidth", value: v })
              }
            />
          )}
        </section>
        <section aria-label="Output">
          <h3>Output</h3>
          <div className="segments" role="group" aria-label="Output mode">
            {(
              [
                ["field", "Field"],
                ["medallion", "Medallion"],
              ] as const
            ).map(([id, name]) => (
              <button
                key={id}
                aria-pressed={composition.outputMode === id}
                className={composition.outputMode === id ? "on" : ""}
                onClick={() =>
                  dispatch({
                    type: "tessellate-comp",
                    key: "outputMode",
                    value: id,
                  })
                }
              >
                {name}
              </button>
            ))}
          </div>
          {composition.outputMode === "medallion" && (
            <p className="tool-note">
              Medallion exports the finite cluster with a transparent
              exterior — no seamless-repeat claim.
            </p>
          )}
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
          <button
            className="primary"
            onClick={() => project.stage === "preview"
              ? download()
              : dispatch({ type: "set-stage", stage: "preview" })}
          >
            {project.stage === "preview" ? "Download transparent PNG ↗" : "Preview"}
          </button>
        </section>
        <section>
          <button
            onClick={() => dispatch({ type: "set-stage", stage: "shapes" })}
          >
            ← Back to Shapes
          </button>
        </section>
      </aside>
    </main>
  );
}
