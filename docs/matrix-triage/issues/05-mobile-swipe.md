# 05 — Mobile swipe sorting

**Parent:** [Matrix Triage — sort Unsorted Tasks one at a time](../spec.md)

**What to build:** On touch devices, the active Triage card sorts with a directional swipe toward a Quadrant's corner: up-left → Do, up-right → Schedule, down-left → Quick-hit, down-right → Reconsider — matching the grid positions visible beneath the overlay. The card follows the finger with a tilt so the gesture feels physical; releasing past the threshold commits the sort (same field changes as a drag), releasing short of it springs the card back. The instruction line uses swipe wording on touch devices and drag/keyboard wording on desktop. Small or ambiguous swipes never mis-sort. Taps on the card's interactive elements still work.

**Blocked by:** 02 — Triage modal with keyboard sorting.

**Status:** done

- [x] Four corner swipes map to the four Quadrants per the grid's visual layout
- [x] Card tracks the finger during the swipe; below-threshold releases spring back with no field changes
- [x] Committed swipe applies the existing Matrix drop field changes (per ADR-0001)
- [x] Instruction line says swipe on touch devices, drag/keys on desktop
- [x] Next Task becomes active after a swipe; last swipe closes Triage
- [x] `bun run typecheck` and `bun run lint` pass
