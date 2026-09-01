import { useEffect, useRef, useState } from "react";
import type { Action, TileSetProject } from "./state";
import type { TileRole, FrameCorner, TileRotation } from "../engine/frameLayout";
import { rectifiedTile, renderTileSetComposition } from "../engine/renderer";
import { Range, downloadCanvas, useImage } from "./common";
import { CropWorkspace } from "./CropWorkspace";
import { exportFilename, validateExport } from "../engine/export";

const ROLE_LABELS: Record<TileRole, string> = {
  field: "Field",
  border: "Edge",
  corner: "Corner",
};
const ROLES: TileRole[] = ["field", "border", "corner"];

function TileSetDiagnostics({ role }: { role: TileRole }) {
  if (role === "field") return <div className="crop-guide" data-testid="tile-set-diagnostics"><span className="eyebrow">FIELD SEAM CHECK</span><p>Inspect the 2 × 2 Field join.</p></div>;
  if (role === "border") return <div className="crop-guide" data-testid="tile-set-diagnostics"><span className="eyebrow">Edge Run check</span><p>Inspect the repeated Edge strip and the <span>Field–Edge join</span>.</p></div>;
  return <div className="crop-guide" data-testid="tile-set-diagnostics"><span className="eyebrow">Corner Join check</span><p>Inspect the L-shaped Edge–Corner transition.</p></div>;
}

export function TileSetEditor({
  project,
  dispatch,
  sources,
  onUpload,
}: {
  project: TileSetProject;
  dispatch: (action: Action) => void;
  sources: Record<TileRole, string | null | undefined>;
  onUpload: (role: TileRole, file: File) => Promise<void>;
}) {
  const fieldImg = useImage(sources.field ?? null);
  const borderImg = useImage(sources.border ?? null);
  const cornerImg = useImage(sources.corner ?? null);
  const images: Record<TileRole, HTMLImageElement | null> = {
    field: fieldImg,
    border: borderImg,
    corner: cornerImg,
  };
  const activeRole = project.activeRole;
  const activeImg = images[activeRole];
  const missingRoles = ROLES.filter((role) => !sources[role]);
  const missingLabel = missingRoles.map((role) => ROLE_LABELS[role]).join(", ");

  const roleTiles = () => ({
    field: fieldImg
      ? rectifiedTile(fieldImg, project.roles.field.crop, 256)
      : null,
    border: borderImg
      ? rectifiedTile(borderImg, project.roles.border.crop, 256)
      : null,
    corner: cornerImg
      ? rectifiedTile(cornerImg, project.roles.corner.crop, 256)
      : null,
  });

  const upload = (role: TileRole) => async (file?: File) => {
    if (!file || !["image/png", "image/jpeg", "image/webp"].includes(file.type) || !file.size) return;
    await onUpload(role, file);
  };

  const roleSwitcher = (
    <div className="role-switcher" role="group" aria-label="Tile Set roles">
      {ROLES.map((role) => (
        <button
          key={role}
          className={`role-button ${activeRole === role ? "on" : ""}`}
          aria-pressed={activeRole === role}
          onClick={() => dispatch({ type: "set-active-role", role })}
        >
          <b>{ROLE_LABELS[role]}</b>
          <small>
            {sources[role] ? "Ready" : project.roles[role].asset ?
              (sources[role] === undefined ? "Loading…" : "Asset unavailable") : "No image yet"}
          </small>
        </button>
      ))}
    </div>
  );

  if (project.stage === "tiles")
    return (
      <>
        <div className="filebar">
          {roleSwitcher}
          <label className="button">
            {project.roles[activeRole].hasImage
              ? `Replace ${ROLE_LABELS[activeRole]} image`
              : `Upload ${ROLE_LABELS[activeRole]} image`}
            <input
              key={activeRole}
              aria-label={`Upload ${ROLE_LABELS[activeRole]} image`}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => upload(activeRole)(e.target.files?.[0])}
            />
          </label>
          <span>Your images never leave this browser.</span>
        </div>
        <main className="workspace">
          {missingRoles.length > 0 && (
            <p className="warning" role="alert" data-testid="missing-roles">
              Add the required {missingLabel} {missingRoles.length === 1 ? "tile" : "tiles"} before Compose or Export.
            </p>
          )}
          {activeImg ? (
            <CropWorkspace
              img={activeImg}
              crop={project.roles[activeRole].crop}
              dispatch={dispatch}
              continueLabel="Compose Set"
              onContinue={() =>
                dispatch({ type: "set-stage", stage: "compose" })
              }
              aside={
                <>
                <div className="crop-guide">
                  <span className="eyebrow">
                    EDITING {ROLE_LABELS[activeRole].toUpperCase()} TILE
                  </span>
                  <h2>
                    {activeRole === "field" &&
                      "The Field tile fills the interior."}
                    {activeRole === "border" &&
                      "The Edge tile forms the perimeter run."}
                    {activeRole === "corner" &&
                      "The Corner tile turns the Edge through 90°."}
                  </h2>
                </div>
                <TileSetDiagnostics role={activeRole} />
                </>
              }
            />
          ) : (
            <div className="empty-state" data-testid="role-empty-state">
              <h2>Upload a {ROLE_LABELS[activeRole]} tile to begin</h2>
              <p>
                A Tile Set combines a Field, an Edge, and a Corner tile into
                one coordinated installation. Upload a square photo or scan
                for the {ROLE_LABELS[activeRole]} role.
              </p>
              <TileSetDiagnostics role={activeRole} />
              <div className="crop-action-bar">
                <button
                  className="primary continue"
                  disabled={missingRoles.length > 0}
                  onClick={() =>
                    dispatch({ type: "set-stage", stage: "compose" })
                  }
                >
                  Compose Set
                </button>
              </div>
            </div>
          )}
        </main>
      </>
    );

  if (project.stage === "preview")
    return (
      <TileSetPreviewStage
        project={project}
        dispatch={dispatch}
        roleTiles={roleTiles}
        missingRoles={missingRoles}
      />
    );

  return (
    <ComposeStage
      project={project}
      dispatch={dispatch}
      roleTiles={roleTiles}
      roleSwitcher={roleSwitcher}
      missingRoles={missingRoles}
    />
  );
}

function ComposeStage({
  project,
  dispatch,
  roleTiles,
  missingRoles,
}: {
  project: TileSetProject;
  dispatch: (action: Action) => void;
  roleTiles: () => {
    field: HTMLCanvasElement | null;
    border: HTMLCanvasElement | null;
    corner: HTMLCanvasElement | null;
  };
  roleSwitcher?: React.ReactNode;
  missingRoles: TileRole[];
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [dims, setDims] = useState({ width: 1080, height: 1080 });
  const composition = project.composition;
  const setComposition = (
    key: keyof TileSetProject["composition"],
    value: TileSetProject["composition"][keyof TileSetProject["composition"]],
  ) => dispatch({ type: "tile-set-comp", key, value });

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
      renderTileSetComposition(
        x,
        roleTiles(),
        composition,
        project.setLook,
        r.width,
        r.height,
      );
    };
    paint();
    const ro = new ResizeObserver(paint);
    ro.observe(c);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  return (
    <main className="repeat-workspace">
      <aside className="preset-rail">
        <span className="eyebrow">TILE SET</span>
        <h1>Field · Edge · Corner</h1>
        <p>Build one coordinated surface from interior, edge, and corner tiles.</p>
        <section aria-label="Set view">
          <h3>View</h3>
          <div className="segments" role="group" aria-label="Composition view">
            {(
              [
                ["field", "Field"],
                ["border", "Edge"],
                ["corner", "Corner"],
                ["set", "Set"],
              ] as const
            ).map(([id, name]) => (
              <button
                key={id}
                aria-pressed={composition.viewMode === id}
                className={composition.viewMode === id ? "on" : ""}
                onClick={() => setComposition("viewMode", id)}
              >
                {name}
              </button>
            ))}
          </div>
        </section>
        <section aria-label="Back to tiles">
          <button onClick={() => dispatch({ type: "set-stage", stage: "tiles" })}>
            ← Back to Tiles
          </button>
        </section>
      </aside>
      <section className="field-stage">
        <canvas ref={ref} data-testid="pattern-canvas" />
        <div className="field-hint">FULL FRAMED SET PREVIEW</div>
      </section>
      <aside className="inspector">
        {missingRoles.length > 0 && (
          <p className="warning" role="alert" data-testid="missing-roles">
            Missing required: {missingRoles.map((role) => ROLE_LABELS[role]).join(", ")}.
          </p>
        )}
        <div className="inspector-head">
          <div>
            <h2>Compose the set</h2>
          </div>
          <div className="history-actions" aria-label="Set history">
            <button
              aria-label="Undo Set change"
              disabled={!project.history.past.length}
              onClick={() => dispatch({ type: "undo" })}
            >
              ↶
            </button>
            <button
              aria-label="Redo Set change"
              disabled={!project.history.future.length}
              onClick={() => dispatch({ type: "redo" })}
            >
              ↷
            </button>
          </div>
        </div>
        <section aria-label="Frame dimensions">
          <h3>Frame</h3>
          <Range
            label="Interior columns"
            value={composition.fieldColumns}
            min={1}
            max={8}
            onChange={(v) => setComposition("fieldColumns", v)}
          />
          <Range
            label="Interior rows"
            value={composition.fieldRows}
            min={1}
            max={8}
            onChange={(v) => setComposition("fieldRows", v)}
          />
          <label className="toggle">
            Edge run
            <input
              type="checkbox"
              checked={composition.borderEnabled}
              onChange={(e) => setComposition("borderEnabled", e.target.checked)}
            />
          </label>
          <label className="toggle">
            Corners
            <input
              type="checkbox"
              checked={composition.cornerEnabled}
              onChange={(e) => setComposition("cornerEnabled", e.target.checked)}
            />
          </label>
          {composition.borderEnabled &&
            !composition.cornerEnabled && (
              <p className="warning" role="status">
                Edge run without Corner tiles: edge ends meet without a
                90° transition.
              </p>
            )}
        </section>
        <section aria-label="Tile turns">
          <h3>Tile turns</h3>
          <p className="tool-note">Apply a shared base rotation across each role in this set.</p>
          <div className="segments" role="group" aria-label="Field rotation">
            {([0, 90, 180, 270] as const).map((rotation) => (
              <button key={rotation} className={composition.fieldRotation === rotation ? "on" : ""} aria-pressed={composition.fieldRotation === rotation} onClick={() => setComposition("fieldRotation", rotation)}>{rotation}°</button>
            ))}
          </div>
        </section>
        <section aria-label="Edge Run">
          <h3>Edge Run</h3>
          <Range
            label="Phase"
            value={composition.borderPhase}
            min={0}
            max={4}
            onChange={(v) => setComposition("borderPhase", v)}
          />
          <label className="toggle">
            Alternate rotation
            <input
              type="checkbox"
              checked={composition.borderAlternate}
              onChange={(e) =>
                setComposition("borderAlternate", e.target.checked)
              }
            />
          </label>
          <label className="toggle">
            Reverse direction
            <input
              type="checkbox"
              checked={composition.borderReverse}
              onChange={(e) => setComposition("borderReverse", e.target.checked)}
            />
          </label>
        </section>
        <section aria-label="Corner Join">
          <h3>Corner Join</h3>
          <div className="segments" role="group" aria-label="Corner baseline">
            {([0, 90, 180, 270] as const).map((rotation) => (
              <button
                key={rotation}
                className={
                  composition.cornerBaseRotation === rotation ? "on" : ""
                }
                aria-pressed={composition.cornerBaseRotation === rotation}
                onClick={() => setComposition("cornerBaseRotation", rotation)}
              >
                {rotation}°
              </button>
            ))}
          </div>
          <CornerOverrides project={project} dispatch={dispatch} />
        </section>
        <section aria-label="Set Look">
          <h3>Set Look</h3>
          <Range
            label="Brightness"
            value={project.setLook.brightness}
            min={-100}
            max={100}
            onChange={(v) => dispatch({ type: "set-look", key: "brightness", value: v })}
          />
          <Range
            label="Contrast"
            value={project.setLook.contrast}
            min={-100}
            max={100}
            onChange={(v) => dispatch({ type: "set-look", key: "contrast", value: v })}
          />
          <Range
            label="Saturation"
            value={project.setLook.saturation}
            min={-100}
            max={100}
            onChange={(v) => dispatch({ type: "set-look", key: "saturation", value: v })}
          />
          <Range
            label="Warmth"
            value={project.setLook.warmth}
            min={-100}
            max={100}
            onChange={(v) => dispatch({ type: "set-look", key: "warmth", value: v })}
          />
          <button onClick={() => dispatch({ type: "reset-set-look" })}>
            Reset Set Look
          </button>
        </section>
        <section aria-label="Grout">
          <h3>Grout</h3>
          <Range
            label="Grout width"
            value={composition.groutWidth}
            min={0}
            max={16}
            onChange={(v) => setComposition("groutWidth", v)}
          />
          <label className="color">
            Grout color{" "}
            <input
              aria-label="Grout color"
              type="color"
              value={composition.groutColor}
              onChange={(e) => setComposition("groutColor", e.target.value)}
            />
          </label>
        </section>
        <section aria-label="Export">
          <h3>Export</h3>
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
            disabled={missingRoles.length > 0}
            onClick={() => dispatch({ type: "set-stage", stage: "preview" })}
          >
            Preview
          </button>
        </section>
      </aside>
    </main>
  );
}

function TileSetPreviewStage({
  project,
  dispatch,
  roleTiles,
  missingRoles,
}: {
  project: TileSetProject;
  dispatch: (action: Action) => void;
  roleTiles: () => { field: HTMLCanvasElement | null; border: HTMLCanvasElement | null; corner: HTMLCanvasElement | null };
  missingRoles: TileRole[];
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [dims, setDims] = useState({ width: 1080, height: 1080 });
  const [exportError, setExportError] = useState("");
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const paint = () => {
      const bounds = canvas.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(bounds.width * dpr));
      canvas.height = Math.max(1, Math.round(bounds.height * dpr));
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderTileSetComposition(context, roleTiles(), project.composition, project.setLook, bounds.width, bounds.height);
    };
    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [project, roleTiles]);
  const download = () => {
    const tiles = roleTiles();
    if (missingRoles.length || !tiles.field || !tiles.border || !tiles.corner) {
      setExportError("Field, Edge, and Corner assets are required before export.");
      return;
    }
    const valid = validateExport(dims.width, dims.height);
    const canvas = document.createElement("canvas");
    canvas.width = valid.width;
    canvas.height = valid.height;
    renderTileSetComposition(canvas.getContext("2d")!, tiles, project.composition, project.setLook, valid.width, valid.height);
    downloadCanvas(canvas, exportFilename("tile-set", valid.width, valid.height));
  };
  return <main className="repeat-workspace">
    <aside className="preset-rail"><span className="eyebrow">TILE SET</span><h1>Preview</h1><p>Review the complete Field · Edge · Corner set before export.</p><button onClick={() => dispatch({ type: "set-stage", stage: "compose" })}>← Back</button></aside>
    <section className="field-stage"><canvas ref={ref} data-testid="pattern-canvas" /><div className="field-hint">READY TO EXPORT</div></section>
    <aside className="inspector"><div className="inspector-head"><h2>Export set</h2></div><section aria-label="Export"><label>W <input aria-label="Export width" type="number" min="64" max="6000" value={dims.width} onChange={(e) => setDims({ ...dims, width: Number(e.target.value) })}/></label><label>H <input aria-label="Export height" type="number" min="64" max="6000" value={dims.height} onChange={(e) => setDims({ ...dims, height: Number(e.target.value) })}/></label>{exportError && <p className="warning" role="alert">{exportError}</p>}<button className="primary" disabled={missingRoles.length > 0} onClick={download}>Download PNG ↗</button></section></aside>
  </main>;
}

function CornerOverrides({
  project,
  dispatch,
}: {
  project: TileSetProject;
  dispatch: (action: Action) => void;
}) {
  const corners: FrameCorner[] = [
    "top-left",
    "top-right",
    "bottom-right",
    "bottom-left",
  ];
  return (
    <details>
      <summary>Per-corner overrides</summary>
      {corners.map((corner) => {
        const override = project.composition.cornerOverrides[corner];
        return (
          <label key={corner} className="corner-override">
            {corner}
            <select
              aria-label={`${corner} rotation override`}
              value={override === undefined ? "auto" : String(override)}
              onChange={(e) =>
                dispatch({
                  type: "corner-override",
                  corner,
                  rotation:
                    e.target.value === "auto"
                      ? null
                      : (Number(e.target.value) as TileRotation),
                })
              }
            >
              <option value="auto">Auto</option>
              {[0, 90, 180, 270].map((r) => (
                <option key={r} value={r}>
                  {r}°
                </option>
              ))}
            </select>
          </label>
        );
      })}
    </details>
  );
}
