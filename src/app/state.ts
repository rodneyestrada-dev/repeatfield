import { DEFAULT_REPEAT, type RepeatSettings } from "../engine/patterns";
import type { CropAspect, Point, Quad } from "../engine/geometry";

export type Workspace = "crop" | "repeat" | "preview";
export interface CropState {
  aspect: CropAspect;
  zoom: number;
  panX: number;
  panY: number;
  rotation: number;
  fineRotation: number;
  flipX: boolean;
  flipY: boolean;
  quad: Quad;
  backgroundRemoval: {
    enabled: boolean;
    color: string;
    tolerance: number;
    feather: number;
  };
}
export interface RepeatHistory {
  past: RepeatSettings[];
  future: RepeatSettings[];
}
export interface AppState {
  workspace: Workspace;
  repeat: RepeatSettings;
  repeatHistory: RepeatHistory;
  crop: CropState;
}

const DEFAULT_QUAD: Quad = [
  { x: 0.12, y: 0.12 },
  { x: 0.88, y: 0.12 },
  { x: 0.88, y: 0.88 },
  { x: 0.12, y: 0.88 },
];
export const INITIAL_STATE: AppState = {
  workspace: "crop",
  repeat: { ...DEFAULT_REPEAT },
  repeatHistory: { past: [], future: [] },
  crop: {
    aspect: "square",
    zoom: 1,
    panX: 0,
    panY: 0,
    rotation: 0,
    fineRotation: 0,
    flipX: false,
    flipY: false,
    quad: DEFAULT_QUAD.map((point) => ({ ...point })) as unknown as Quad,
    backgroundRemoval: {
      enabled: false,
      color: "#ffffff",
      tolerance: 28,
      feather: 12,
    },
  },
};

type Action =
  | { type: "set-workspace"; value: Workspace }
  | {
      type: "repeat";
      key: keyof RepeatSettings;
      value: RepeatSettings[keyof RepeatSettings];
    }
  | {
      type: "crop";
      key: "aspect" | "zoom" | "panX" | "panY" | "fineRotation";
      value: string | number;
    }
  | { type: "set-crop-corner"; index: number; point: Point }
  | {
      type: "crop-background";
      key: "enabled" | "color" | "tolerance" | "feather";
      value: boolean | string | number;
    }
  | { type: "rotate-crop" }
  | { type: "flip-crop"; axis: "x" | "y" }
  | { type: "reset-crop" }
  | { type: "reset-repeat" }
  | { type: "undo-repeat" }
  | { type: "redo-repeat" };

const copyRepeat = (repeat: RepeatSettings): RepeatSettings => ({ ...repeat });
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function appReducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case "set-workspace":
      return {
        ...s,
        workspace: a.value,
        repeatHistory:
          a.value === "repeat" && s.workspace === "crop"
            ? { past: [], future: [] }
            : s.repeatHistory,
      };
    case "repeat": {
      let value = a.value;
      if (a.key === "sourceZoom")
        value = Math.max(0.25, Math.min(3, Number(value)));
      if (a.key === "tileScale")
        value = Math.max(50, Math.min(320, Number(value)));
      const next = { ...s.repeat, [a.key]: value };
      if (Object.is(s.repeat[a.key], value)) return s;
      return {
        ...s,
        repeat: next,
        repeatHistory: {
          past: [...s.repeatHistory.past, copyRepeat(s.repeat)].slice(-50),
          future: [],
        },
      };
    }
    case "undo-repeat": {
      if (!s.repeatHistory.past.length) return s;
      const repeat = s.repeatHistory.past.at(-1)!;
      return {
        ...s,
        repeat,
        repeatHistory: {
          past: s.repeatHistory.past.slice(0, -1),
          future: [copyRepeat(s.repeat), ...s.repeatHistory.future],
        },
      };
    }
    case "redo-repeat": {
      if (!s.repeatHistory.future.length) return s;
      const [repeat, ...future] = s.repeatHistory.future;
      return {
        ...s,
        repeat,
        repeatHistory: {
          past: [...s.repeatHistory.past, copyRepeat(s.repeat)].slice(-50),
          future,
        },
      };
    }
    case "crop":
      return { ...s, crop: { ...s.crop, [a.key]: a.value } };
    case "crop-background":
      return {
        ...s,
        crop: {
          ...s.crop,
          backgroundRemoval: { ...s.crop.backgroundRemoval, [a.key]: a.value },
        },
      };
    case "set-crop-corner": {
      const quad = s.crop.quad.map((point) => ({ ...point })) as unknown as [
        Point,
        Point,
        Point,
        Point,
      ];
      quad[a.index] = { x: clamp01(a.point.x), y: clamp01(a.point.y) };
      return { ...s, crop: { ...s.crop, quad } };
    }
    case "rotate-crop":
      return {
        ...s,
        crop: { ...s.crop, rotation: (s.crop.rotation + 90) % 360 },
      };
    case "flip-crop": {
      const key = a.axis === "x" ? "flipX" : "flipY";
      return { ...s, crop: { ...s.crop, [key]: !s.crop[key] } };
    }
    case "reset-crop":
      return {
        ...s,
        crop: {
          ...INITIAL_STATE.crop,
          quad: INITIAL_STATE.crop.quad.map((point) => ({
            ...point,
          })) as unknown as Quad,
        },
      };
    case "reset-repeat":
      return {
        ...s,
        repeat: { ...DEFAULT_REPEAT },
        repeatHistory: {
          past: [...s.repeatHistory.past, copyRepeat(s.repeat)].slice(-50),
          future: [],
        },
      };
  }
}
