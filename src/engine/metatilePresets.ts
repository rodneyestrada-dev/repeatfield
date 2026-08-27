import type { QuarterTurn } from "./metatile";

export interface MetatilePreset {
  id: string;
  name: string;
  cells: readonly [QuarterTurn, QuarterTurn, QuarterTurn, QuarterTurn];
}

// Row-major cell order: TL, TR, BL, BR. Presets populate normal editable state.
export const METATILE_PRESETS: MetatilePreset[] = [
  { id: "aligned", name: "Aligned", cells: [0, 0, 0, 0] },
  { id: "checker", name: "Checker turn", cells: [0, 2, 2, 0] },
  { id: "pinwheel", name: "Pinwheel", cells: [0, 1, 3, 2] },
  { id: "inward", name: "Inward corners", cells: [1, 2, 0, 3] },
  { id: "outward", name: "Outward corners", cells: [3, 0, 2, 1] },
  { id: "rows", name: "Alternating rows", cells: [0, 0, 2, 2] },
  { id: "columns", name: "Alternating columns", cells: [0, 2, 0, 2] },
];

export function presetById(id: string): MetatilePreset | undefined {
  return METATILE_PRESETS.find((preset) => preset.id === id);
}
