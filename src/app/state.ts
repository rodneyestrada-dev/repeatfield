import type { Point, Quad } from "../engine/geometry";
import {
  clampQuadTranslation,
  homographyFromUnitSquare,
  isSimpleConvexQuad,
  translateQuad,
} from "../engine/geometry";
import {
  DEFAULT_METATILE,
  normalizeMetatile,
  reflectCell,
  rotateCell,
  rotateMetatile,
  type CellTransform,
  type MetatileState,
} from "../engine/metatile";
import { DEFAULT_LOOK, type SetLook } from "../engine/appearance";
import type {
  FrameCorner,
  TileRole,
  TileRotation,
} from "../engine/frameLayout";
import type {
  RepeatLattice,
  ShapeInstance,
} from "../engine/tessellation";
import type { SegmentCount } from "../engine/patterns";

// ---------------------------------------------------------------------------
// Workflow discriminator — three distinct top-level edit workflows.
// ---------------------------------------------------------------------------

export type WorkflowKind = "field-tile" | "tile-set" | "tessellate";

export const WORKFLOW_NAMES: Record<WorkflowKind, string> = {
  "field-tile": "Field Tile",
  "tile-set": "Tile Set",
  tessellate: "Tessellate",
};

export interface BrowserAssetRef {
  id: string;
  name: string;
  type: string;
  kind: "demo" | "indexeddb";
}

const newProjectId = () =>
  globalThis.crypto?.randomUUID?.() ?? `project-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const DEMO_ASSET: BrowserAssetRef = {
  id: "bundled-demo",
  name: "Demo tile",
  type: "image/jpeg",
  kind: "demo",
};

// ---------------------------------------------------------------------------
// Shared Crop state — selection geometry is separate from warp geometry.
// warpQuad lives in selection-relative unit coordinates.
// ---------------------------------------------------------------------------

export type CropToolId = "select" | "warp" | "background";

export interface CropState {
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  selectionQuad: Quad;
  warpQuad: Quad;
  activeTool: CropToolId;
  openToolOptions: CropToolId | null;
  backgroundRemoval: {
    enabled: boolean;
    color: string;
    tolerance: number;
    feather: number;
  };
}

const DEFAULT_SELECTION: Quad = [
  { x: 0.12, y: 0.12 },
  { x: 0.88, y: 0.12 },
  { x: 0.88, y: 0.88 },
  { x: 0.12, y: 0.88 },
];

export const IDENTITY_WARP: Quad = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

const copyQuad = (quad: Quad): Quad =>
  quad.map((point) => ({ ...point })) as unknown as Quad;

export function defaultCropState(): CropState {
  return {
    rotation: 0,
    flipX: false,
    flipY: false,
    selectionQuad: copyQuad(DEFAULT_SELECTION),
    warpQuad: copyQuad(IDENTITY_WARP),
    activeTool: "select",
    openToolOptions: null,
    backgroundRemoval: {
      enabled: false,
      color: "#ffffff",
      tolerance: 28,
      feather: 12,
    },
  };
}

// ---------------------------------------------------------------------------
// Field Tile project — Tile Turn (metatile), Field Layout, Advanced Symmetry.
// ---------------------------------------------------------------------------

export type FieldLayoutId = "straight" | "brick" | "half-drop";
export type SymmetrySystemId =
  | "none"
  | "mirror-grid"
  | "triangle-kaleidoscope"
  | "radial-kaleidoscope";

export interface FieldComposition {
  metatile: MetatileState;
  layout: FieldLayoutId;
  symmetry: SymmetrySystemId;
  tileScale: number;
  gap: number;
  fieldRotation: number;
  segments: SegmentCount;
  showGuides: boolean;
  background: string;
  sourceZoom: number;
  sourceOffsetX: number;
  sourceOffsetY: number;
  sourceRotation: number;
}

export const DEFAULT_FIELD_COMPOSITION: FieldComposition = {
  metatile: DEFAULT_METATILE,
  layout: "straight",
  symmetry: "none",
  tileScale: 150,
  gap: 0,
  fieldRotation: 0,
  segments: 8,
  showGuides: false,
  background: "#f2ece3",
  sourceZoom: 1,
  sourceOffsetX: 0,
  sourceOffsetY: 0,
  sourceRotation: 0,
};

export type FieldTileStage = "crop" | "repeat" | "preview";

export interface FieldTileProject {
  id: string;
  workflow: "field-tile";
  sourceAsset: BrowserAssetRef | null;
  stage: FieldTileStage;
  crop: CropState;
  composition: FieldComposition;
  history: { past: FieldComposition[]; future: FieldComposition[] };
}

// ---------------------------------------------------------------------------
// Tile Set project — roles Field / Edge (internal id "border") / Corner.
// ---------------------------------------------------------------------------

export type TileSetStage = "tiles" | "compose" | "preview";
export type TileSetView = TileRole | "set";

export interface TileSetComposition {
  fieldColumns: number;
  fieldRows: number;
  borderEnabled: boolean;
  cornerEnabled: boolean;
  borderPhase: number;
  borderAlternate: boolean;
  borderReverse: boolean;
  cornerBaseRotation: TileRotation;
  cornerOverrides: Partial<Record<FrameCorner, TileRotation>>;
  viewMode: TileSetView;
  groutWidth: number;
  groutColor: string;
}

export const DEFAULT_TILE_SET_COMPOSITION: TileSetComposition = {
  fieldColumns: 3,
  fieldRows: 3,
  borderEnabled: true,
  cornerEnabled: true,
  borderPhase: 0,
  borderAlternate: false,
  borderReverse: false,
  cornerBaseRotation: 0,
  cornerOverrides: {},
  viewMode: "set",
  groutWidth: 2,
  groutColor: "#e7e2ee",
};

export interface TileSetRoleState {
  crop: CropState;
  hasImage: boolean;
  asset: BrowserAssetRef | null;
}

interface TileSetSnapshot {
  composition: TileSetComposition;
  setLook: SetLook;
}

export interface TileSetProject {
  id: string;
  workflow: "tile-set";
  stage: TileSetStage;
  activeRole: TileRole;
  roles: Record<TileRole, TileSetRoleState>;
  setLook: SetLook;
  composition: TileSetComposition;
  history: { past: TileSetSnapshot[]; future: TileSetSnapshot[] };
}

// ---------------------------------------------------------------------------
// Tessellate project — Primary / Infill shapes, Repeat Cell, coverage.
// ---------------------------------------------------------------------------

export type TessellateStage = "shapes" | "assemble" | "verify" | "preview";
export type ShapeRole = "primary" | "infill";

export interface ShapeSlot {
  hasImage: boolean;
  asset: BrowserAssetRef | null;
  backgroundRemoval: {
    enabled: boolean;
    color: string;
    tolerance: number;
    feather: number;
  };
  alphaThreshold: number;
  simplifyTolerance: number;
}

export function defaultShapeSlot(): ShapeSlot {
  return {
    hasImage: false,
    asset: null,
    backgroundRemoval: {
      enabled: false,
      color: "#ffffff",
      tolerance: 28,
      feather: 12,
    },
    alphaThreshold: 128,
    simplifyTolerance: 2,
  };
}

export interface TessellateComposition {
  instances: ShapeInstance[];
  lattice: RepeatLattice;
  outputMode: "field" | "medallion";
  groutMode: "touching" | "grout";
  groutWidth: number;
  showDiagnostics: boolean;
  showGhostCells: boolean;
}

export const DEFAULT_TESSELLATE_COMPOSITION: TessellateComposition = {
  instances: [],
  lattice: { u: { x: 320, y: 0 }, v: { x: 0, y: 320 } },
  outputMode: "field",
  groutMode: "touching",
  groutWidth: 0,
  showDiagnostics: true,
  showGhostCells: true,
};

export interface TessellateProject {
  id: string;
  workflow: "tessellate";
  stage: TessellateStage;
  activeShape: ShapeRole;
  shapes: Record<ShapeRole, ShapeSlot>;
  composition: TessellateComposition;
  selectedInstanceId: string | null;
  history: { past: TessellateComposition[]; future: TessellateComposition[] };
}

// ---------------------------------------------------------------------------
// Discriminated union — never one nullable mega-state.
// ---------------------------------------------------------------------------

export type PatternProject =
  | FieldTileProject
  | TileSetProject
  | TessellateProject;

export interface AppState {
  project: PatternProject | null;
}

export const INITIAL_STATE: AppState = { project: null };

export function createProject(workflow: WorkflowKind): PatternProject {
  if (workflow === "field-tile")
    return {
      id: newProjectId(),
      workflow,
      sourceAsset: { ...DEMO_ASSET },
      stage: "crop",
      crop: defaultCropState(),
      composition: {
        ...DEFAULT_FIELD_COMPOSITION,
        metatile: normalizeMetatile(DEFAULT_FIELD_COMPOSITION.metatile),
      },
      history: { past: [], future: [] },
    };
  if (workflow === "tile-set")
    return {
      id: newProjectId(),
      workflow,
      stage: "tiles",
      activeRole: "field",
      roles: {
        field: { crop: defaultCropState(), hasImage: false, asset: null },
        border: { crop: defaultCropState(), hasImage: false, asset: null },
        corner: { crop: defaultCropState(), hasImage: false, asset: null },
      },
      setLook: { ...DEFAULT_LOOK },
      composition: { ...DEFAULT_TILE_SET_COMPOSITION },
      history: { past: [], future: [] },
    };
  return {
    id: newProjectId(),
    workflow,
    stage: "shapes",
    activeShape: "primary",
    shapes: { primary: defaultShapeSlot(), infill: defaultShapeSlot() },
    composition: {
      ...DEFAULT_TESSELLATE_COMPOSITION,
      instances: [],
      lattice: {
        u: { ...DEFAULT_TESSELLATE_COMPOSITION.lattice.u },
        v: { ...DEFAULT_TESSELLATE_COMPOSITION.lattice.v },
      },
    },
    selectedInstanceId: null,
    history: { past: [], future: [] },
  };
}

// ---------------------------------------------------------------------------
// Validators — one workflow's state can never satisfy another's validator.
// ---------------------------------------------------------------------------

export function validateFieldTile(project: PatternProject): boolean {
  return (
    project.workflow === "field-tile" &&
    project.composition.metatile.cells.length === 4
  );
}
export function validateTileSet(project: PatternProject): boolean {
  return project.workflow === "tile-set" &&
    (["field", "border", "corner"] as const).every((role) => Boolean(project.roles[role].asset));
}
export function validateTessellate(project: PatternProject): boolean {
  return project.workflow === "tessellate" && project.shapes.primary.hasImage;
}

// ---------------------------------------------------------------------------
// Persistence — projects round-trip with the workflow discriminator.
// ---------------------------------------------------------------------------

export const STORAGE_KEY = "repeatfield.project.v3";

export function serializeProject(project: PatternProject): string {
  return JSON.stringify({ version: 3, project });
}

export function deserializeProject(raw: string | null): PatternProject | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const project = parsed?.project;
    if (
      !project ||
      !["field-tile", "tile-set", "tessellate"].includes(project.workflow)
    )
      return null;
    if (!project.id) project.id = newProjectId();
    // Legacy v3 projects persisted optimistic booleans but no bytes. Hydrate
    // only durable references: never claim Ready or substitute demo pixels.
    if (project.workflow === "field-tile") {
      if (!("sourceAsset" in project)) project.sourceAsset = null;
      project.composition.metatile = normalizeMetatile(project.composition.metatile);
      project.history ??= { past: [], future: [] };
      const past = Array.isArray(project.history.past) ? project.history.past : [];
      const future = Array.isArray(project.history.future) ? project.history.future : [];
      project.history.past = past.map((composition: FieldComposition) => ({
        ...composition,
        metatile: normalizeMetatile(composition?.metatile),
      }));
      project.history.future = future.map((composition: FieldComposition) => ({
        ...composition,
        metatile: normalizeMetatile(composition?.metatile),
      }));
    } else if (project.workflow === "tile-set") {
      for (const role of ["field", "border", "corner"] as const) {
        project.roles[role].asset ??= null;
        project.roles[role].hasImage = Boolean(project.roles[role].asset);
      }
    } else {
      for (const shape of ["primary", "infill"] as const) {
        project.shapes[shape].asset ??= null;
        project.shapes[shape].hasImage = Boolean(project.shapes[shape].asset);
      }
    }
    return project as PatternProject;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type CropAction =
  | { type: "crop-set-corner"; index: number; point: Point }
  | { type: "crop-set-warp-pin"; index: number; point: Point }
  | { type: "crop-translate-selection"; delta: Point }
  | { type: "crop-rotate" }
  | { type: "crop-flip"; axis: "x" | "y" }
  | { type: "crop-reset" }
  | { type: "crop-reset-selection" }
  | { type: "crop-reset-warp" }
  | { type: "crop-set-tool"; tool: CropToolId }
  | { type: "crop-toggle-options"; tool: CropToolId | null }
  | {
      type: "crop-background";
      key: "enabled" | "color" | "tolerance" | "feather";
      value: boolean | string | number;
    };

export type Action =
  | CropAction
  | { type: "create-project"; workflow: WorkflowKind }
  | { type: "load-project"; project: PatternProject }
  | { type: "close-project" }
  | { type: "set-field-asset"; asset: BrowserAssetRef }
  | { type: "set-stage"; stage: string }
  | {
      type: "field-comp";
      key: keyof FieldComposition;
      value: FieldComposition[keyof FieldComposition];
    }
  | { type: "rotate-metatile-cell"; index: number; delta: 1 | -1 }
  | { type: "reflect-metatile-cell"; index: number; axis: "x" | "y" }
  | { type: "reset-metatile-cell"; index: number }
  | { type: "rotate-metatile-block"; delta: 1 | -1 }
  | {
      type: "apply-metatile-preset";
      cells: MetatileState["cells"];
    }
  | { type: "reset-field-comp" }
  | { type: "set-active-role"; role: TileRole }
  | { type: "role-image"; role: TileRole; hasImage: boolean }
  | { type: "set-role-asset"; role: TileRole; asset: BrowserAssetRef }
  | {
      type: "tile-set-comp";
      key: keyof TileSetComposition;
      value: TileSetComposition[keyof TileSetComposition];
    }
  | { type: "corner-override"; corner: FrameCorner; rotation: TileRotation | null }
  | { type: "set-look"; key: keyof SetLook; value: number }
  | { type: "reset-set-look" }
  | { type: "set-active-shape"; shape: ShapeRole }
  | { type: "shape-image"; shape: ShapeRole; hasImage: boolean }
  | { type: "set-shape-asset"; shape: ShapeRole; asset: BrowserAssetRef }
  | {
      type: "shape-setting";
      shape: ShapeRole;
      key: "alphaThreshold" | "simplifyTolerance";
      value: number;
    }
  | {
      type: "shape-background";
      shape: ShapeRole;
      key: "enabled" | "color" | "tolerance" | "feather";
      value: boolean | string | number;
    }
  | { type: "add-instance"; instance: ShapeInstance }
  | { type: "update-instance"; id: string; patch: Partial<ShapeInstance> }
  | { type: "remove-instance"; id: string }
  | { type: "select-instance"; id: string | null }
  | {
      type: "tessellate-comp";
      key: keyof Omit<TessellateComposition, "instances" | "lattice">;
      value: TessellateComposition[keyof TessellateComposition];
    }
  | { type: "set-lattice"; lattice: RepeatLattice }
  | { type: "undo" }
  | { type: "redo" };

// ---------------------------------------------------------------------------
// Reducer helpers
// ---------------------------------------------------------------------------

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const HISTORY_LIMIT = 50;

function quadArea(quad: Quad) {
  return Math.abs(quad.reduce((sum, point, index) => {
    const next = quad[(index + 1) % 4];
    return sum + point.x * next.y - next.x * point.y;
  }, 0) / 2);
}

export function isValidEditableQuad(quad: Quad) {
  if (!isSimpleConvexQuad(quad) || quadArea(quad) < 1e-4) return false;
  const h = homographyFromUnitSquare(quad);
  const determinant =
    h[0] * (h[4] * h[8] - h[5] * h[7]) -
    h[1] * (h[3] * h[8] - h[5] * h[6]) +
    h[2] * (h[3] * h[7] - h[4] * h[6]);
  return Number.isFinite(determinant) && Math.abs(determinant) >= 1e-8;
}

function pushHistory<T>(history: { past: T[]; future: T[] }, snapshot: T) {
  return {
    past: [...history.past, snapshot].slice(-HISTORY_LIMIT),
    future: [] as T[],
  };
}

function reduceCrop(crop: CropState, action: CropAction): CropState {
  switch (action.type) {
    case "crop-set-corner": {
      const selectionQuad = copyQuad(crop.selectionQuad) as unknown as [
        Point,
        Point,
        Point,
        Point,
      ];
      selectionQuad[action.index] = {
        x: clamp01(action.point.x),
        y: clamp01(action.point.y),
      };
      if (!isValidEditableQuad(selectionQuad)) return crop;
      return { ...crop, selectionQuad };
    }
    case "crop-set-warp-pin": {
      const warpQuad = copyQuad(crop.warpQuad) as unknown as [
        Point,
        Point,
        Point,
        Point,
      ];
      warpQuad[action.index] = {
        x: Math.max(-0.5, Math.min(1.5, action.point.x)),
        y: Math.max(-0.5, Math.min(1.5, action.point.y)),
      };
      if (!isValidEditableQuad(warpQuad)) return crop;
      return { ...crop, warpQuad };
    }
    case "crop-translate-selection": {
      const delta = clampQuadTranslation(crop.selectionQuad, action.delta);
      return {
        ...crop,
        selectionQuad: translateQuad(crop.selectionQuad, delta),
      };
    }
    case "crop-rotate":
      return { ...crop, rotation: (crop.rotation + 90) % 360 };
    case "crop-flip":
      return action.axis === "x"
        ? { ...crop, flipX: !crop.flipX }
        : { ...crop, flipY: !crop.flipY };
    case "crop-reset":
      return defaultCropState();
    case "crop-reset-selection":
      return { ...crop, selectionQuad: copyQuad(DEFAULT_SELECTION) };
    case "crop-reset-warp":
      return { ...crop, warpQuad: copyQuad(IDENTITY_WARP) };
    case "crop-set-tool":
      return {
        ...crop,
        activeTool: action.tool,
        openToolOptions:
          crop.openToolOptions && crop.openToolOptions !== action.tool
            ? null
            : crop.openToolOptions,
      };
    case "crop-toggle-options":
      return {
        ...crop,
        openToolOptions:
          action.tool === null || crop.openToolOptions === action.tool
            ? null
            : action.tool,
      };
    case "crop-background":
      return {
        ...crop,
        backgroundRemoval: {
          ...crop.backgroundRemoval,
          [action.key]: action.value,
        },
      };
  }
}

const CROP_ACTIONS = new Set([
  "crop-set-corner",
  "crop-set-warp-pin",
  "crop-translate-selection",
  "crop-rotate",
  "crop-flip",
  "crop-reset",
  "crop-reset-selection",
  "crop-reset-warp",
  "crop-set-tool",
  "crop-toggle-options",
  "crop-background",
]);

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function appReducer(state: AppState, action: Action): AppState {
  if (action.type === "create-project")
    return { project: createProject(action.workflow) };
  if (action.type === "load-project") return { project: action.project };
  if (action.type === "close-project") return { project: null };
  const project = state.project;
  if (!project) return state;

  if (CROP_ACTIONS.has(action.type)) {
    const cropAction = action as CropAction;
    if (project.workflow === "field-tile")
      return {
        project: { ...project, crop: reduceCrop(project.crop, cropAction) },
      };
    if (project.workflow === "tile-set") {
      const role = project.activeRole;
      return {
        project: {
          ...project,
          roles: {
            ...project.roles,
            [role]: {
              ...project.roles[role],
              crop: reduceCrop(project.roles[role].crop, cropAction),
            },
          },
        },
      };
    }
    return state; // Tessellate has no lasso/warp crop; shapes use shape-background.
  }

  switch (action.type) {
    case "set-stage": {
      const stages: Record<WorkflowKind, string[]> = {
        "field-tile": ["crop", "repeat", "preview"],
        "tile-set": ["tiles", "compose", "preview"],
        tessellate: ["shapes", "assemble", "verify", "preview"],
      };
      if (!stages[project.workflow].includes(action.stage)) return state;
      if (project.workflow === "tile-set" && action.stage !== "tiles" && !validateTileSet(project))
        return state;
      return {
        project: { ...project, stage: action.stage } as PatternProject,
      };
    }
    case "undo": {
      if (!project.history.past.length) return state;
      if (project.workflow === "field-tile") {
        const previous = project.history.past.at(-1)!;
        return {
          project: {
            ...project,
            composition: previous,
            history: {
              past: project.history.past.slice(0, -1),
              future: [project.composition, ...project.history.future],
            },
          },
        };
      }
      if (project.workflow === "tile-set") {
        const previous = project.history.past.at(-1)!;
        return {
          project: {
            ...project,
            composition: previous.composition,
            setLook: previous.setLook,
            history: {
              past: project.history.past.slice(0, -1),
              future: [
                { composition: project.composition, setLook: project.setLook },
                ...project.history.future,
              ],
            },
          },
        };
      }
      const previous = project.history.past.at(-1)!;
      return {
        project: {
          ...project,
          composition: previous,
          history: {
            past: project.history.past.slice(0, -1),
            future: [project.composition, ...project.history.future],
          },
        },
      };
    }
    case "redo": {
      if (!project.history.future.length) return state;
      if (project.workflow === "field-tile") {
        const [next, ...future] = project.history.future;
        return {
          project: {
            ...project,
            composition: next,
            history: {
              past: [...project.history.past, project.composition].slice(
                -HISTORY_LIMIT,
              ),
              future,
            },
          },
        };
      }
      if (project.workflow === "tile-set") {
        const [next, ...future] = project.history.future;
        return {
          project: {
            ...project,
            composition: next.composition,
            setLook: next.setLook,
            history: {
              past: [
                ...project.history.past,
                { composition: project.composition, setLook: project.setLook },
              ].slice(-HISTORY_LIMIT),
              future,
            },
          },
        };
      }
      const [next, ...future] = project.history.future;
      return {
        project: {
          ...project,
          composition: next,
          history: {
            past: [...project.history.past, project.composition].slice(
              -HISTORY_LIMIT,
            ),
            future,
          },
        },
      };
    }
  }

  if (project.workflow === "field-tile") {
    const withComposition = (composition: FieldComposition): AppState => ({
      project: {
        ...project,
        composition,
        history: pushHistory(project.history, project.composition),
      },
    });
    switch (action.type) {
      case "set-field-asset":
        return { project: { ...project, sourceAsset: action.asset } };
      case "field-comp": {
        let value = action.value;
        if (action.key === "sourceZoom")
          value = Math.max(0.25, Math.min(3, Number(value)));
        if (action.key === "tileScale")
          value = Math.max(50, Math.min(320, Number(value)));
        if (Object.is(project.composition[action.key], value)) return state;
        return withComposition({ ...project.composition, [action.key]: value });
      }
      case "rotate-metatile-cell":
      case "reflect-metatile-cell":
      case "reset-metatile-cell": {
        if (action.index < 0 || action.index >= 4) return state;
        const cells = [...project.composition.metatile.cells] as unknown as [
          CellTransform,
          CellTransform,
          CellTransform,
          CellTransform,
        ];
        cells[action.index] = action.type === "rotate-metatile-cell"
          ? rotateCell(cells[action.index], action.delta)
          : action.type === "reflect-metatile-cell"
            ? reflectCell(cells[action.index], action.axis)
            : { rotation: 0, flipX: false, flipY: false };
        return withComposition({
          ...project.composition,
          metatile: { size: 2, cells },
        });
      }
      case "rotate-metatile-block":
        return withComposition({
          ...project.composition,
          metatile: rotateMetatile(project.composition.metatile, action.delta),
        });
      case "apply-metatile-preset":
        return withComposition({
          ...project.composition,
          metatile: normalizeMetatile({ size: 2, cells: action.cells }),
        });
      case "reset-field-comp":
        return withComposition({ ...DEFAULT_FIELD_COMPOSITION });
    }
    return state;
  }

  if (project.workflow === "tile-set") {
    const snapshot = (): TileSetSnapshot => ({
      composition: project.composition,
      setLook: project.setLook,
    });
    switch (action.type) {
      case "set-active-role":
        return { project: { ...project, activeRole: action.role } };
      case "role-image":
        return {
          project: {
            ...project,
            roles: {
              ...project.roles,
              [action.role]: {
                ...project.roles[action.role],
                hasImage: action.hasImage,
              },
            },
          },
        };
      case "set-role-asset":
        return {
          project: {
            ...project,
            roles: {
              ...project.roles,
              [action.role]: { ...project.roles[action.role], hasImage: true, asset: action.asset },
            },
          },
        };
      case "tile-set-comp":
        if (Object.is(project.composition[action.key], action.value))
          return state;
        return {
          project: {
            ...project,
            composition: { ...project.composition, [action.key]: action.value },
            history: pushHistory(project.history, snapshot()),
          },
        };
      case "corner-override": {
        const cornerOverrides = { ...project.composition.cornerOverrides };
        if (action.rotation === null) delete cornerOverrides[action.corner];
        else cornerOverrides[action.corner] = action.rotation;
        return {
          project: {
            ...project,
            composition: { ...project.composition, cornerOverrides },
            history: pushHistory(project.history, snapshot()),
          },
        };
      }
      case "set-look":
        return {
          project: {
            ...project,
            setLook: { ...project.setLook, [action.key]: action.value },
            history: pushHistory(project.history, snapshot()),
          },
        };
      case "reset-set-look":
        return {
          project: {
            ...project,
            setLook: { ...DEFAULT_LOOK },
            history: pushHistory(project.history, snapshot()),
          },
        };
    }
    return state;
  }

  // Tessellate
  const withComposition = (
    composition: TessellateComposition,
  ): AppState => ({
    project: {
      ...project,
      composition,
      history: pushHistory(project.history, project.composition),
    },
  });
  switch (action.type) {
    case "set-active-shape":
      return { project: { ...project, activeShape: action.shape } };
    case "shape-image":
      return {
        project: {
          ...project,
          shapes: {
            ...project.shapes,
            [action.shape]: {
              ...project.shapes[action.shape],
              hasImage: action.hasImage,
            },
          },
        },
      };
    case "set-shape-asset":
      return {
        project: {
          ...project,
          shapes: {
            ...project.shapes,
            [action.shape]: { ...project.shapes[action.shape], hasImage: true, asset: action.asset },
          },
        },
      };
    case "shape-setting":
      return {
        project: {
          ...project,
          shapes: {
            ...project.shapes,
            [action.shape]: {
              ...project.shapes[action.shape],
              [action.key]: action.value,
            },
          },
        },
      };
    case "shape-background":
      return {
        project: {
          ...project,
          shapes: {
            ...project.shapes,
            [action.shape]: {
              ...project.shapes[action.shape],
              backgroundRemoval: {
                ...project.shapes[action.shape].backgroundRemoval,
                [action.key]: action.value,
              },
            },
          },
        },
      };
    case "add-instance":
      return {
        project: {
          ...(withComposition({
            ...project.composition,
            instances: [...project.composition.instances, action.instance],
          }).project as TessellateProject),
          selectedInstanceId: action.instance.id,
        },
      };
    case "update-instance":
      return withComposition({
        ...project.composition,
        instances: project.composition.instances.map((instance) =>
          instance.id === action.id
            ? { ...instance, ...action.patch }
            : instance,
        ),
      });
    case "remove-instance":
      return {
        project: {
          ...(withComposition({
            ...project.composition,
            instances: project.composition.instances.filter(
              (instance) => instance.id !== action.id,
            ),
          }).project as TessellateProject),
          selectedInstanceId:
            project.selectedInstanceId === action.id
              ? null
              : project.selectedInstanceId,
        },
      };
    case "select-instance":
      return { project: { ...project, selectedInstanceId: action.id } };
    case "tessellate-comp":
      if (Object.is(project.composition[action.key], action.value))
        return state;
      return withComposition({
        ...project.composition,
        [action.key]: action.value,
      });
    case "set-lattice":
      return withComposition({
        ...project.composition,
        lattice: action.lattice,
      });
  }
  return state;
}

const cropMeaningful = (crop: CropState) => {
  const baseline = defaultCropState();
  return JSON.stringify({ ...crop, activeTool: baseline.activeTool, openToolOptions: null }) !==
    JSON.stringify(baseline);
};

/** Navigation/disclosure is not dirty; pixels, geometry, and output settings are. */
export function isProjectDirty(project: PatternProject): boolean {
  if (project.workflow === "field-tile")
    return project.sourceAsset?.kind === "indexeddb" || cropMeaningful(project.crop) ||
      JSON.stringify(project.composition) !== JSON.stringify(DEFAULT_FIELD_COMPOSITION);
  if (project.workflow === "tile-set")
    return Object.values(project.roles).some((role) => Boolean(role.asset) || cropMeaningful(role.crop)) ||
      JSON.stringify(project.composition) !== JSON.stringify(DEFAULT_TILE_SET_COMPOSITION) ||
      JSON.stringify(project.setLook) !== JSON.stringify(DEFAULT_LOOK);
  return Object.values(project.shapes).some((shape) => Boolean(shape.asset) ||
      JSON.stringify({ ...shape, asset: null, hasImage: false }) !== JSON.stringify(defaultShapeSlot())) ||
    JSON.stringify(project.composition) !== JSON.stringify(DEFAULT_TESSELLATE_COMPOSITION);
}
