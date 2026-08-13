# Roadmap

Planned and deferred work. Shipped work is logged in `devlog.md`.

## Planned

- **Cloudflare Workers migration** — Zo free tier retired; rehost on Workers + D1 + R2 behind Cloudflare Access. Plan: `cloudflare-migration/spec.md`, decision: `adr/0002-cloudflare-workers-blob-per-family-d1.md`. Phase 0 (data export) done Aug 13 — Zo compute is already cut off ("trial_ended"); data was rescued via the live API. **The published site is now the only remaining channel — don't dawdle on cutover.**
- **Weekly momentum view** — encouraging progress tracking
- **Service worker + offline support** — app currently requires internet
- **STR feedback loop** — speak text, submit directly to agent or issues to Github. (Partially addressed 2026-08-09: the Reporter ships visual element-highlight reports; 2026-08-11: each report now also files as a sanitized GitHub issue. Speech input and direct agent submission remain.)

Bugs

- Redirect incorrect URLs to home at /todo
-

## Deferred architecture candidates

From the Jul 2026 architecture reviews — all four candidates (Task lifecycle rules, the client data seam, the Week & recurrence module, and component extraction with narrow card interfaces) have shipped; see devlog. Nothing currently deferred.

## Cut / deprioritized (Jul 16, 2026)

Scoped out to focus on demo-ready polish:

- **Connect section** (safe people to reach out to)
- **Take Care section** (safe foods, grounding activities)
- **Small Wins** — standalone section cut; the feature itself was fully removed on Jul 23 ([`c338076`](https://github.com/j-alicia-long/todo-now/commit/c338076))
