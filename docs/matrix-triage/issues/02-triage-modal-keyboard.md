# 02 — Triage modal with keyboard sorting

**Parent:** [Matrix Triage — sort Unsorted Tasks one at a time](../spec.md)

**What to build:** Switching to the Matrix view with Unsorted Tasks present automatically opens Triage: a modal over a dimmed backdrop, with the Matrix grid still visible beneath. The modal shows the active Task with full details (title, area, effort, decision load, due date, link/notes), the remaining Unsorted Tasks as a visual stack behind it with a count, and an instruction line on top. On desktop, pressing 1 / 2 / 3 / 4 sorts the active Task into Do / Schedule / Quick-hit / Reconsider (grid order), applying the same field changes as a Matrix drag; S skips (back of the stack); Escape, a close button, or tapping the backdrop dismisses. Sorted Tasks appear in their Quadrant immediately; when the last Task is sorted, Triage closes by itself. Dismissing early leaves the rest Unsorted, and a small "Sort N tasks" pill on the Matrix reopens Triage; the pill is hidden while nothing is Unsorted. Leaving the Matrix and returning re-opens Triage. Shortcuts are inert while focus is in a text input. On-screen buttons for the four Quadrants and Skip make the modal usable on touch devices before the swipe gesture ships.

**Blocked by:** 01 — Triage domain rules.

**Status:** ready-for-agent

- [ ] Entering the Matrix view with Unsorted Tasks auto-opens Triage; with none, it never opens
- [ ] Active card shows full Task details; remaining stack is visible behind it with a count
- [ ] Instruction line renders at the top of the modal
- [ ] Matrix quadrants visible below the dimmed backdrop; each sort lands the Task in its Quadrant immediately
- [ ] Keys 1–4 sort into Do / Schedule / Quick-hit / Reconsider with the same field changes as a grid drag (including due-date writes per ADR-0001)
- [ ] S sends the active Task to the back of the stack; sorting past the last Task closes Triage
- [ ] Escape, close button, and backdrop tap dismiss; remaining Tasks stay Unsorted
- [ ] "Sort N tasks" pill shows on the Matrix whenever Unsorted Tasks exist and Triage is closed; tapping reopens Triage
- [ ] Shortcuts ignored while typing in an input
- [ ] `bun run typecheck` and `bun run lint` pass
