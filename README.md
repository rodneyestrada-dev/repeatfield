# Repeatfield

A browser-local pattern playground built with React, TypeScript, Vite, and native Canvas 2D. Start with the supplied demo tile or upload a PNG, JPEG, or WebP; the image remains in the browser.

## Run

```bash
npm ci
npm run dev
```

Open the URL printed by Vite (normally `http://127.0.0.1:5173`).

## Crop, warp, and remove background

Crop presents three explicit browser-local tools:

1. **LASSO TILE** — drag the four violet-and-white corner handles directly around one tile in the source image.
2. **WARP TO SQUARE** — use the connected 10 × 10 square target grid to judge perspective and straightness. The selected quadrilateral is projectively mapped into a square tile by a homography and subdivided Canvas 2D mesh.
3. **REMOVE BACKGROUND** — click/eyedrop an unwanted source color, then tune tolerance and edge feather. Matching pixels become transparent, the checkerboard reveals the mask, and Reset background removal restores the source. No upload, server, ML model, or heavy dependency is involved.

The rectified square—with optional transparency—is the real source for the 2 × 2 seam check, every Repeat mode, Preview, and PNG export. Rotate 90°, horizontal/vertical flip, and Reset crop remain available as discrete source actions. Non-square and perspective-skewed photographs are supported; keep the four corners ordered around the intended tile and avoid crossing the lasso edges.

## Repeat history

Repeat-stage settings have a bounded 50-step undo history. Entering Repeat from Crop starts a fresh baseline; making a new edit after undo clears redo.

- **Undo:** `Cmd+Z` on macOS or `Ctrl+Z` elsewhere
- **Redo:** `Cmd+Shift+Z`, `Ctrl+Shift+Z`, or `Ctrl+Y`

The visible Undo and Redo buttons show disabled states and shortcut tooltips. Shortcuts are intentionally ignored while focus is in an input, select, textarea, or editable element.

## Verify

```bash
npm run test:run   # Vitest geometry, homography, state, and UI tests
npm run test:e2e   # Playwright crop drag, history, responsive, and PNG flows
npm run build      # TypeScript and production Vite build
```

## v0.2 scope

- Crop workspace: four-corner perspective lasso, square target grid, rotate/flip/reset source actions, and rectified 2 × 2 seam check.
- Repeat workspace: eight repeat systems, source/field/symmetry/guide/background controls, and bounded Undo/Redo.
- Preview workspace: clean square/portrait/landscape field, fullscreen-style mode, and custom-dimension PNG export.

All processing and export happen client-side. There is no backend, account, cloud save, or seam-healing algorithm.
