# Repeatfield — Backlog

_Canonical task intake for Repeatfield. The desktop board is a projection of this file; agents do not edit the board directly._

## Ready for contract

_None. Rodney directive 2026-10-10: all pending Repeatfield work is parked._

## Needs triage

_None. Parked per Rodney directive 2026-10-10._

## Parked

_All pending Repeatfield tasks parked by Rodney's directive, 2026-10-10. Reactivation is human-only: unpark only on an explicit go._

- [ ] **Crop-repeat-clean MVP** — clarify and execute the intended crop/background-cleaning workflow. **✓ done =** approved task contract, implementation artifact, and focused test/QA evidence. **Gate:** Rodney approves substantial implementation plan.
- [ ] Review the existing untracked `design/` proposals and `sketches/`; classify each as active candidate, reference, or discard. **✓ done =** classification recorded in STATUS.md and no unreviewed proposal gets committed by accident.
- [ ] **Reflection + orange UI build** (from thread `repeatfield-reflection-design-build`, approved 2026-08) — per-cell horizontal/vertical reflection, curated Repeat presets, approved orange design system on the production React app; preserve three isolated workflows + browser-local privacy. **✓ done =** unit/E2E tests, responsive + export QA, independent review, deployment verified. **Gate:** Rodney re-approves before implementation resumes (task pre-dates the ICM orchestration layer). Source moved from `~/repeatfield` to this repo's `main`.

## Completed

- [x] Repeatfield MVP — crop, repeat, clean preview, PNG export (board `t_2b53e926`).
- [x] Continue build per PRODUCT-WORKFLOW.md (board `t_efd0d7b9`).

## Backlog rules

1. One line per task; implementation detail belongs in a task contract or task thread.
2. Every Ready item must state `✓ done = …` and a gate if one exists.
3. Lanes may propose changes but only Gustav/coordinator updates this file at merge gates.
4. Completed work is logged in git + STATUS.md; do not delete history.
5. Parked items are human-only to reactivate.
