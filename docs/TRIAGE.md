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

## Work order

Bugs before features, in label order: P0 → P1 → P2 → Small → Medium → Large. Bugs and Small features commit directly to main; Medium features go through a PR; Large features are triage-only (leave the issue open for design work).

The full reports workflow (hybrid file+issue model, sanitization, resolution) is documented in the reports folder's AGENTS.md in the synced personal-os tree (`personal-os/02-projects/todo-app/reports/`).
