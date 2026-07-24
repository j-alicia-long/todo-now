# Todo App (Unstuck Dashboard)

Jennifer's personal task, shopping, and grocery manager. One person, one dataset — designed for calm, low-friction task management rather than productivity maximalism.

## Language

### Tasks & the Board

**Task**:
A single actionable item on the Board, with a status, importance, effort, decision load, and area.
_Avoid_: Todo, item, card (card is the visual widget, not the concept)

**Board**:
The main three-column view of Tasks: This Week, This Month, and Done.
_Avoid_: Dashboard, kanban

**Status**:
Where a Task lives in its lifecycle — one of `this-week`, `this-month`, `future`, `done`, `trashed`.
_Avoid_: Column, stage

**Future**:
A parking lot for Tasks not yet scheduled. Lives in its own tab, off the Board.
_Avoid_: Backlog, someday, icebox

**Area**:
The life category a Task belongs to: Life Admin, Social, Health, Learning, Career, or Project.
_Avoid_: Tag, label, category

**Effort**:
How much work a Task takes: low, medium, or high.

**Decision Load**:
How much thinking and deciding a Task demands, independent of effort: low, medium, or high.
_Avoid_: Complexity, difficulty

### The Matrix

**Matrix**:
The Eisenhower view: a 2×2 grid mapping Board Tasks (This Week and This Month only) by importance and urgency. Future, Done, and Trashed tasks never appear on it.
_Avoid_: Eisenhower box, priority grid

**Importance**:
Whether a Task matters to Jennifer's goals — a binary judgment (important / not important), set explicitly. Replaces the old high/medium/low priority.
_Avoid_: Priority (retired term)

**Urgency**:
Whether a Task needs attention now — derived, never stored: urgent means due within 2 days or overdue. A Task with no due date is not urgent.
_Avoid_: Time pressure

**Quadrant**:
One of the four cells of the Matrix: Do (urgent + important), Schedule (important only), Quick-hit (urgent only), Reconsider (neither).
_Avoid_: Delegate, Eliminate (classic Eisenhower names; this is a one-person system)

**Unsorted**:
A tray beside the Matrix holding Board Tasks whose importance hasn't been set yet. Dragging one into a Quadrant sorts it.
_Avoid_: Inbox, unplaced

### Deletion & history

**Trash**:
Where soft-deleted Tasks go (`trashed` status). Restorable; purged automatically after 30 days.
_Avoid_: Recycle bin, deleted items

**Archive**:
The permanent Markdown log of Done tasks and bought Shopping Items older than four weeks. Archiving removes them from live data.
_Avoid_: History, log. Do not confuse with Future (unscheduled) or Trash (deleted).

### Lists

**Shopping Item**:
A lightweight thing to buy, categorized as a want or a need, optionally with links. Can be archived.

**Grocery Item**:
The lightest-weight item type — just a title and a bought/unbought checkbox. Never archived, only cleared.

**Recurring Item**:
A repeating obligation or reference that surfaces in This Week. Weekly items reset every Monday; long-term items repeat on a custom interval.
_Avoid_: Habit, routine

**Reference**:
A Recurring Item that carries information (a link, a note) rather than something to complete.

### Time

**Week**:
Always Monday through Sunday. Weekly Recurring Items reset at the start of Monday.
