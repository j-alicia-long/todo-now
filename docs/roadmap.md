# Roadmap

Planned and deferred work. Shipped work is logged in `../devlog.md`.

## Planned

- **Weekly momentum view** — encouraging progress tracking
- **Service worker + offline support** — app currently requires internet
- **STR feedback loop** — speak text, submit directly to agent

## Deferred architecture candidates

From the Jul 2026 architecture reviews (candidates #1, Task lifecycle rules, and the client data seam already shipped — see devlog 2026-07-24):

1. Pull Week & recurrence rules into a pure `week.ts` module _(worth exploring)_
2. Narrow Board card interfaces via store handles — unblocked now that per-family store hooks exist _(speculative)_

## Cut / deprioritized (Jul 16, 2026)

Scoped out to focus on demo-ready polish:

- **Connect section** (safe people to reach out to)
- **Take Care section** (safe foods, grounding activities)
- **Small Wins** — standalone section cut; the feature itself was fully removed on Jul 23 ([`c338076`](https://github.com/j-alicia-long/todo-now/commit/c338076))
