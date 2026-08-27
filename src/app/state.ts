import type { Point, Quad } from "../engine/geometry";
import {
  clampQuadTranslation,
  translateQuad,
} from "../engine/geometry";
import {
  DEFAULT_METATILE,
  rotateCell,
  rotateMetatile,
  type MetatileState,
  type QuarterTurn,
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
  background: "#ece8f2",
  sourceZoom: 1,
  sourceOffsetX: 0,
  sourceOffsetY: 0,
  sourceRotation: 0,
};

export type FieldTileStage = "crop" | "repeat" | "preview";

export interface FieldTileProject {
  workflow: "field-tile";
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
}

interface TileSetSnapshot {
  composition: TileSetComposition;
  setLook: SetLook;
}

export interface TileSetProject {
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
      workflow,
      stage: "crop",
      crop: defaultCropState(),
      composition: { ...DEFAULT_FIELD_COMPOSITION },
      history: { past: [], future: [] },
    };
  if (workflow === "tile-set")
    return {
      workflow,
      stage: "tiles",
      activeRole: "field",
      roles: {
        field: { crop: defaultCropState(), hasImage: false },
        border: { crop: defaultCropState(), hasImage: false },
        corner: { crop: defaultCropState(), hasImage: false },
      },
      setLook: { ...DEFAULT_LOOK },
      composition: { ...DEFAULT_TILE_SET_COMPOSITION },
      history: { past: [], future: [] },
    };
  return {
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
  return project.workflow === "tile-set" && project.roles.field.hasImage;
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
  | { type: "set-stage"; stage: string }
  | {
      type: "field-comp";
      key: keyof FieldComposition;
      value: FieldComposition[keyof FieldComposition];
    }
  | { type: "rotate-metatile-cell"; index: number; delta: 1 | -1 }
  | { type: "rotate-metatile-block"; delta: 1 | -1 }
  | {
      type: "apply-metatile-preset";
      cells: readonly [QuarterTurn, QuarterTurn, QuarterTurn, QuarterTurn];
    }
  | { type: "reset-field-comp" }
  | { type: "set-active-role"; role: TileRole }
  | { type: "role-image"; role: TileRole; hasImage: boolean }
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
      case "field-comp": {
        let value = action.value;
        if (action.key === "sourceZoom")
          value = Math.max(0.25, Math.min(3, Number(value)));
        if (action.key === "tileScale")
          value = Math.max(50, Math.min(320, Number(value)));
        if (Object.is(project.composition[action.key], value)) return state;
        return withComposition({ ...project.composition, [action.key]: value });
      }
      case "rotate-metatile-cell": {
        const cells = [...project.composition.metatile.cells] as [
          QuarterTurn,
          QuarterTurn,
          QuarterTurn,
          QuarterTurn,
        ];
        cells[action.index] = rotateCell(cells[action.index], action.delta);
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
          metatile: { size: 2, cells: [...action.cells] as never },
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
