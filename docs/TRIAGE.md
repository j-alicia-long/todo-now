# Report triage keys

User-filed Reports (from the in-app Reporter) live as GitHub issues on this repo, labeled `bug` or `idea`. Triage one by adding **exactly one** of these labels to its issue (`gh issue edit N --add-label P1`).

## Bugs — priority

- **P0** — Blocks functionality
- **P1** — Adds friction, but doesn't block functionality
- **P2** — UI polish, nice to have

## Ideas/features — scope

- **Large** — Large scope, complicated feature with unknowns that should go through system design and domain modeling
- **Medium** — A new feature, but easy to execute without an explicit design plan
- **Small** — Just a UI change, port of an existing feature, etc.

## Automation

New issues are labelled automatically by `.github/workflows/triage.yml`, which
runs `scripts/triage-issue.ts` on `issues: opened` plus a nightly sweep at
08:00 UTC. The script reads **this file** for the key definitions, so editing
the keys above changes what it assigns — keep them here, not in the script.

It only ever adds a label to an issue that has none of the six, so a label set
by hand always wins and the sweep is safe to re-run. Issues labelled `blocked`
or `tech-debt` are skipped entirely. Needs the `ANTHROPIC_API_KEY` repo secret
(see [`DEPLOY.md`](DEPLOY.md)); without it the workflow fails and issues simply
arrive untriaged.

## Work order

Bugs before features, in label order: P0 → P1 → P2 → Small → Medium → Large. Bugs and Small features commit directly to main; Medium features go through a PR; Large features are triage-only (leave the issue open for design work).

The full reports workflow (hybrid file+issue model, sanitization, resolution) is documented in the reports folder's AGENTS.md in the synced personal-os tree (`personal-os/02-projects/todo-app/reports/`).
