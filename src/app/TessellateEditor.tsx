import { useEffect, useRef, useState } from "react";
import type { Action, TessellateFamily, TessellateProject } from "./state";
import { CropWorkspace } from "./CropWorkspace";
import { Range, downloadCanvas, useImage } from "./common";
import { exportFilename, validateExport } from "../engine/export";
import { rectifiedTile } from "../engine/renderer";
import { renderTessellateFamily } from "../engine/tessellatePatterns";

const FAMILIES: { id: TessellateFamily; label: string; note: string }[] = [
  { id: "penrose-inspired", label: "Penrose-inspired", note: "Angular, non-periodic-looking field." },
  { id: "kaleidoscope", label: "Kaleidoscope", note: "Mirrored radial wedges." },
  { id: "tetra", label: "Tetra", note: "Alternating triangular facets." },
  { id: "triangles", label: "Triangles", note: "A simple triangle grid." },
  { id: "prism", label: "Prism", note: "Layered crystalline facets." },
];

function FamilyCanvas({ source, family, project }: { source: HTMLCanvasElement; family: TessellateFamily; project: TessellateProject }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (canvas && context) renderTessellateFamily(context, source, family, project.controls, canvas.width, canvas.height);
  }, [source, family, project.controls]);
  return <canvas ref={ref} width="180" height="110" aria-hidden="true" />;
}

export function TessellateEditor({ project, dispatch, source, onUpload }: {
  project: TessellateProject;
  dispatch: (action: Action) => void;
  source: string | null | undefined;
  onUpload: (file: File) => Promise<void>;
}) {
  const image = useImage(source ?? null);
  const tile = image ? rectifiedTile(image, project.crop, 256) : null;
  const upload = async (file?: File) => {
    if (!file || !["image/png", "image/jpeg", "image/webp"].includes(file.type) || !file.size) return;
    await onUpload(file);
  };

  if (project.stage === "crop") return <>
    <div className="filebar">
      <label className="button">{project.sourceAsset?.kind === "demo" ? "Upload image" : "Replace image"}
        <input aria-label="Upload Tessellate image" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void upload(event.target.files?.[0])} />
      </label>
      <span>Your image never leaves this browser.</span>
    </div>
    <main className="workspace">
      {project.migrationNotice && <p className="warning" role="status">This older Tessellate project needs a new square crop before it can make pattern output.</p>}
      {image ? <CropWorkspace img={image} crop={project.crop} dispatch={dispatch} selectionMode="square" allowBackground={false} showSeam={false} continueLabel="Choose pattern output" onContinue={() => dispatch({ type: "set-stage", stage: "pattern" })} aside={<div className="crop-guide"><span className="eyebrow">SQUARE CROP</span><h2>Crop what you want to repeat.</h2><p>Everything inside becomes pattern material — including texture, shadows, and background.</p></div>} /> : <div className="empty-state"><h2>Upload an image to begin</h2><p>Crop what you want to repeat. Everything inside becomes pattern material — nothing is removed.</p><p>{FAMILIES.map((item) => <span key={item.id}>{item.label} </span>)}</p></div>}
    </main>
  </>;

  if (!tile) return <main className="empty-state"><h2>Your source is unavailable</h2><button onClick={() => dispatch({ type: "set-stage", stage: "crop" })}>Return to Square Crop</button></main>;
  return <PatternStage project={project} dispatch={dispatch} source={tile} />;
}

function PatternStage({ project, dispatch, source }: { project: TessellateProject; dispatch: (action: Action) => void; source: HTMLCanvasElement }) {
  const preview = useRef<HTMLCanvasElement>(null);
  const [dims, setDims] = useState({ width: 1080, height: 1080 });
  const family = project.family ?? "triangles";
  useEffect(() => {
    const canvas = preview.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const paint = () => {
      const bounds = canvas.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(bounds.width * dpr));
      canvas.height = Math.max(1, Math.round(bounds.height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderTessellateFamily(context, source, family, project.controls, bounds.width, bounds.height);
    };
    paint();
    const observer = new ResizeObserver(paint); observer.observe(canvas);
    return () => observer.disconnect();
  }, [source, family, project.controls]);
  const exportPattern = () => {
    const valid = validateExport(dims.width, dims.height);
    const canvas = document.createElement("canvas"); canvas.width = valid.width; canvas.height = valid.height;
    renderTessellateFamily(canvas.getContext("2d")!, source, family, project.controls, valid.width, valid.height);
    downloadCanvas(canvas, exportFilename(`tessellate-${family}`, valid.width, valid.height));
  };
  return <main className="repeat-workspace tessellate-pattern-workspace">
    <aside className="preset-rail"><span className="eyebrow">TESSELLATE</span><h1>Pattern output</h1><p>Choose a generated field, then tune only what you can see.</p><button onClick={() => dispatch({ type: "set-stage", stage: "crop" })}>← Square Crop</button></aside>
    <section className="field-stage"><canvas ref={preview} data-testid="pattern-canvas" /><div className="field-hint">{FAMILIES.find((item) => item.id === family)?.label}</div></section>
    <aside className="inspector"><section aria-label="Pattern families"><h2>Choose an output</h2><div className="tessellate-family-picker">{FAMILIES.map((item) => <button key={item.id} className={family === item.id ? "on" : ""} aria-pressed={family === item.id} onClick={() => dispatch({ type: "set-tessellate-family", family: item.id })}><FamilyCanvas source={source} family={item.id} project={project} /><b>{item.label}</b><small>{item.note}</small></button>)}</div></section>
      <section aria-label="Pattern controls"><h3>Pattern controls</h3><Range label="Scale" value={project.controls.scale} min={40} max={300} onChange={(value) => dispatch({ type: "tessellate-control", key: "scale", value })} /><Range label="Rotation" value={project.controls.rotation} min={0} max={360} onChange={(value) => dispatch({ type: "tessellate-control", key: "rotation", value })} /><Range label="Density" value={project.controls.density} min={2} max={10} onChange={(value) => dispatch({ type: "tessellate-control", key: "density", value })} />{family === "kaleidoscope" && <Range label="Segments" value={project.controls.segments} min={3} max={16} onChange={(value) => dispatch({ type: "tessellate-control", key: "segments", value })} />}<label className="toggle">Mirror<input type="checkbox" checked={project.controls.mirror} onChange={(event) => dispatch({ type: "tessellate-control", key: "mirror", value: event.target.checked })} /></label></section>
      <section aria-label="Export"><h3>Export</h3><label>W <input aria-label="Export width" type="number" min="64" max="6000" value={dims.width} onChange={(event) => setDims({ ...dims, width: Number(event.target.value) })} /></label><label>H <input aria-label="Export height" type="number" min="64" max="6000" value={dims.height} onChange={(event) => setDims({ ...dims, height: Number(event.target.value) })} /></label><button className="primary" onClick={exportPattern}>Export PNG</button></section>
    </aside>
  </main>;
}
