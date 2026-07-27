# 01 — Triage domain rules (stack + skip rotation)

**Parent:** [Matrix Triage — sort Unsorted Tasks one at a time](../spec.md)

**What to build:** The pure rules that answer every Triage question without touching UI: given the Board's Tasks and a clock, which Tasks form the Triage stack and in what order; which Task is active; and what order results from a Skip (active Task goes to the back). The stack is exactly the Matrix partition's Unsorted list — only This Week / This Month Tasks whose importance is null. Rotation state is expressed so the UI never copies the task list: given the same Tasks and the same rotation, the stack order is always the same. Tasks that stop being Unsorted (sorted, completed, trashed) drop out of the stack without disturbing the rest of the order; newly Unsorted Tasks join at the back.

Sorting itself needs no new rules — a Triage sort produces the exact field changes the existing Matrix drop function already defines (importance write, plus due-date writes when crossing the urgency boundary per ADR-0001).

**Blocked by:** None — can start immediately.

**Status:** done

- [x] Stack derivation covered: only Unsorted Board Tasks appear; Future, Done, trashed, and sorted Tasks never do
- [x] Skip rotation covered: active Task moves to the back; repeated skips cycle through the whole stack and wrap
- [x] Robustness covered: empty stack, single-Task stack, Tasks leaving mid-rotation, new Unsorted Tasks appending
- [x] Tests assert external behavior only (Tasks + clock + rotation in → ordered stack out), passing under `bun test`
- [x] Code names match the glossary: Triage, Unsorted, Quadrant
