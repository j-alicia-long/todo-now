# 04 — Drag-to-triage on the Matrix

**Parent:** [Eisenhower Matrix view for Board tasks](https://github.com/j-alicia-long/todo-now/issues/1)

**What to build:** The Matrix becomes a direct-manipulation surface. The user drags a Task from the Unsorted tray into a Quadrant to sort it, or between Quadrants to change her mind. Every drop applies exactly the field changes the domain module's drop function dictates: importance is set to the target Quadrant's value, and crossing the urgency boundary writes the due date — into an urgent Quadrant sets it 2 days out, out of an urgent Quadrant pushes it 7 days out (ADR-0001). The card then lands in the Quadrant the rules say it belongs in, dropping within the same Quadrant changes nothing, and the triage persists across reload. Reuses the existing dnd-kit drag infrastructure; Quadrants are drop targets exactly as Board columns are today.

**Blocked by:** 03 — Matrix view mode on the Board tab.

**Status:** done

- [x] Dragging a Task from Unsorted into any Quadrant sorts it in a single gesture
- [x] Dragging horizontally between Quadrants flips importance instantly
- [x] Dropping into Do or Quick-hit when the Task isn't urgent sets its due date to today+2
- [x] Dropping into Schedule or Reconsider when the Task is urgent pushes its due date to today+7
- [x] Same-Quadrant drops are no-ops (no writes)
- [x] All drop outcomes come from the domain module's drop function — no duplicated rules in the UI
- [x] Triage persists across sessions/devices (importance and due-date writes round-trip)
- [ ] ~~Dragging works on mobile~~ Deferred: the app disables drag on touch devices (Board convention); mobile triage gesture to be decided separately
- [x] No drag-simulation tests (per testing decisions); behavior is covered by the domain module's tests
