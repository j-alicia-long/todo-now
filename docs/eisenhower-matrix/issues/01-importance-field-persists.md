# 01 — `importance` field persists end-to-end

**Parent:** [Eisenhower Matrix view for Board tasks](https://github.com/j-alicia-long/todo-now/issues/1)

**What to build:** A Task can carry an explicit binary importance judgment — important / not-important — or none at all (null, meaning the user hasn't judged it yet). Setting it via the API sticks: it survives a save, a reload, and a round-trip across devices. Existing Tasks are untouched and simply start with no importance. No `urgency` field exists anywhere — urgency is always derived from the due date (ADR-0001).

**Blocked by:** None — can start immediately.

**Status:** done

- [x] Task type has a nullable binary `importance` field (important / not-important / null)
- [x] `importance` is accepted through the tasks family's PUT writable-field whitelist
- [x] Newly constructed Tasks default `importance` to null
- [x] `importance` survives a persistence round-trip (write → read back unchanged)
- [x] Families test suite covers the above (Seam 2), passing under `bun test`
- [x] No `urgency` field is stored anywhere
