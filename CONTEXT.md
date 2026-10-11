# CONTEXT.md — Repeatfield Task Router

## Route by task type

| Task | Read first | Primary write scope | Definition of done |
|---|---|---|---|
| Crop / image preparation | `PRODUCT-WORKFLOW.md` §01 + relevant `src/` code | `src/` | crop behavior works; focused tests pass |
| Repeat / layout / symmetry | `PRODUCT-WORKFLOW.md` §02 + relevant `src/` code | `src/` | deterministic repeat behavior + tests |
| Preview / export | `PRODUCT-WORKFLOW.md` §03 + relevant `src/` code | `src/`, `e2e/` | export/preview behavior verified |
| Design direction / UI | `DESIGN-DIRECTION.md` + target component | `design/`, `public/`, targeted UI files only if lane scope allows | visual artifact or approved implementation + QA evidence |
| Product decision / prioritization | `PROJECT.md`, `STATUS.md`, `ops/BACKLOG.md` | coordinator only | decision recorded, next action named |
| QA / regression | `README.md` Verify section + relevant specs | `e2e/`, test files | command output recorded in task status |

## Required task contract

Every non-trivial task starts with a contract in `~/.hermes/plans/` containing:

1. Goal
2. `✓ done =` observable artifact
3. Named references from the table above
4. Allowed write-scope
5. Whether Rodney approval is needed

## Current workflow contract

`01 CROP → 02 REPEAT → 03 PREVIEW` is the product's core sequential pipeline. A user may move backward without losing later settings; crop changes re-render repeat and preview. Keep that invariant.

## Handoff rule

If design and build lanes run concurrently, design publishes stable outputs (tokens, assets, copy, specification) under `handoffs/design/`; build consumes a pinned version. Integration happens only at the merge gate.
