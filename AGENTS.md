# AGENTS.md — Repeatfield

**What is this:** Repeatfield is a browser-local pattern playground. It turns source images into repeatable fields through three distinct workflows: Field Tile, Tile Set, and Tessellate. Images stay in the browser; there is no backend, account, or upload.

**Where am I:** `~/Projects/product/repeatfield/` — Repeatfield's canonical build home and git repository. Its product registry entry is in `~/Documents/Gustav Orchestrator/REGISTRY.md`.

**What next:**
- Current state, next ship, and blockers → `STATUS.md`
- Product identity / durable decisions → `PROJECT.md`
- Work intake → `ops/BACKLOG.md`
- Product behavior → `PRODUCT-WORKFLOW.md`
- Visual system → `DESIGN-DIRECTION.md`
- Build/test commands → `README.md`

## ICM context routing

- This file = Layer 0: identity and entry point.
- `CONTEXT.md` = Layer 1: task routing.
- Per-task contract in `.hermes/plans/` = Layer 2: goal, done-state, scope, gates.
- `PRODUCT-WORKFLOW.md`, `DESIGN-DIRECTION.md`, `docs/` = Layer 3: stable references.
- Source changes, design artifacts, test output, and `handoffs/` = Layer 4: working artifacts.

Load only what the task contract names. Do not read the entire repo by default.

## Guardrails

1. Preserve browser-local processing: no image backend, account, or upload unless Rodney explicitly approves a product change.
2. Keep the three workflows distinct. Never silently switch a user's chosen workflow.
3. Do not overwrite or commit pre-existing untracked work without explicit review.
4. Every task has a `✓ done = …` artifact before execution.
5. Public deployment, substantial product direction changes, and paid services require Rodney's approval.
6. Update `STATUS.md` before closing a task thread. No close without a status diff.

## Parallel lanes

A task may have up to two active lanes, with contracts declaring exclusive write-scopes.
- Build lane normally owns: `src/`, `e2e/`, `scripts/`, tests/config needed by code.
- Design lane normally owns: `design/`, `public/`, `artifacts/`, `qa-shots/`.
- Shared root files, `STATUS.md`, `PROJECT.md`, and `ops/` are coordinator-owned. Lanes submit proposals; Gustav applies them at the merge gate.
- Cross-lane material is published to `handoffs/<lane>/<artifact>.vN`, immutable and versioned. Never edit another lane's working output in place.
