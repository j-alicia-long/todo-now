# Eisenhower Matrix view for Board tasks

> Source: https://github.com/j-alicia-long/todo-now/issues/1

## Problem Statement

Jennifer's Board shows *when* she plans to do Tasks (This Week / This Month), but not *which ones actually matter*. When the Board fills up, everything looks equally pressing, and there's no way to step back and see which Tasks are truly important versus merely urgent — so important-but-not-urgent work (the "Schedule" kind) silently loses to whatever screams loudest.

## Solution

A new **Matrix** view: an Eisenhower 2×2 grid that maps Board Tasks (This Week and This Month only) by **importance** and **urgency**. Importance is an explicit binary judgment Jennifer sets by dragging; urgency is derived from the due date and never stored (per ADR-0001). The four Quadrants use solo-friendly names: **Do** (urgent + important), **Schedule** (important only), **Quick-hit** (urgent only), and **Reconsider** (neither). Tasks whose importance hasn't been set yet wait in an **Unsorted** tray beside the grid. Dragging a Task between Quadrants updates its importance, and — because urgency is derived — dragging across the urgency boundary writes the due date: into an urgent Quadrant sets it to 2 days out; out of an urgent Quadrant pushes it to 7 days out.

## User Stories

1. As the app's user, I want a Matrix view of my Board Tasks, so that I can see at a glance which tasks matter versus which are merely time-pressured.
2. As the app's user, I want the Matrix to show only This Week and This Month Tasks, so that Future parking-lot items and Done tasks don't clutter my prioritization.
3. As the app's user, I want each Task to appear in exactly one Quadrant, so that placement is an unambiguous judgment rather than a fuzzy position.
4. As the app's user, I want urgency computed from my existing due dates (due within 2 days or overdue = urgent), so that the Matrix always agrees with the due-date colors I already trust.
5. As the app's user, I want Tasks with no due date treated as not urgent, so that undated tasks never masquerade as fires.
6. As the app's user, I want an Unsorted tray for Tasks I haven't judged yet, so that new Tasks don't get silently assigned an importance I never chose.
7. As the app's user, I want to drag a Task from Unsorted into a Quadrant, so that sorting my backlog into the Matrix is a single gesture.
8. As the app's user, I want to drag a Task horizontally between Quadrants to flip its importance, so that changing my mind is instant.
9. As the app's user, I want dragging a Task into an urgent Quadrant to set its due date to 2 days from today, so that "this is urgent now" becomes a real deadline.
10. As the app's user, I want dragging a Task out of an urgent Quadrant to push its due date to 7 days out, so that de-escalating keeps the Task scheduled instead of losing its date.
11. As the app's user, I want a Task's Quadrant to update automatically as its due date approaches, so that important scheduled work surfaces into Do without manual re-triage.
12. As the app's user, I want the Quadrants named Do / Schedule / Quick-hit / Reconsider, so that the grid speaks to a one-person system with nobody to delegate to.
13. As the app's user, I want importance to persist across sessions and devices, so that my triage work isn't lost.
14. As the app's user, I want Task cards on the Matrix to show their familiar area colors and due-date tags, so that the view reads like the rest of the app.
15. As the app's user, I want to open a Task's details from the Matrix just like on the Board, so that I can edit without switching views.
16. As the app's user, I want completing or trashing a Task to remove it from the Matrix immediately, so that the grid only ever shows live work.
17. As the app's user, I want the Matrix reachable from the Board tab, so that time-based and importance-based views of the same Tasks sit side by side.
18. As the app's user, I want the Matrix usable on mobile, so that I can re-triage from my phone.
19. As the app's user, I want a calm empty state per Quadrant and for the Unsorted tray, so that an empty Matrix reads as done, not broken.

## Implementation Decisions

- **New pure domain module for Matrix rules** (sibling to the existing task-rules and recurrence modules). It owns: the urgency derivation (due within 2 days or overdue, with the clock passed in as `now`), Quadrant assignment, Unsorted membership (importance unset), Matrix scoping (statuses `this-week` and `this-month` only), and the drop function that maps "Task dropped on Quadrant X" to the resulting field changes (importance write, plus due-date write when crossing the urgency boundary per ADR-0001).
- **Task gains one nullable field: `importance`** (binary: important / not-important; null = Unsorted). No `urgency` field is ever stored — ADR-0001. The old `priority` field is already gone from the refactored Task type, so no migration is needed; existing Tasks simply start Unsorted.
- **Server change is minimal**: add `importance` to the tasks family's writable-field whitelist and construct defaults (null). The generic resource layer persists it with no further changes.
- **UI: the Matrix is a view mode of the Board tab** (segmented toggle: Columns ↔ Matrix), since it shows the same dataset under a different lens. It reuses the existing dnd-kit drag infrastructure and Task card component; Quadrants are drop targets exactly as Board columns are today.
- **Drop semantics** (from the domain module, encoding ADR-0001): dropping on Do or Quick-hit when the Task is not currently urgent sets `dueDate` to today+2; dropping on Schedule or Reconsider when the Task is currently urgent sets `dueDate` to today+7; every drop sets `importance` to the target column's value. Drops within the same Quadrant are no-ops.
- **Recurring Items do not appear on the Matrix** — it maps Tasks only.

## Testing Decisions

- Tests assert external behavior only — given Tasks and a clock, which Quadrant, and given a drop, which field changes — never internal call structure.
- **Seam 1 — the Matrix domain module** carries the full behavioral surface: urgency boundary cases (due today, tomorrow, +2, +3, overdue, no date), all four Quadrant assignments, Unsorted membership, scoping (future/done/trashed excluded), and every drop transition including due-date writes and no-op drops. Prior art: the existing task-rules and recurrence test suites (pure functions, injected `now`, `bun test`).
- **Seam 2 — the tasks family config**: `importance` is writable via PUT, defaults to null on construct, and survives round-trips. Prior art: the existing families test suite.
- No component or drag-simulation tests; the tab remains a thin, untested consumer of the domain module, consistent with the rest of the codebase.

## Out of Scope

- Future-status Tasks on the Matrix (they stay in their parking lot).
- Continuous positioning or a 3×3 grid — Quadrant membership is binary per axis, position within a Quadrant is meaningless.
- A manual urgency override (rejected in ADR-0001).
- Delegation features of the classic Eisenhower method.
- Matrix views for Shopping, Grocery, or Recurring Items.
- Component/E2E test infrastructure.
- Any migration of the retired `priority` field (already removed).

## Further Notes

- Quadrant vocabulary and drag semantics are recorded in the domain glossary (CONTEXT.md, "The Matrix" section) and ADR-0001 in the app repo — keep code names aligned with them (`Do`, `Schedule`, `Quick-hit`, `Reconsider`, `Unsorted`).
- The 2-day urgent cutoff deliberately matches the existing "red zone" due-date color, so the Matrix and due tags never disagree.
- Per standing instructions, implementation should update the product spec (todo-architecture.md) and README, and ship as its own commit.

