import { normalizeMetatile, type MetatileState, type QuarterTurn } from "./metatile";

export type RandomMetatileMode = "turn" | "turn-reflect";

export interface MetatilePreset {
  id: string;
  name: string;
  cells?: MetatileState["cells"];
  generate?: RandomMetatileMode;
}

export interface MetatilePresetGroup {
  id: "repeat" | "turn" | "reflect" | "generate";
  name: string;
  presets: readonly MetatilePreset[];
}

const cells = (...values: readonly unknown[]): MetatileState["cells"] =>
  normalizeMetatile({ size: 2, cells: values }).cells;
const t = (rotation: QuarterTurn, flipX = false, flipY = false) => ({ rotation, flipX, flipY });

export function generateRandomMetatile(
  mode: RandomMetatileMode,
  random: () => number = Math.random,
): MetatileState["cells"] {
  return [0, 1, 2, 3].map(() => {
    const rotation = Math.min(3, Math.floor(Math.max(0, random()) * 4)) as QuarterTurn;
    if (mode === "turn") return t(rotation);
    return t(rotation, random() >= 0.5, random() >= 0.5);
  }) as unknown as MetatileState["cells"];
}

export const METATILE_PRESET_GROUPS: readonly MetatilePresetGroup[] = [
  {
    id: "repeat",
    name: "Repeat",
    presets: [
      { id: "aligned", name: "Aligned", cells: cells(0, 0, 0, 0) },
      { id: "alternating-rows", name: "Alternating Rows", cells: cells(0, 0, 2, 2) },
      { id: "alternating-columns", name: "Alternating Columns", cells: cells(0, 2, 0, 2) },
    ],
  },
  {
    id: "turn",
    name: "Turn",
    presets: [
      { id: "checker-90-cw", name: "Checker 90° CW", cells: cells(0, 1, 1, 0) },
      { id: "checker-90-ccw", name: "Checker 90° CCW", cells: cells(0, 3, 3, 0) },
      { id: "checker-180", name: "Checker 180°", cells: cells(0, 2, 2, 0) },
      { id: "pinwheel", name: "Pinwheel", cells: cells(0, 1, 3, 2) },
      { id: "inward-corners", name: "Inward Corners", cells: cells(1, 2, 0, 3) },
      { id: "outward-corners", name: "Outward Corners", cells: cells(3, 0, 2, 1) },
    ],
  },
  {
    id: "reflect",
    name: "Reflect",
    presets: [
      { id: "checker-reflect-h", name: "Checker Reflect H", cells: cells(t(0), t(0, true), t(0, true), t(0)) },
      { id: "checker-reflect-v", name: "Checker Reflect V", cells: cells(t(0), t(0, false, true), t(0, false, true), t(0)) },
      { id: "unfold", name: "Unfold", cells: cells(t(0), t(1, true), t(3, false, true), t(2, true, true)) },
      { id: "mirror-grid", name: "Mirror Grid", cells: cells(t(0), t(0, true), t(0, false, true), t(0, true, true)) },
    ],
  },
  {
    id: "generate",
    name: "Generate",
    presets: [
      { id: "random-turn", name: "Random Turn", generate: "turn" },
      { id: "random-turn-reflect", name: "Random Turn + Reflect", generate: "turn-reflect" },
    ],
  },
];

export const METATILE_PRESETS: readonly MetatilePreset[] = METATILE_PRESET_GROUPS.flatMap(
  (group) => group.presets,
);

export function presetById(id: string): MetatilePreset | undefined {
  return METATILE_PRESETS.find((preset) => preset.id === id);
}
