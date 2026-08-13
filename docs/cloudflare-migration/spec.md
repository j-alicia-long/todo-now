# Migration plan: Zo → Cloudflare Workers

Zo's free tier is gone; the app moves to Cloudflare Workers. Decision record:
`../adr/0002-cloudflare-workers-blob-per-family-d1.md`. Target shape: the same
Hono app running as a Worker — static `dist/` served by the Workers assets
binding, Family data in D1 (blob-per-Family), raw Reports in R2, GitHub issue
filing via `fetch`, everything behind Cloudflare Access.

What deliberately does **not** change: `server.ts` route structure, the
`ListStore` / `ReportWriter` / `IssueCreator` seams, all domain rules,
normalize-on-read (it runs per-request, so no cron is needed), the Vite + React
frontend, and `bun test src`.

## Phase 0 — Safeguard the data ✅ (done Aug 13, 2026)

Live data existed **only** on Zo at `/home/workspace/todo-data/` and was not in
git or the Mutagen sync.

**How it actually went:** Zo compute access was already cut ("trial_ended" —
the MCP bash channel is dead), but the published site still served, so the
data was rescued through the app's own API (`GET /api/tasks` etc.). All five
Families exported, JSON-validated, and checksummed to
`../../../backups/zo-export-2026-08-13/` (outside git): 120 tasks, 22 shopping,
5 groceries, 14 recurring, settings. `archive.md` was confirmed to have never
existed (archiving never ran — done tasks from the app's first week are still
in tasks.json; nothing lost). Raw Reports were already on the Mac via the
synced `reports/` folder.

**Cutover note:** the MCP channel being dead means the Phase 5 "final
re-export" also goes through the live API — re-run the same curl loop just
before import, while the published site still responds.

## Phase 1 — Runtime port (branch `feature/cloudflare-workers`)

- **Wrangler config** (`wrangler.jsonc`): Worker entry, D1 binding, R2 binding,
  assets binding for `dist/` with SPA fallback, `GITHUB_TOKEN` as a secret.
  Local dev via `@cloudflare/vite-plugin` (runs the Worker inside `vite dev`,
  replacing the Vite-middleware-mode block in `server.ts`).
- **Entry point**: export the Hono app's `fetch`. Remove `hono/bun`
  `serveStatic`; assets binding serves the built frontend. Workers has no
  `process.env` — adapters receive config via `c.env` bindings.
- **`files.ts` → `d1.ts`**: extract the pure normalize/migrate logic (it's
  storage-agnostic) so both adapters share it; the D1 adapter is then just
  `SELECT json FROM families WHERE name = ?` / `INSERT OR REPLACE`. Settings is
  one more row in the same table.
- **`github.ts`**: replace `Bun.spawn(["gh", ...])` with a `fetch` to
  `POST /repos/{repo}/issues`, token from the Workers secret. Null repo stays a
  no-op creator.
- **`reportsWriter` → R2 adapter**: `put`/`head` against the bucket, keeping
  the same-minute de-collision suffix logic.
- **Tests**: domain and route tests stay on `bun test src` (seams take
  in-memory fakes). Adapter smoke-testing happens against `wrangler dev`.

## Phase 2 — Data import

One-off script: read the Phase 0 export, write each Family as one row via
`wrangler d1 execute`. Verify counts through the deployed API before cutover.

## Phase 3 — Access, base path, PWA

- Cloudflare Access application on the `workers.dev` hostname; allow
  `j.alicia.long@gmail.com`; long session duration (~1 month) so login is a
  rare event.
- Keep the `/todo` base path (avoids frontend churn); add the root→`/todo`
  redirect already on the roadmap.
- **Explicitly test the PWA behind Access**: install to home screen, service
  worker, and the offline queue must survive an expired Access session (the SW
  fetch will get a login redirect instead of JSON — verify the offline
  transport treats that as "offline", not data).

## Phase 4 — Deploy pipeline

- New GitHub Action: `wrangler-action` deploy on push to main, keeping the
  existing `paths-ignore` list. Repo secret: `CLOUDFLARE_API_TOKEN`.
- Retire `deploy-zo.yml`, `redeploy.sh`, `scripts/deploy-zo.sh`, the `ZO_TOKEN`
  secret, and `zosite.json`.

## Phase 5 — Cutover & decommission

1. Final re-export + import (catch writes since Phase 2), then switch usage to
   the new URL and re-install the PWA on the phone.
2. Run both for a few days; then unpublish the Zo site.
3. **Docs sync** (the ship commit): rewrite `DEPLOY.md`, update live URLs in
   `AGENTS.md` and `README.md`, update the tech spec's storage/hosting
   sections to past tense, devlog entry, retire `handoff-deploy-sync.md`.

## Reports triage after the move

The Mac-side triage flow pulls raw Reports with `wrangler r2 object get`
instead of reading the synced folder (update `reports/AGENTS.md` and the 6 AM
triage prompt at cutover). **Dead-man's switch**: the R2 dashboard shows
per-bucket read counts — if the bucket shows no reads for a few months, drop
the raw-copy leg entirely and rely on sanitized issues alone.

## Open questions

- Custom domain later? (~$10/yr via Cloudflare Registrar, one-click attach —
  cosmetic only, `todo-jlong.workers.dev` is free.)
- Backfill ADR for offline-mode's optimistic-creates decision (history.md
  cites "ADR 0002" but the file was never written; that number is now taken).
