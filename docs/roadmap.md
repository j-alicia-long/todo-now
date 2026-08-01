# Roadmap

Planned and deferred work. Shipped work is logged in `../devlog.md`.

## Planned

- **Filterable card recommendations** — evolve the static `/cards` cheat-sheet into a computed view: a flat Earn Rate list (Card × Spend Category + Strings) in its own data module, a persisted Wallet filter in Settings, and an Abroad toggle. Recommendation engine: best nominal rate per category among on-hand cards; ties break by fewest Strings (runner-up shown as tied-with-caveat); USBAR mobile-wallet 3% competes everywhere as a Wildcard but is suppressed where a clean equal-or-better card is on hand; Abroad excludes FTF cards entirely; transferable-points cards get a badge, not a rate bump. New categories: Drugstores (Duane Reade, CVS, Walgreens, Rite Aid), Amazon/Walmart/Target (grocery-exclusion trap). "Everything else" is one row showing both the tap pick and the no-tap fallback. Domain model settled (see `CONTEXT.md` Cards terms); not yet built
- **Eisenhower Matrix view** — 2×2 grid mapping Board Tasks by importance × derived urgency, with an Unsorted tray. Domain model settled (see `CONTEXT.md` Matrix terms and `docs/adr/0001-derived-urgency-on-the-matrix.md`); not yet built
- **Weekly momentum view** — encouraging progress tracking
- **Service worker + offline support** — app currently requires internet
- **STR feedback loop** — speak text, submit directly to agent

## Deferred architecture candidates

From the Jul 2026 architecture reviews — all four candidates (Task lifecycle rules, the client data seam, the Week & recurrence module, and component extraction with narrow card interfaces) have shipped; see devlog. Nothing currently deferred.

## Cut / deprioritized (Jul 16, 2026)

Scoped out to focus on demo-ready polish:

- **Connect section** (safe people to reach out to)
- **Take Care section** (safe foods, grounding activities)
- **Small Wins** — standalone section cut; the feature itself was fully removed on Jul 23 ([`c338076`](https://github.com/j-alicia-long/todo-now/commit/c338076))
