# Repeatfield Product Workflow

## Product model

Repeatfield is a three-stage creative workflow:

```text
01 CROP  →  02 REPEAT  →  03 PREVIEW
source       pattern       clean output / context
```

The uploaded image and all edits stay in one local browser project state. A user can move backward without losing later settings: changing the crop re-renders the repeat and preview; changing the repeat preserves the crop.

The global header should always show the three stages as primary navigation—not bury them inside one inspector.

---

## 01 — Tile Crop Workspace

### Goal

Extract the exact visual unit the user wants to transform before any repetition happens.

### Primary surface

A large source-image canvas with a visible crop boundary. The source image, not a settings panel, dominates the screen.

### Essential MVP controls

- Upload or replace PNG, JPEG, or WebP
- Square, portrait, landscape, and free crop
- Drag crop boundary and corner handles
- Pan image inside crop
- Zoom
- Rotate in 90-degree steps
- Fine rotation/straighten
- Flip horizontal/vertical
- Reset crop
- Before/after toggle: full source versus extracted tile
- Continue to Repeat

### Accuracy aids

- Pixel dimensions
- Rule-of-thirds/grid overlay
- Center crosshair
- Edge contrast against a neutral checkerboard
- 2×2 seam-check preview beside the crop

The seam-check preview is important: it lets users see whether the selected edges create obvious breaks before entering the full repeat editor.

### Later enhancement

For photographs of physical tiles, ordinary rectangular cropping may be insufficient. Add a **four-corner perspective correction** tool so a skewed tile can be straightened into a square or rectangle.

Automatic edge detection belongs after the manual perspective workflow is proven useful.

### Completion state

The user confirms a reusable source tile. Repeatfield stores:

```ts
interface CropState {
  sourceImage: ImageBitmap;
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  outputAspect: 'square' | 'portrait' | 'landscape' | 'free';
  rotationDeg: number;
  flipX: boolean;
  flipY: boolean;
  perspectiveCorners?: [Point, Point, Point, Point];
}
```

---

## 02 — Tile Repeat Workspace

### Goal

Turn the confirmed crop into multiple structured and kaleidoscopic fields.

### Primary surface

The current live pattern remains the largest element. Pattern families live in a visual preset rail, while source/field/symmetry controls remain in a contextual inspector.

### Pattern families for MVP

- Straight Repeat
- Half-Drop
- Brick
- Checker Rotate
- Mirror Grid
- Quarter-Turn Rosette
- Triangle Kaleidoscope
- Radial Kaleidoscope

### Essential controls

- Pattern family
- Source zoom and X/Y position inside each cell
- Source rotation
- Tile/cell scale
- Horizontal and vertical gap
- Field rotation
- Reflection rules
- Kaleidoscope segments: 3, 4, 6, 8, 12
- Canvas/background color
- Cell/seam guides
- Direct drag and zoom on canvas
- Reset current pattern
- Return to Crop
- Continue to Preview

### Key continuity behavior

- Editing the crop updates every preset thumbnail and the live field.
- Returning from Preview restores the exact repeat state.
- Repeat settings are deterministic so the same inputs reproduce the same output.

### Completion state

```ts
interface RepeatState {
  patternId: PatternId;
  sourceZoom: number;
  sourceOffsetX: number;
  sourceOffsetY: number;
  sourceRotationDeg: number;
  tileScale: number;
  gapX: number;
  gapY: number;
  fieldRotationDeg: number;
  segments: 3 | 4 | 6 | 8 | 12;
  alternateReflection: boolean;
  backgroundColor: string;
  showGuides: boolean;
}
```

---

## 03 — Output Preview Workspace

### Goal

Let the user experience the result as finished work, without editor panels competing with it.

### Default mode: Clean Preview

- Full-bleed pattern field
- No crop rail or inspector
- Minimal floating toolbar only when the pointer moves
- Fit, fill, and 100% zoom
- Portrait, square, and landscape framing
- Toggle guides off by default
- Fullscreen
- Back to Repeat
- Export PNG

The clean preview is part of the MVP. It must be a real presentation state, not merely “hide the sidebars” while preserving editor chrome.

### Context Preview mode

A compact `Clean / In context` switch can change the preview surface.

Initial context templates:

- Mural wall
- Framed poster
- Bus-stop advertising panel

Each template should have intentional framing and lighting. The pattern output is mapped into a predefined editable area; the rest of the scene remains a fixed visual template.

### Context controls

- Scene selector
- Output scale/crop inside scene
- Pattern density/zoom
- Optional background/frame color where relevant
- Before/after or clean/context toggle
- Export context image separately from the clean pattern asset

### Implementation posture

Do not introduce Three.js for the first context previews. Mural, poster, and bus-stop scenes can be convincing 2D compositions using:

- a licensed or original background image;
- a predefined four-corner perspective quadrilateral;
- Canvas/WebGL perspective mapping;
- multiply/overlay lighting layers;
- masks, shadows, and subtle grain.

This is faster, lighter, and visually more controlled than a generic 3D environment.

### Later context capabilities

- User uploads their own wall/scene photo
- Manual four-corner placement on the photo
- Surface blend modes and shadow strength
- Additional editorial contexts: gallery wall, book cover, billboard, textile swatch
- Saved context presets

---

## Global navigation

Desktop header:

```text
REPEATFIELD       01 Crop ─── 02 Repeat ─── 03 Preview       Save locally   Export
```

Navigation behavior:

- Current stage has a filled violet indicator.
- Completed stages have a check or visible thumbnail state.
- Future stages are accessible once their required state exists.
- Back/forward browser history should follow stage changes.
- Export is available in Preview; a quick export may remain in Repeat but should not compete with “Preview output.”

Mobile navigation:

- Three-stage compact stepper in the header
- Crop controls and Repeat inspector use bottom sheets
- Preview remains full-screen with a floating compact toolbar

---

## Product phases

### Phase 1 — Core MVP

Ship the complete creative loop:

1. Accurate crop workspace
2. Eight repeat/kaleidoscope systems
3. Clean output preview
4. High-resolution PNG export
5. Local-only image processing
6. Responsive desktop/mobile workflow

### Phase 1.5 — First context proof

Add one exceptionally polished context scene: **framed poster**.

Why poster first:

- simplest perspective geometry;
- easy to validate export quality;
- broadly useful for designers and artists;
- establishes the scene-template system without overbuilding it.

### Phase 2 — Context collection

Add:

- Mural wall
- Bus-stop advertising panel
- Scene selector
- Per-scene output adjustment
- Separate clean/context exports

### Phase 3 — User-created contexts

Add:

- upload a scene photo;
- four-corner output placement;
- perspective and mask controls;
- lighting/blend controls;
- saved local projects or optional shareable cloud projects.

---

## Revised MVP boundary

### Included

- Three explicit workspaces
- Accurate crop workflow
- Repeat/kaleidoscope engine
- Clean, chrome-free output preview
- PNG export

### Deferred but designed for

- Perspective correction of photographed source tiles
- Poster/mural/bus-stop context scenes
- User-uploaded context photos
- 3D environments
- Accounts and cloud storage

The application architecture should support Preview scenes later, but no 3D or scene-template dependency should be included in the initial bundle.
