# 02 — Matrix domain module (pure rules)

**Parent:** [Eisenhower Matrix view for Board tasks](https://github.com/j-alicia-long/todo-now/issues/1)

**What to build:** A pure domain module — sibling to the existing task-rules and recurrence modules — that answers every Matrix question without touching UI or server: which Tasks belong on the Matrix, which Quadrant each one sits in, which wait in Unsorted, and what field changes result when a Task is dropped on a Quadrant. Given the same Tasks and the same clock, the answers are always the same.

Rules it owns (vocabulary per the domain glossary and ADR-0001):

- **Scoping:** only Tasks with status `this-week` or `this-month`; Future, Done, and trashed Tasks are excluded. Recurring Items never appear.
- **Urgency (derived, never stored):** urgent iff due within 2 days or overdue, with the clock passed in as `now`; no due date = not urgent.
- **Quadrants:** Do (urgent + important), Schedule (important only), Quick-hit (urgent only), Reconsider (neither). Exactly one per Task.
- **Unsorted:** importance is null.
- **Drop function:** every drop sets `importance` to the target's value; dropping on Do or Quick-hit when not currently urgent sets `dueDate` to today+2; dropping on Schedule or Reconsider when currently urgent sets `dueDate` to today+7; same-Quadrant drops are no-ops.

**Blocked by:** 01 — `importance` field persists end-to-end.

**Status:** ready-for-agent

- [ ] Urgency boundary cases covered: due today, tomorrow, +2, +3, overdue, no date
- [ ] All four Quadrant assignments and Unsorted membership covered
- [ ] Scoping covered: future, done, and trashed Tasks excluded
- [ ] Every drop transition covered, including due-date writes and no-op same-Quadrant drops
- [ ] Tests assert external behavior only (given Tasks + clock → Quadrant; given drop → field changes), passing under `bun test`
- [ ] Code names match the glossary: Do, Schedule, Quick-hit, Reconsider, Unsorted
