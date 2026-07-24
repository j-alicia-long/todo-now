# Urgency is derived from due date; Matrix drags write due dates

The Eisenhower Matrix needs an urgency axis, but storing an explicit `urgency` field would let it drift out of sync with `dueDate` (the app's existing source of time pressure, already color-coded in the UI). We decided urgency is never stored: a Task is urgent iff its due date is within 2 days or overdue (no due date = not urgent), matching the existing "red zone". Consequently, dragging a Task vertically across the urgency axis writes its due date — into an urgent Quadrant sets `dueDate` to today+2; out of one pushes it to today+7. Importance remains an explicit binary field (replacing the retired high/medium/low `priority`), since no existing data can derive it.

## Considered Options

- Two explicit fields (urgency + importance) set by dragging — rejected: urgency would contradict due dates.
- Manual urgency override flag beating the due-date rule — rejected: two competing sources of truth.
- Disallowing vertical drags — rejected: makes the Matrix feel broken as a direct-manipulation surface.
