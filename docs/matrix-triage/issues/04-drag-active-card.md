# 04 — Drag the active card into a Quadrant

**Parent:** [Matrix Triage — sort Unsorted Tasks one at a time](../spec.md)

**What to build:** On desktop, the active Triage card can be picked up and dragged out of the modal into any of the four Quadrants visible beneath the dimmed backdrop. The card is a normal draggable inside the Board tab's existing drag system; the Quadrants are the existing drop targets, and a drop applies the same field changes as any Matrix drag. While dragging, the hovered Quadrant highlights as it does today. After the drop, the next Task in the stack becomes active; dropping the last one closes Triage. A drop outside any Quadrant returns the card to the modal unchanged.

**Blocked by:** 02 — Triage modal with keyboard sorting.

**Status:** ready-for-agent

- [ ] Active card is draggable from the modal; Quadrants beneath the overlay accept the drop
- [ ] Drop applies the existing Matrix drop field changes (importance, boundary due-date writes per ADR-0001)
- [ ] Hovered Quadrant highlights during the drag, as on the grid today
- [ ] Drop outside a Quadrant is a no-op; the card returns to the modal
- [ ] Next Task becomes active after a drop; last drop closes Triage
- [ ] `bun run typecheck` and `bun run lint` pass
