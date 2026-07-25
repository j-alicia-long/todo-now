# 03 — Matrix view mode on the Board tab (read-only)

**Parent:** [Eisenhower Matrix view for Board tasks](https://github.com/j-alicia-long/todo-now/issues/1)

**What to build:** From the Board tab, the user flips a segmented toggle (Columns ↔ Matrix) and sees her This Week and This Month Tasks laid out on an Eisenhower 2×2 grid — Do, Schedule, Quick-hit, Reconsider — with an Unsorted tray beside it for Tasks she hasn't judged yet. Placement comes entirely from the domain module. Task cards look like they do everywhere else (area colors, due-date tags), and clicking one opens the same details editor as on the Board. Completing or trashing a Task removes it from the grid immediately. Each empty Quadrant and an empty tray show a calm empty state. The whole view works on mobile.

No dragging yet — this slice is the readable Matrix.

**Blocked by:** 02 — Matrix domain module.

**Status:** ready-for-agent

- [ ] Segmented toggle on the Board tab switches Columns ↔ Matrix
- [ ] 2×2 grid renders Do / Schedule / Quick-hit / Reconsider plus the Unsorted tray, placement per the domain module
- [ ] Only This Week / This Month Tasks appear; Future, Done, trashed, and Recurring Items never do
- [ ] A Task's Quadrant reflects its current due date (urgency derived live, no stored urgency)
- [ ] Cards reuse the existing Task card: area colors and due-date tags render as elsewhere
- [ ] Clicking a card opens the Task's details, same as on the Board
- [ ] Completing or trashing a Task removes it from the Matrix immediately
- [ ] Calm empty state per Quadrant and for the Unsorted tray
- [ ] Usable on mobile
- [ ] The view is a thin, untested consumer of the domain module (no component tests, per testing decisions)
