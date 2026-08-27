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
import { loadAsset, saveAsset } from "./assetStore";
import { FieldTileEditor } from "./FieldTileEditor";
import { TileSetEditor } from "./TileSetEditor";
import { TessellateEditor } from "./TessellateEditor";

export function demoImageUrl(base: string) {
  const normalized = base.endsWith("/") ? base : `${base}/`;
  return `${normalized}source-tile.jpg`;
}

const DEMO = demoImageUrl(import.meta.env.BASE_URL);

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
      <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
        {[0, 1, 2].map((row) =>
          [0, 1, 2].map((column) => (
            <rect
              key={`${row}-${column}`}
              x={4 + column * 19}
              y={4 + row * 19}
              width="17"
              height="17"
              rx="2"
              fill="rgba(112,73,215,.28)"
              stroke="rgba(112,73,215,.7)"
            />
          )),
        )}
      </svg>
    );
  if (kind === "tile-set")
    return (
      <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
        {[0, 1, 2].map((row) =>
          [0, 1, 2].map((column) => {
            const isCorner =
              (row === 0 || row === 2) && (column === 0 || column === 2);
            const isEdge = !isCorner && (row === 0 || row === 2 || column === 0 || column === 2);
            return (
              <rect
                key={`${row}-${column}`}
                x={4 + column * 19}
                y={4 + row * 19}
                width="17"
                height="17"
                rx="2"
                fill={
                  isCorner
                    ? "rgba(64,42,120,.6)"
                    : isEdge
                      ? "rgba(112,73,215,.42)"
                      : "rgba(112,73,215,.18)"
                }
                stroke="rgba(112,73,215,.7)"
              />
            );
          }),
        )}
      </svg>
    );
  return (
    <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
      <path
        d="M12 22 Q20 6 32 16 Q44 6 52 22 Q62 32 52 42 Q44 58 32 48 Q20 58 12 42 Q2 32 12 22 Z"
        fill="rgba(112,73,215,.28)"
        stroke="rgba(112,73,215,.7)"
      />
      <path
        d="M26 28 L38 28 L32 40 Z"
        fill="rgba(64,42,120,.55)"
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
        <span className="brand-mark">◒</span>
        <span>
          <b>Repeatfield</b>
          <small>Patterns from your own tiles.</small>
        </span>
      </div>
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

  const header = (
    <header className="topbar" role="banner">
      <div className="brand">
        <span className="brand-mark">◒</span>
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
            else dispatch({ type: "close-project" });
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
        <p>Your edits are saved locally, but leaving closes this working project.</p>
        <div className="dialog-actions">
          <button onClick={() => setExitPrompt(false)}>Keep editing</button>
          <button className="primary" onClick={() => {
            setExitPrompt(false);
            dispatch({ type: "close-project" });
          }}>Leave project</button>
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
            {img ? `${img.naturalWidth} × ${img.naturalHeight}` : "Loading…"}
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
              const asset = await saveAsset(project.id, file);
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
            const asset = await saveAsset(project.id, file);
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
          const asset = await saveAsset(project.id, file);
          dispatch({ type: "set-shape-asset", shape, asset });
        }}
      />
    </div>
  );
}
