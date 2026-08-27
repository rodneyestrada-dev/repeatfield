import type { ReactNode } from "react";
import type { CropToolId } from "./state";

export type CropToolKind = "modal" | "command";

export interface CropToolDefinition {
  id: CropToolId | "rotate" | "flip-x" | "flip-y" | "reset";
  label: string;
  kind: CropToolKind;
  hasOptions: boolean;
  icon: ReactNode;
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const CROP_TOOLS: CropToolDefinition[] = [
  {
    id: "select",
    label: "Select tile",
    kind: "modal",
    hasOptions: true,
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="M5 7 L18 5 L19 17 L7 19 Z" {...stroke} />
        <circle cx="5" cy="7" r="1.7" fill="currentColor" />
        <circle cx="18" cy="5" r="1.7" fill="currentColor" />
        <circle cx="19" cy="17" r="1.7" fill="currentColor" />
        <circle cx="7" cy="19" r="1.7" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "warp",
    label: "Warp to square",
    kind: "modal",
    hasOptions: true,
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="M4 4 H20 V20 H4 Z" {...stroke} />
        <path d="M9.3 4 L9.3 20 M14.6 4 L14.6 20 M4 9.3 L20 9.3 M4 14.6 L20 14.6" {...stroke} strokeWidth={0.9} />
        <path d="M7 2 L4 4 L7 6" {...stroke} />
      </svg>
    ),
  },
  {
    id: "background",
    label: "Remove background",
    kind: "modal",
    hasOptions: true,
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <rect x="4" y="4" width="5" height="5" fill="currentColor" opacity="0.35" />
        <rect x="14" y="9" width="5" height="5" fill="currentColor" opacity="0.35" />
        <rect x="9" y="14" width="5" height="5" fill="currentColor" opacity="0.35" />
        <path d="M18 4 L20 6 L8 18 L5 19 L6 16 Z" {...stroke} />
      </svg>
    ),
  },
  {
    id: "rotate",
    label: "Rotate 90°",
    kind: "command",
    hasOptions: false,
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="M19 12 A7 7 0 1 1 12 5" {...stroke} />
        <path d="M12 2 L16 5 L12 8" {...stroke} />
      </svg>
    ),
  },
  {
    id: "flip-x",
    label: "Flip horizontal",
    kind: "command",
    hasOptions: false,
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="M12 3 V21" {...stroke} strokeDasharray="2.5 2.5" />
        <path d="M8 7 L4 12 L8 17 Z" {...stroke} />
        <path d="M16 7 L20 12 L16 17 Z" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "flip-y",
    label: "Flip vertical",
    kind: "command",
    hasOptions: false,
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="M3 12 H21" {...stroke} strokeDasharray="2.5 2.5" />
        <path d="M7 8 L12 4 L17 8 Z" {...stroke} />
        <path d="M7 16 L12 20 L17 16 Z" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "reset",
    label: "Reset crop",
    kind: "command",
    hasOptions: false,
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="M5 12 A7 7 0 1 0 8 6.3" {...stroke} />
        <path d="M8 2.6 L7.6 6.6 L11.6 7" {...stroke} />
      </svg>
    ),
  },
];
