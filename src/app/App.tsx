import { useEffect, useReducer, useState } from "react";
import {
  appReducer,
  deserializeProject,
  serializeProject,
  INITIAL_STATE,
  STORAGE_KEY,
  WORKFLOW_NAMES,
  isProjectDirty,
  type BrowserAssetRef,
  type PatternProject,
  type WorkflowKind,
} from "./state";
import { useImage } from "./common";
import { deleteAsset, deleteProjectAssets, loadAsset, saveAsset } from "./assetStore";
import { FieldTileEditor } from "./FieldTileEditor";
import { TileSetEditor } from "./TileSetEditor";
import { TessellateEditor } from "./TessellateEditor";

export function repeatfieldAssetUrl(base: string, filename: string) {
  const normalized = base.endsWith("/") ? base : `${base}/`;
  return `${normalized}${filename}`;
}

export function demoImageUrl(base: string) {
  return repeatfieldAssetUrl(base, "demo-tile-field.png");
}

const DEMO_FILES: Record<string, string> = {
  "bundled-demo": "demo-tile-field.png",
  "bundled-demo-field": "demo-tile-field.png",
  "bundled-demo-edge": "demo-tile-edge.png",
  "bundled-demo-corner": "demo-tile-corner.png",
  "bundled-demo-petal": "demo-shape-petal.png",
};

/** Resolve a bundled demo id to its public asset beneath any Vite base path. */
export function demoAssetUrl(base: string, assetId: string) {
  return repeatfieldAssetUrl(base, DEMO_FILES[assetId] ?? DEMO_FILES["bundled-demo"]);
}

const assetUrl = (filename: string) =>
  repeatfieldAssetUrl(import.meta.env.BASE_URL, filename);

const DEMO = demoImageUrl(import.meta.env.BASE_URL);
const DEMO_URLS: Record<string, string> = Object.fromEntries(
  Object.keys(DEMO_FILES).map((assetId) => [assetId, demoAssetUrl(import.meta.env.BASE_URL, assetId)]),
);
const LOGO = assetUrl("repeatfield-tile-logo.svg");

export function chooseHeroTurnTargets(random: () => number = Math.random): readonly number[] {
  const pair = Math.max(0, Math.min(0.999999, random())) >= 0.5;
  const selection = Math.max(0, Math.min(0.999999, random()));
  if (!pair) return [Math.floor(selection * 4)];
  return selection < 0.5 ? [0, 3] : [1, 2];
}

function HeroTiles() {
  const [turns, setTurns] = useState([0, 1, 3, 2]);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(
    () => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  );
  useEffect(() => {
    const query = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) return;
    const update = () => setReducedMotion(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (paused || reducedMotion) return;
    const timer = globalThis.setInterval(() => {
      const targets = chooseHeroTurnTargets();
      setTurns((current) => current.map((turn, index) =>
        targets.includes(index) ? (turn + 1) % 4 : turn,
      ));
    }, 3200);
    return () => globalThis.clearInterval(timer);
  }, [paused, reducedMotion]);
  const motionPaused = paused || reducedMotion;
  return (
    <div className="hero-tiles-wrap" data-paused={motionPaused}>
      <div className="hero-tiles" aria-hidden="true">
        {turns.map((turn, index) => (
          <img key={index} src={LOGO} alt="" style={{ transform: `rotate(${turn * 90}deg)` }} />
        ))}
      </div>
      <button className="hero-pause" aria-pressed={paused} onClick={() => setPaused((value) => !value)}>
        {paused ? "Play tile motion" : "Pause tile motion"}
      </button>
    </div>
  );
}

type AssetUrls = Record<string, string | null>;

function projectAssetEntries(project: PatternProject | null): [string, BrowserAssetRef][] {
  if (!project) return [];
  if (project.workflow === "field-tile")
    return project.sourceAsset ? [["field", project.sourceAsset]] : [];
  if (project.workflow === "tile-set")
    return (["field", "border", "corner"] as const).flatMap((role) =>
      project.roles[role].asset ? [[role, project.roles[role].asset] as [string, BrowserAssetRef]] : [],
    );
  return project.sourceAsset ? [["tessellate", project.sourceAsset]] : [];
}

function useProjectAssetUrls(project: PatternProject | null) {
  const [urls, setUrls] = useState<AssetUrls>({});
  const signature = JSON.stringify(projectAssetEntries(project));
  useEffect(() => {
    let active = true;
    const objectUrls: string[] = [];
    setUrls({});
    void (async () => {
      if (!project) return;
      const next: AssetUrls = {};
      for (const [slot, ref] of projectAssetEntries(project)) {
        if (ref.kind === "demo") next[slot] = DEMO_URLS[ref.id] ?? DEMO;
        else {
          const blob = await loadAsset(project.id, ref);
          if (blob) {
            const url = URL.createObjectURL(blob);
            if (!active) {
              URL.revokeObjectURL(url);
              continue;
            }
            objectUrls.push(url);
            next[slot] = url;
          } else next[slot] = null;
        }
      }
      if (active) setUrls(next);
    })();
    return () => {
      active = false;
      for (const url of objectUrls) URL.revokeObjectURL(url);
    };
  }, [project?.id, signature]);
  return urls;
}

function WorkflowDiagram({ kind }: { kind: WorkflowKind }) {
  if (kind === "field-tile")
    return (
      <svg data-testid="workflow-diagram-field-tile" viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
        {[0, 1, 2].map((row) =>
          [0, 1, 2].map((column) => (
            <rect
              key={`${row}-${column}`}
              x={4 + column * 19}
              y={4 + row * 19}
              width="17"
              height="17"
              rx="4"
              fill="#FFD4A8"
            />
          )),
        )}
      </svg>
    );
  if (kind === "tile-set")
    return (
      <svg data-testid="workflow-diagram-tile-set" viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
        {[0, 1, 2].map((row) =>
          [0, 1, 2].map((column) => {
            const index = row * 3 + column;
            const fills = [
              "#FFC7A1", "#FFC7A1", "#FF8C17",
              "#FFD4A8", "#FFD4A8", "#FFC7A1",
              "#FFD4A8", "#FFD4A8", "#FFC7A1",
            ];
            return (
              <rect
                key={`${row}-${column}`}
                x={4 + column * 19}
                y={4 + row * 19}
                width="17"
                height="17"
                rx="4"
                fill={fills[index]}
              />
            );
          }),
        )}
      </svg>
    );
  return (
    <svg
      data-testid="workflow-diagram-tessellate"
      viewBox="0 0 64 64"
      width="64"
      height="64"
      aria-label="Penrose-inspired pattern preview"
      aria-hidden="true"
    >
      {/* A recognisable kite-and-dart rosette—not an extracted object silhouette. */}
      <polygon points="32,8 39,25 32,32 25,25" fill="#FF8C17" />
      <polygon points="56,32 39,39 32,32 39,25" fill="#FFD4A8" />
      <polygon points="32,56 25,39 32,32 39,39" fill="#FF8C17" />
      <polygon points="8,32 25,25 32,32 25,39" fill="#FFC7A1" />
      <polygon points="15,15 25,25 18,32 8,32" fill="#B9A7EF" />
      <polygon points="49,15 56,32 46,32 39,25" fill="#FFC7A1" />
      <polygon points="49,49 39,39 46,32 56,32" fill="#B9A7EF" />
      <polygon points="15,49 8,32 18,32 25,39" fill="#FFD4A8" />
      <circle cx="32" cy="32" r="3" fill="#19161D" />
    </svg>
  );
}

type GalleryPattern = "aligned" | "checker" | "rowturn" | "brick" | "halfdrop" | "tileset";

function PatternSwatch({ pattern }: { pattern: GalleryPattern }) {
  const cells: { x: number; y: number; angle: number; fill?: string; stroke?: string }[] = [];
  if (pattern === "brick") {
    for (let row = 0; row < 4; row++) for (let column = -1; column < 5; column++)
      cells.push({ x: column * 50 + (row % 2 ? 25 : 0), y: row * 50, angle: 0 });
  } else if (pattern === "halfdrop") {
    for (let row = -1; row < 5; row++) for (let column = 0; column < 4; column++)
      cells.push({ x: column * 50, y: row * 50 + (column % 2 ? 25 : 0), angle: 0 });
  } else {
    for (let row = 0; row < 4; row++) for (let column = 0; column < 4; column++) {
      const edge = row === 0 || row === 3 || column === 0 || column === 3;
      const corner = (row === 0 || row === 3) && (column === 0 || column === 3);
      cells.push({
        x: column * 50, y: row * 50,
        angle: pattern === "checker" ? ((row + column) % 2 ? 90 : 0) : pattern === "rowturn" ? (row % 2 ? 90 : 0) : 0,
        fill: pattern === "tileset" ? (corner ? "#ff8c24" : edge ? "#ffc7a1" : "#fff7ee") : undefined,
        stroke: pattern === "tileset" && edge ? "#cf5e00" : undefined,
      });
    }
  }
  return <svg className="landing-swatch" viewBox="0 0 200 200" aria-hidden="true">
    <defs><clipPath id={`clip-${pattern}`}><rect width="50" height="50" /></clipPath></defs>
    {cells.map((cell, index) => <g key={index} transform={`translate(${cell.x} ${cell.y}) rotate(${cell.angle} 25 25)`}>
      <rect width="50" height="50" fill={cell.fill ?? "#fff7ee"} />
      <g clipPath={`url(#clip-${pattern})`}><circle cx="0" cy="0" r="25" fill="none" stroke={cell.stroke ?? "#ff8c24"} strokeWidth="6" /><circle cx="50" cy="50" r="25" fill="none" stroke={cell.stroke ?? "#ff8c24"} strokeWidth="6" /></g>
    </g>)}
  </svg>;
}

function LandingTileGrid() {
  return <HeroTiles />;
}

function EntryScreen({ onChoose }: { onChoose: (workflow: WorkflowKind) => void }) {
  const [dark, setDark] = useState(false);
  const workflows: { kind: WorkflowKind; number: string; title: string; copy: string }[] = [
    { kind: "field-tile", number: "01 / CROP → REPEAT → PREVIEW", title: "Field Tile", copy: "One square tile, turned and repeated across a surface. Straight, brick, or half-drop." },
    { kind: "tile-set", number: "02 / TILES → COMPOSE SET", title: "Tile Set", copy: "Field, Edge, and Corner composed as one family — edge runs, corner joins, shared set logic." },
    { kind: "tessellate", number: "03 / SQUARE CROP → PATTERN OUTPUT", title: "Tessellate", copy: "Crop a square of pattern material, then transform it into an intentional field." },
  ];
  const gallery: { pattern: GalleryPattern; title: string; type: string }[] = [
    { pattern: "aligned", title: "Aligned", type: "Field Tile" }, { pattern: "checker", title: "Checker turn", type: "Tile Turn" },
    { pattern: "rowturn", title: "Row turn", type: "Tile Turn" }, { pattern: "brick", title: "Brick", type: "Field Layout" },
    { pattern: "halfdrop", title: "Half-drop", type: "Field Layout" }, { pattern: "tileset", title: "Field · Edge · Corner", type: "Tile Set" },
  ];
  return <main className={`landing ${dark ? "landing-dark" : ""}`}>
    <div className="landing-ambient" aria-hidden="true" />
    <div className="landing-shell">
      <header className="landing-topbar">
        <a className="landing-brand" href="#top"><img src={LOGO} alt="" /><b>Repeatfield</b></a>
        <nav aria-label="Landing sections"><a href="#workflows">Workflows</a><a href="#gallery">Gallery</a><a href="#faq">FAQ</a></nav>
        <div className="landing-actions"><button className="landing-icon-button" onClick={() => setDark((value) => !value)} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} aria-pressed={dark}>{dark ? "☀" : "◐"}</button><button className="landing-primary" onClick={() => onChoose("field-tile")}>Open studio</button></div>
      </header>
      <section className="landing-hero" id="top">
        <div><span className="landing-eyebrow">Browser local · no upload</span><h1>One tile.<br />Infinite fields.</h1><p>Upload a tile, turn it, repeat it, and export the field. A studio for repetition, symmetry, and what happens at the edge — no account, no install, your images stay in your browser.</p><div className="landing-hero-actions"><button className="landing-primary" onClick={() => onChoose("field-tile")}>Start making ↘</button><a className="landing-secondary" href="#workflows">See how it works</a></div></div>
        <div className="landing-hero-visual"><LandingTileGrid /></div>
      </section>
      <section className="landing-trust" aria-label="Product benefits"><span>Browser local <b>No upload</b></span><span>No account <b>Open & make</b></span><span>PNG export <b>Custom sizes</b></span><span>50-step undo <b>Per project</b></span></section>
      <section className="landing-section" id="workflows"><div className="landing-heading"><div><span>01 / Workflows</span><h2>What are<br />you making?</h2></div><p>Every project starts with one honest question. Each workflow keeps its own mental model — square repeats, coordinated sets, or irregular shapes — and never switches silently.</p></div><div className="landing-workflows">{workflows.map((workflow) => <button key={workflow.kind} className="landing-workflow" onClick={() => onChoose(workflow.kind)}><span>{workflow.number}</span><i>↗</i><h3>{workflow.title}</h3><p>{workflow.copy}</p><div className={`landing-diagram ${workflow.kind}`}><WorkflowDiagram kind={workflow.kind} /></div></button>)}</div></section>
      <section className="landing-section landing-gallery-section" id="gallery"><div className="landing-heading"><div><span>02 / Gallery</span><h2>Same tile.<br />Six systems.</h2></div><p>Every pattern below is built from the same single tile — only orientation, layout, and role change. That is the core Repeatfield idea.</p></div><div className="landing-gallery">{gallery.map((item) => <figure key={item.pattern}><PatternSwatch pattern={item.pattern} /><figcaption><b>{item.title}</b><small>{item.type}</small></figcaption></figure>)}</div></section>
      <section className="landing-section landing-faq" id="faq"><div className="landing-heading"><div><span>03 / FAQ</span><h2>Good<br />to know.</h2></div><p>Repeatfield is scoped honestly: it works locally in your browser, keeps uploaded images on-device, and exports the field you make.</p></div><details><summary>Do my images leave my browser?</summary><p>No. Your image work stays in this browser.</p></details><details><summary>What can I export?</summary><p>Export your finished field as a PNG at your chosen dimensions.</p></details><details><summary>What are the current workflows?</summary><p>Field Tile, Tile Set, and Tessellate.</p></details></section>
      <section className="landing-cta"><h2>Ready to make your first field?</h2><p>Pick a workflow, upload a tile, and watch it repeat.</p><button className="landing-primary" onClick={() => onChoose("field-tile")}>Open the studio</button></section>
      <footer className="landing-footer"><span>Repeatfield · Patterns from your own tiles.</span><span>Browser local · no upload · no install</span></footer>
    </div>
  </main>;
}

const STAGE_LABELS: Record<WorkflowKind, [string, string][]> = {
  "field-tile": [
    ["crop", "Crop"],
    ["repeat", "Repeat"],
    ["preview", "Preview"],
  ],
  "tile-set": [
    ["tiles", "Tiles"],
    ["compose", "Compose Set"],
    ["preview", "Preview"],
  ],
  tessellate: [["crop", "Square Crop"], ["pattern", "Pattern"], ["preview", "Preview"]],
};

export function App() {
  const [state, dispatch] = useReducer(
    appReducer,
    INITIAL_STATE,
    (initial) => {
      try {
        const stored = deserializeProject(localStorage.getItem(STORAGE_KEY));
        return stored ? { project: stored } : initial;
      } catch {
        return initial;
      }
    },
  );
  const project = state.project;
  const [exitPrompt, setExitPrompt] = useState(false);
  const assetUrls = useProjectAssetUrls(project);
  const fieldSrc = project?.workflow === "field-tile" && project.sourceAsset?.kind === "demo"
    ? DEMO
    : assetUrls.field ?? null;
  const img = useImage(project?.workflow === "field-tile" ? fieldSrc : null);

  useEffect(() => {
    try {
      if (project)
        localStorage.setItem(STORAGE_KEY, serializeProject(project));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // storage unavailable: stay in-memory only
    }
  }, [project]);

  useEffect(() => {
    const shortcuts = (event: KeyboardEvent) => {
      if (!project || !(event.metaKey || event.ctrlKey)) return;
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
      dispatch({ type: redo ? "redo" : "undo" });
    };
    addEventListener("keydown", shortcuts);
    return () => removeEventListener("keydown", shortcuts);
  }, [project]);

  if (!project)
    return (
      <EntryScreen
        onChoose={(workflow) => dispatch({ type: "create-project", workflow })}
      />
    );

  const stages = STAGE_LABELS[project.workflow];

  const replaceAsset = async (previous: BrowserAssetRef | null | undefined, file: File) => {
    const asset = await saveAsset(project.id, file);
    if (previous && previous.kind === "indexeddb")
      void deleteAsset(project.id, previous).catch(() => {});
    return asset;
  };

  const closeProject = () => {
    void deleteProjectAssets(project.id).catch(() => {});
    dispatch({ type: "close-project" });
  };

  const header = (
    <header className="topbar" role="banner">
      <div className="brand">
        <img className="brand-mark" src={LOGO} alt="Repeatfield" />
        <span>
          <b>Repeatfield</b>
          <small data-testid="workflow-name">
            {WORKFLOW_NAMES[project.workflow]}
          </small>
        </span>
      </div>
      <nav role="tablist" aria-label="Stages">
        {stages.map(([stage, name]) => (
          <button
            key={stage}
            role="tab"
            aria-selected={
              project.stage === stage ||
              (stage === "assemble" && project.stage === "preview") ||
              (stage === "compose" && project.stage === "preview")
            }
            onClick={() => dispatch({ type: "set-stage", stage })}
          >
            <i />
            {name}
          </button>
        ))}
      </nav>
      <div className="header-right">
        <button
          className="back-to-workflows"
          onClick={() => {
            if (isProjectDirty(project)) setExitPrompt(true);
            else closeProject();
          }}
        >
          ← Workflows
        </button>
        <div className="local">● Browser local</div>
      </div>
    </header>
  );

  const exitDialog = exitPrompt ? (
    <div className="modal-backdrop">
      <div role="dialog" aria-modal="true" aria-labelledby="leave-project-title" className="confirm-dialog">
        <h2 id="leave-project-title">Leave this project?</h2>
        <p>
          Leaving closes this project and permanently discards its edits and
          uploaded images from this browser.
        </p>
        <div className="dialog-actions">
          <button onClick={() => setExitPrompt(false)}>Keep editing</button>
          <button className="primary" onClick={() => {
            setExitPrompt(false);
            closeProject();
          }}>Discard and leave</button>
        </div>
      </div>
    </div>
  ) : null;

  if (project.workflow === "field-tile") {
    const filebar = (
      <div className="filebar">
        <div>
          <span
            className="file-thumb"
            style={{ backgroundImage: fieldSrc ? `url(${fieldSrc})` : undefined }}
          />
          <strong>{project.sourceAsset?.name ?? "Asset unavailable"}</strong>
          <small>
            {img
              ? `${img.naturalWidth} × ${img.naturalHeight}`
              : project.sourceAsset && fieldSrc === null
                ? "Asset unavailable"
                : "Loading…"}
          </small>
        </div>
        <label className="button">
          {project.sourceAsset?.kind === "demo" ? "Upload image" : "Replace image"}
          <input
            aria-label="Upload image"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file || !["image/png", "image/jpeg", "image/webp"].includes(file.type) || !file.size) return;
              const asset = await replaceAsset(project.sourceAsset, file);
              dispatch({ type: "set-field-asset", asset });
            }}
          />
        </label>
        <span>Your image never leaves this browser.</span>
      </div>
    );
    return (
      <div className="app-shell">
        {header}
        {exitDialog}
        <FieldTileEditor
          img={img}
          project={project}
          dispatch={dispatch}
          filebar={filebar}
        />
      </div>
    );
  }

  if (project.workflow === "tile-set")
    return (
      <div className="app-shell">
        {header}
        {exitDialog}
        <TileSetEditor
          project={project}
          dispatch={dispatch}
          sources={{ field: assetUrls.field, border: assetUrls.border, corner: assetUrls.corner }}
          onUpload={async (role, file) => {
            const asset = await replaceAsset(project.roles[role].asset, file);
            dispatch({ type: "set-role-asset", role, asset });
          }}
        />
      </div>
    );

  return (
    <div className="app-shell">
      {header}
      {exitDialog}
      <TessellateEditor
        project={project}
        dispatch={dispatch}
        source={assetUrls.tessellate}
        onUpload={async (file) => {
          const asset = await replaceAsset(project.sourceAsset, file);
          dispatch({ type: "set-tessellate-asset", asset });
        }}
      />
    </div>
  );
}
