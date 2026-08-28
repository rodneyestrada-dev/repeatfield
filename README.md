# Repeatfield

A browser-local pattern playground built with React, TypeScript, Vite, and native Canvas 2D. All images stay in the browser — there is no backend, account, or upload.

## Run

```bash
npm ci
npm run dev
```

Open the URL printed by Vite (normally `http://127.0.0.1:5173`).

## Three workflows

Repeatfield v0.3 asks **"What are you making?"** and offers exactly three distinct edit workflows. The choice is stored in the project, shown in the editor header, and never switched silently.

### Field Tile — `Crop → Repeat → Preview`

One square tile repeated across a surface. Starts with the bundled demo tile or your upload.

- **Crop**: a persistent designer workspace with an icon tool dock — Select tile (four-point lasso), Warp to square, Remove background, plus Rotate/Flip/Reset commands. The whole selection is draggable by mouse and nudgeable by arrow keys (`Shift+Arrow` for larger steps). Warp pins are separate from the lasso: they change how the selected pixels map into the square tile, with a live "Rectified tile" inset. `Continue to Repeat` is always visible in a sticky action bar.
- **Tile Turn**: rotate each of the four tiles in the 2×2 **Repeat Block** (click = clockwise, Shift-click = counter-clockwise), rotate/reset/randomize the whole block, or apply editable orientation presets (Aligned, Checker turn, Pinwheel, …). All 256 raw orientation assignments are reachable; 70 are canonical under whole-block rotation.
- **Field Layout**: Straight, Brick, or Half-Drop placement of the completed Repeat Block.
- **Advanced Symmetry**: Mirror Grid and Triangle/Radial Kaleidoscope, kept apart from ordinary layout.
- **Preview/Export**: square/portrait/landscape framing and custom-dimension PNG export from the same renderer. A `Clean / Poster` switch turns the preview into a framed-poster context scene (Phase 1.5): the field is mapped into a matted print on a wall with density, pan, frame, and mat controls, and the scene exports as its own PNG separate from the clean field.

### Tile Set — `Tiles → Compose Set`

A coordinated **Field · Edge · Corner** installation. Upload one image per role (no bundled demo); each role keeps fully independent crop/warp/background state, and switching roles never discards edits. Compose Set provides Edge Run (phase, alternate, reverse), Corner Join (baseline rotation + per-corner overrides), a shared non-destructive Set Look (brightness/contrast/saturation/warmth), grout preview, and framed-set PNG export.

### Tessellate — `Shapes → Assemble → Verify`

Irregular transparent shapes fitted together. Upload a **Primary** shape and an optional **Infill** (no bundled demo); remove backgrounds to real alpha, inspect the extracted contour (outer boundary + holes). Assemble places shape instances (drag, rotate 90°, reflect, duplicate) inside a U/V **Repeat Cell** with neighbor ghost cells. Coverage analysis counts per-pixel 0/1/2+ coverage *including neighboring cells* and reports honest states — Gap-free, Near fit, Gaps detected, Overlaps detected, Decorative packing — with a red/magenta gap/overlap heatmap in Verify. Touching vs Grout spacing and Field vs Medallion output are explicit. Export is transparent PNG; gaps are never hidden behind a painted background.

## History and persistence

Each project keeps a bounded 50-step undo history scoped to its own workflow (`Cmd/Ctrl+Z`, `Cmd/Ctrl+Shift+Z`, `Ctrl+Y`; ignored while typing in inputs). Projects round-trip through browser-local storage with the workflow discriminator, so a reload restores the same workflow.

## Verify

```bash
npm run test:run   # Vitest engine, state, and UI tests
npm run test:e2e   # Playwright workflow, crop, coverage, and responsive flows
npm run build      # TypeScript and production Vite build
```

## Limitations

Quadrilateral (not freehand) selection; color-distance background removal (no ML segmentation); mesh-based projective approximation; no automatic tessellation search (assisted manual placement only); no contour-snap suggestions yet.
