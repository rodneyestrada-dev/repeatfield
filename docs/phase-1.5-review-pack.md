# Repeatfield Phase 1.5 — Review Pack (pre-commit)

Status: **complete, uncommitted, awaiting Rodney's review.** No commits until explicit approval.

## Modified files (9)

| File | Why it changed |
|---|---|
| `src/app/App.tsx` | Designer's Soft Studio homepage (hero, workflow cards, gallery, FAQ, theme toggle); per-role bundled demo asset resolution (`demoAssetUrl`, `DEMO_FILES` map) so Field/Edge/Corner/Tessellate each load their own high-res demo. |
| `src/app/state.ts` | Bundled demo prefill for new projects (PNG metadata corrected), app-provided demos excluded from dirty-state detection so fresh projects don't prompt "unsaved changes". |
| `src/app/FieldTileEditor.tsx` | CTA labels: `Continue to Repeat →` → **Repeat**, `Preview output →` → **Preview**, `Back to edit` → **Back** with dedicated `preview-back` class. |
| `src/app/TileSetEditor.tsx` | `Continue to Compose Set →` → **Compose Set** (both crop and empty-state call sites). |
| `src/app/TessellateEditor.tsx` | `Continue to Assemble →` → **Assemble** (both call sites). |
| `src/styles.css` | Shared `.primary` orange pill token; pure-white edit canvases; `.app-shell` explicit row placement (fixes 50px-row collapse on Preview/Compose/Assemble/Verify); dedicated `.tessellate-shape-body` grid (fixes 28px canvas); `.preview-back` solid `#fff` in dark mode. |
| `src/app/App.test.tsx` | Landing-page assertions updated to Soft Studio DOM (`.landing-workflow`, theme toggle); concise CTA name assertions. |
| `src/app/state.test.ts` | Bundled-demo clean-state assertions; role replacement independence. |
| `e2e/app.spec.ts` | New regression: dark Preview keeps Back solid white (`rgb(255,255,255)`); bundled roles/shape workflow coverage; no-filebar full-height stage regression; label updates. |

## New assets (untracked, intended to ship)

- `public/demo-tile-field.png`, `demo-tile-edge.png`, `demo-tile-corner.png` — 2048×2048, exact favicon geometry, Moroccan `rx=6` corners. Field `#fff7ee`/`#ff8c24`, Edge `#fec09a`/`#c7551a`, Corner `#fd832f`/`#c7551a` (pixel-verified).
- `public/demo-shape-petal.png` — 2048² transparent Tessellate demo shape.
- `scripts/generate-demo-assets.py` — source-of-truth generator (render was executed via `sips` because system Python lacks Pillow; output pixels verified to match the script spec).
- `design/repeatfield-favicon.svg`, `design/repeatfield-tile-logo.svg` — brand sources.
- `design/proposals/` — plan-stage HTML samples (template + correction iterations + render checks).
- `scripts/enum-stages.mjs`, `probe-preview.mjs`, `probe-tess-collapse.mjs`, `repro-error-pages.mjs`, `verify-plan-html.mjs`, `gen-proposal-tiles.py` — diagnostic/verification harnesses used to catch the layout bugs.
- `qa-shots/final/` — final visual QA screenshots:
  - `landing-light.png`, `landing-dark.png` — Soft Studio homepage both themes
  - `field-crop.png` — Field Tile crop with new bundled demo
  - `field-preview-dark.png` — dark Preview with solid-white Back
  - `tileset-tiles.png` — Tile Set roles with new Edge/Corner demos

## Verification evidence

| Check | Result |
|---|---|
| `npm run test:run` | 14 files, **125 passed** |
| `npm run test:e2e` | **16 passed** (incl. dark-Back + no-filebar regressions) |
| `npm run build` | ✓ `tsc -b && vite build` |
| `git diff --check` | ✓ clean |
| Final screenshot pass | zero page errors |

## Notes / risks

- Working tree only; nothing committed or pushed.
- Old `public/source-tile.jpg` is no longer referenced as the default demo (left in place; can be removed on approval).
- Phase 2 (mural wall + bus-stop scenes) not started — awaiting go signal.
