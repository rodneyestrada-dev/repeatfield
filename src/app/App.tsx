import { useEffect, useReducer, useState } from "react";
import {
  appReducer,
  deserializeProject,
  serializeProject,
  INITIAL_STATE,
  STORAGE_KEY,
  WORKFLOW_NAMES,
  type WorkflowKind,
} from "./state";
import { useImage, acceptUpload } from "./common";
import { FieldTileEditor } from "./FieldTileEditor";
import { TileSetEditor } from "./TileSetEditor";
import { TessellateEditor } from "./TessellateEditor";

export function demoImageUrl(base: string) {
  const normalized = base.endsWith("/") ? base : `${base}/`;
  return `${normalized}source-tile.jpg`;
}

const DEMO = demoImageUrl(import.meta.env.BASE_URL);

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
  const [src, setSrc] = useState<string | null>(DEMO);
  const [fileName, setFileName] = useState("Demo tile");
  const img = useImage(project?.workflow === "field-tile" ? src : null);

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
            dispatch({ type: "close-project" });
          }}
        >
          ← Workflows
        </button>
        <div className="local">● Browser local</div>
      </div>
    </header>
  );

  if (project.workflow === "field-tile") {
    const filebar = (
      <div className="filebar">
        <div>
          <span
            className="file-thumb"
            style={{ backgroundImage: src ? `url(${src})` : undefined }}
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
            onChange={(e) =>
              acceptUpload(e.target.files?.[0], setSrc, setFileName)
            }
          />
        </label>
        <span>Your image never leaves this browser.</span>
      </div>
    );
    return (
      <div className="app-shell">
        {header}
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
        <TileSetEditor project={project} dispatch={dispatch} />
      </div>
    );

  return (
    <div className="app-shell">
      {header}
      <TessellateEditor project={project} dispatch={dispatch} />
    </div>
  );
}
