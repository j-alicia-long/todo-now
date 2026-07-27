# Matrix Triage — sort Unsorted Tasks one at a time

> Spec for the Triage modal replacing the Unsorted tray. Follows the Eisenhower Matrix feature (docs/eisenhower-matrix/spec.md).

## Problem Statement

Sorting Tasks into Quadrants on the Matrix is fiddly and slow. Every Unsorted Task sits in a cramped side tray, and Jennifer must drag each small card across the screen into a Quadrant — repetitive pointer work that's especially awkward on mobile. The tray also permanently eats a column of horizontal space from the Matrix grid, even when everything is already sorted. And because the tray shows only compact cards, she's judging importance without seeing the Task's details.

## Solution

Replace the Unsorted tray with **Triage**: a focused, one-Task-at-a-time sorting flow. Switching to the Matrix view with Unsorted Tasks present automatically opens a modal over a dimmed Matrix — the four Quadrants stay visible below as live drop targets. The modal shows the active Task with full details, with the remaining Unsorted Tasks stacked visually behind it and an instruction line on top. Jennifer sorts the active Task by dragging it into a Quadrant (desktop), swiping toward a Quadrant's corner (mobile), or pressing 1–4 (desktop). Skipping sends the Task to the back of the stack. Sorting applies the exact same field changes as dragging on the grid today (importance write, plus derived-urgency due-date writes per ADR-0001). When the stack empties, Triage closes and the full-width Matrix is revealed. Dismissing early leaves the rest Unsorted; a small "Sort N tasks" pill on the Matrix reopens Triage.

The Unsorted tray is removed entirely; the Matrix grid takes the full width.

## User Stories

1. As the app's user, I want the Matrix to automatically open Triage when I switch to it with Unsorted Tasks, so that sorting happens up front instead of being something I have to remember.
2. As the app's user, I want Triage to reopen every time I return to the Matrix while Unsorted Tasks remain, so that unsorted work can't silently accumulate.
3. As the app's user, I want the Matrix to skip Triage entirely when nothing is Unsorted, so that the modal never interrupts me pointlessly.
4. As the app's user, I want the active Task shown with all its details (title, area, effort, decision load, due date, notes/links), so that I can judge importance with full context instead of from a compact card.
5. As the app's user, I want the remaining Unsorted Tasks shown as a visual stack behind the active one with a count, so that I can see how much triage is left.
6. As the app's user, I want a short instruction line at the top of the modal, so that the sorting gesture is obvious without a tutorial.
7. As the app's user, I want the Matrix quadrants visible below a dimmed overlay while Triage is open, so that I can see where each Task will land and watch the grid fill up.
8. As the app's user, I want to drag the active card from the modal into any of the four Quadrants on desktop, so that sorting feels direct and spatial.
9. As the app's user, I want to swipe the active card toward a Quadrant's corner on mobile, so that I can triage quickly with one thumb.
10. As the app's user, I want desktop keyboard shortcuts 1 (Do), 2 (Schedule), 3 (Quick-hit), 4 (Reconsider), so that I can triage a big stack without touching the mouse.
11. As the app's user, I want the number keys to match the Quadrants' on-screen grid order, so that the mapping is guessable without reading docs.
12. As the app's user, I want a Skip action that sends the current Task to the back of the stack, so that one hard call doesn't block the rest of my triage.
13. As the app's user, I want a keyboard shortcut for Skip on desktop, so that skipping is as fast as sorting.
14. As the app's user, I want sorting a Task into an urgent Quadrant (Do, Quick-hit) to set its due date 2 days out when it isn't already urgent, so that Triage placement agrees with the grid's derived-urgency rules (ADR-0001).
15. As the app's user, I want sorting into a non-urgent Quadrant (Schedule, Reconsider) to push an urgent due date 7 days out, so that a "not now" judgment actually de-escalates the Task.
16. As the app's user, I want each sorted Task to appear in its Quadrant immediately, so that I get feedback that the judgment stuck.
17. As the app's user, I want Triage to close by itself when the last Task is sorted, so that I land on my finished, full-width Matrix.
18. As the app's user, I want to dismiss Triage early (Escape, close button, or tapping the dimmed backdrop), so that I'm never trapped in a modal.
19. As the app's user, I want dismissing Triage to leave remaining Tasks Unsorted rather than auto-assigning them, so that no importance judgment is ever made without me.
20. As the app's user, I want a small "Sort N tasks" pill on the Matrix whenever Unsorted Tasks exist and Triage is closed, so that the remaining work stays visible and one tap away.
21. As the app's user, I want the Unsorted side tray gone, so that the Matrix grid uses the full width of the screen.
22. As the app's user, I want Tasks that become Unsorted while Triage is already open (e.g. created in another tab or on another device) to join the stack, so that the stack reflects reality.
23. As the app's user, I want Triage to work on mobile screen sizes with the same information, so that I can triage from my phone.
24. As the app's user, I want the keyboard shortcuts inert while I'm typing in an input, so that typing "1" in a field never sorts a Task.

## Implementation Decisions

- **No schema or server changes.** Triage reads and writes the existing `importance` and `dueDate` fields through the existing task update action. Urgency remains derived, never stored (ADR-0001).
- **Sorting reuses the existing drop function.** A Triage sort into a Quadrant produces exactly the field changes the Matrix drop function already defines (importance write; due-date write only when crossing the urgency boundary). No parallel rule set.
- **Stack order is pure domain logic.** The Triage stack derives from the existing Matrix partition's Unsorted list. Skip rotation (send-to-back) is expressed as a pure helper in the domain layer, keyed by Task id order, so the UI holds only the rotation state, not a copied task list. New Unsorted arrivals append to the stack.
- **Triage is a new component; the Board tab owns its open/closed state.** The modal renders inside the Board tab's existing DndContext so the active card is a normal draggable and the Quadrants remain the existing droppables — one drag system, no new drop targets.
- **Auto-open rule:** entering the Matrix view (toggle press) with a non-empty Unsorted list opens Triage. Dismissal is per-visit, not persisted: leaving and re-entering the Matrix re-opens it.
- **Keyboard mapping** follows the grid's visual order: 1 = Do (top-left), 2 = Schedule (top-right), 3 = Quick-hit (bottom-left), 4 = Reconsider (bottom-right); S skips; Escape dismisses. Shortcuts are ignored when focus is in a text input.
- **Mobile gesture:** a directional swipe on the active card maps to the Quadrant in that corner (up-left → Do, up-right → Schedule, down-left → Quick-hit, down-right → Reconsider). The instruction line adapts to the input mode (drag vs. swipe wording).
- **The Unsorted tray is removed** from the Matrix view; the grid becomes full-width. The "Sort N tasks" pill is the only Unsorted surface on the Matrix and opens Triage.
- **Glossary updated** (already done in CONTEXT.md): _Triage_ added; _Unsorted_ redefined as a Task state rather than a tray.

## Testing Decisions

- Tests assert **external behavior only**: given Tasks and a clock, what is the Triage stack; given a skip, what is the new order; given a sort to a Quadrant, what field changes result. No assertions on component internals or DOM structure.
- **One seam:** the pure domain layer, run under `bun test`. Prior art: the existing Matrix rules tests (urgency boundaries, quadrant assignment, drop transitions).
- Sort field-change behavior is already covered by the existing drop-function tests; Triage tests cover only what's new — stack derivation (scoping, ordering) and skip rotation, including edge cases: empty stack, single Task, skip past the end wrapping to front, Tasks leaving the stack after being sorted elsewhere.
- UI (modal, gestures, keyboard, pill) is verified manually, consistent with the codebase's convention of not unit-testing components.

## Out of Scope

- No changes to the columns Board view or its drag behavior.
- No Triage entry point outside the Matrix (e.g. from the Future tab or on app launch).
- No undo/redo for a Triage judgment — corrections are made by dragging the card between Quadrants on the grid, as today.
- No reordering of Tasks within a Quadrant.
- No persistence of Triage progress or dismissal across sessions or devices.
- No changes to Recurring Items — they never appear on the Matrix or in Triage.

## Further Notes

- The prior feature's spec and tickets live in docs/eisenhower-matrix/ and establish the slice-by-slice delivery pattern this feature should follow.
- The "Sort N tasks" pill doubles as the empty-tray replacement: when no Tasks are Unsorted, it simply isn't rendered — nothing occupies the old tray's space.
- Sorting into Do/Quick-hit writing a due date may surprise a first-time user; the modal's Quadrant targets should carry their existing subtitle labels ("Urgent & important", etc.) so the semantics stay visible during Triage.
