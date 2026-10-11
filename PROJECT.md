# Repeatfield — Product Record

## Identity

**Product:** Repeatfield

**One-line promise:** A browser-local pattern playground for transforming images into repeatable fields, coordinated tile sets, and verified tessellations.

**Build home:** `~/Projects/product/repeatfield/`

**Versioning:** git repository on `main`; source and working decisions are versioned in commits. No snapshot archive convention.

## Product invariants

- All image work remains local in the browser.
- Three workflows are distinct: Field Tile, Tile Set, Tessellate.
- Core user journey remains `Crop → Repeat → Preview`.
- The artwork is the hero; UI personality must not contaminate exported work.
- Honest verification beats cosmetic claims — gaps/overlaps in Tessellate are surfaced, not hidden.

## Stable reference map

| Reference | Answers |
|---|---|
| `README.md` | what exists, how to run/verify |
| `PRODUCT-WORKFLOW.md` | behavioral/product requirements |
| `DESIGN-DIRECTION.md` | visual system and interaction character |
| `docs/` | technical/product documentation |
| `design/` | design explorations and specs |

## Orchestration

- Gustav registry: `~/Documents/Gustav Orchestrator/REGISTRY.md`
- Backlog: `ops/BACKLOG.md`
- Live state: `STATUS.md`
- New task thread naming: `repeatfield/<task-slug>-<yyyymmdd>`

## Current development posture

Active MVP build. The immediate stated product direction is the crop/repeat-clean workflow; exact active work is maintained in `STATUS.md` and `ops/BACKLOG.md`, not this durable record.
