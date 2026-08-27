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
  return repeatfieldAssetUrl(base, "source-tile.jpg");
}

const DEMO = demoImageUrl(import.meta.env.BASE_URL);
const LOGO = repeatfieldAssetUrl(import.meta.env.BASE_URL, "repeatfield-tile-logo.svg");

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
  return (["primary", "infill"] as const).flatMap((shape) =>
    project.shapes[shape].asset ? [[shape, project.shapes[shape].asset] as [string, BrowserAssetRef]] : [],
  );
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
        if (ref.kind === "demo") next[slot] = DEMO;
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
    <svg data-testid="workflow-diagram-tessellate" viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
      <path
        d="M8 25 C8 13 18 7 29 15 C40 7 54 13 54 26 C54 36 46 42 38 41 L32 56 L26 41 C16 44 8 36 8 25 Z"
        fill="#FF8C17"
      />
    </svg>
  );
}

function EntryScreen({
  onChoose,
}: {
  onChoose: (workflow: WorkflowKind) => void;
}) {
  return (
    <main className="entry-screen">
      <div className="brand entry-brand">
        <img className="brand-mark" src={LOGO} alt="Repeatfield" />
        <span>
          <b>Repeatfield</b>
          <small>Patterns from your own tiles.</small>
        </span>
      </div>
      <HeroTiles />
      <h1>What are you making?</h1>
      <div className="workflow-choices">
        <button
          className="workflow-card"
          onClick={() => onChoose("field-tile")}
        >
          <WorkflowDiagram kind="field-tile" />
          <b>Field Tile</b>
          <span>One square tile repeated across a surface.</span>
        </button>
        <button className="workflow-card" onClick={() => onChoose("tile-set")}>
          <WorkflowDiagram kind="tile-set" />
          <b>Tile Set</b>
          <span>A coordinated Field, Edge, and Corner set.</span>
        </button>
        <button
          className="workflow-card"
          onClick={() => onChoose("tessellate")}
        >
          <WorkflowDiagram kind="tessellate" />
          <b>Tessellate</b>
          <span>Irregular transparent shapes fitted together.</span>
        </button>
      </div>
      <p className="entry-note">
        ● Browser local — your images never leave this browser.
      </p>
    </main>
  );
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
  ],
  tessellate: [
    ["shapes", "Shapes"],
    ["assemble", "Assemble"],
    ["verify", "Verify"],
  ],
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
        sources={{ primary: assetUrls.primary, infill: assetUrls.infill }}
        onUpload={async (shape, file) => {
          const asset = await replaceAsset(project.shapes[shape].asset, file);
          dispatch({ type: "set-shape-asset", shape, asset });
        }}
      />
    </div>
  );
}
