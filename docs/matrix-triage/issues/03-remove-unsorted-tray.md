# 03 — Remove the Unsorted tray

**Parent:** [Matrix Triage — sort Unsorted Tasks one at a time](../spec.md)

**What to build:** The Unsorted tray beside the Matrix grid is gone. The 2×2 grid takes the full width of the view on desktop and mobile, and the "Sort N tasks" pill (from ticket 02) is the only Unsorted surface on the Matrix. Nothing occupies the tray's old space when everything is sorted — the grid simply breathes. Dead tray styles are removed rather than orphaned.

**Blocked by:** 02 — Triage modal with keyboard sorting (Triage must exist before the only other sorting surface is removed).

**Status:** done

- [x] No Unsorted tray renders in the Matrix view in any state
- [x] Matrix grid spans the full available width on desktop and mobile
- [x] Unsorted Tasks remain reachable solely via the "Sort N tasks" pill / Triage
- [x] Orphaned tray styles removed
- [x] `bun run typecheck` and `bun run lint` pass
