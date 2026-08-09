# Handoff: Zo deploy pipeline — stale-build investigation (2026-08-09)

> **Resolved 2026-08-09 (later that night):** the structural fix landed — both
> clones moved out of the Mutagen-synced `personal-os` tree (Zo:
> `/home/workspace/repos/todo`, Mac: `~/Documents/repos/todo` + symlink at the
> old path). Git + GitHub is now the only channel between them; `--sync` mode
> was removed. See `docs/devlog.md` 2026-08-09 and `docs/DEPLOY.md`. Kept for
> historical context.

Compacted from a live debugging session so a fresh agent can pick this up.
Context docs: `docs/DEPLOY.md` (deploy how-to), `docs/devlog.md` 2026-08-09 entries,
`AGENTS.md` (repo rules). Domain glossary: `CONTEXT.md`.

## What happened (symptom)

User reported that commit `dd4f3d5` (Board move-mode toggle, Aug 6) "looked
reverted" — no Move pill or link paperclips on the live site
(todo-jlong.zocomputer.io/todo). Git history was intact; the live site was
simply running a pre-Aug-6 build while recent "Deploy to Zo" workflow runs
alternated between success and failure.

## Root cause

Two interacting systems:

1. **Bidirectional file sync (Mutagen)** between the Mac workspace
   (`~/Documents/personal-os/02-projects/todo-app/todo`) and Zo
   (`/home/workspace/personal-os/02-projects/todo-app/todo`). It syncs file
   contents both ways; each side has its own `.git`.
2. **Deploy** (GitHub Action `deploy-zo.yml` + `scripts/deploy-zo.sh`), which
   ran `git pull --ff-only` on Zo, then `./redeploy.sh` (builds the working
   tree).

Failure chain:

- The sync overwrote Zo's tracked source files with **older Mac copies**,
  appearing on Zo as uncommitted local modifications.
- `git pull --ff-only` only aborts when dirty files **overlap files the
  incoming merge touches**. The Aug 7 merges touched only the workflow file,
  so pull fast-forwarded `.git` while leaving the stale working-tree files in
  place. `redeploy.sh` then **built the stale files** and reported ✅ (its
  health check is HTTP 200 only — an old site still returns 200).
- Tonight's pushes (Reporter feature) failed loudly instead: the merge wanted
  to update the same files the sync had dirtied → "local changes would be
  overwritten."

Confirmed empirically: live JS bundle contained July markers (`Matrix`,
`triage`) but zero hits for `move-mode-btn` / `attach_file` / `swap_horiz` /
`reporter-fab`.

A second-order effect, proven during the session: after the fix below, the
deploy's `reset --hard` on Zo **synced back to the Mac** and erased an
uncommitted local edit (devlog heading, restored in `6a38f2c`). The sync
clobbers in both directions.

## Fix shipped (commit `c2a9f1d`)

Both the workflow and `scripts/deploy-zo.sh` now run, on Zo:

```
git fetch origin main && git reset --hard FETCH_HEAD && ./redeploy.sh
```

GitHub main is the source of truth. `reset --hard` only touches tracked
files — untracked/ignored files (`data/`, and prod data lives outside the
tree at `/home/workspace/todo-data`) are safe. Verified: the `c2a9f1d` deploy
succeeded and the live bundle now contains all missing feature markers.

## Standing risks / gotchas for future agents

- **Uncommitted edits to tracked files in this repo can be wiped** whenever a
  push triggers a deploy (Zo reset → sync back to Mac). Commit before/right
  after pushing; don't leave WIP uncommitted across a push.
- The workflow's success check is still HTTP-200 + a "✅ Live" grep — it does
  **not** verify *which commit* is live.
- `scripts/deploy-zo.sh --sync` (Mutagen mode) still exists and deploys the
  local working tree — same class of hazard by design; use knowingly.
- Stale local dev servers hold port 57460 and serve old routes; find with
  `lsof -ti :57460`, kill by PID (see README Development section).

## Suggested next steps (not started)

1. Make the deploy verify the shipped commit: embed the git SHA in the build
   (e.g. Vite define) and have the workflow curl it and compare to
   `github.sha`, instead of trusting HTTP 200.
2. Consider excluding this repo folder from the Mutagen sync (or making the
   sync one-way) so the two git clones stop sharing working trees.
3. Update `docs/DEPLOY.md` if either of the above changes the workflow.

## Suggested skills

- `github` — inspect workflow runs (`gh run list`, `gh run view --log-failed`).
- `webapp-testing` — Playwright verification of the live/dev UI (screenshots,
  feature probes).

## Verification recipes used (reusable)

- Which bundle is live: `curl -sL https://todo-jlong.zocomputer.io/todo` →
  grep the `assets/index-*.js` name, then grep the bundle for feature-specific
  class names (`move-mode-btn`, `reporter-fab`) with known-present controls
  (`Groceries`, `card-tags`).
- Deploy health: `gh run list --limit 10` in the repo; failures show the Zo
  git error verbatim in `gh run view <id> --log-failed`.
