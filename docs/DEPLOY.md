# Deploying / redeploying the todo site

The site is a **published Zo Site** running as a supervised HTTP service (label `todo`)
on port `57863`, served live at **https://todo-jlong.zocomputer.io/todo**.

You don't need to prompt chat to redeploy. In production, `file server.ts` serves the
built files from `./dist` on every request, and a supervisor keeps the service
alive — kill it and it restarts itself.

## TL;DR — just push

**Pushing to `main` deploys automatically.** The `Deploy to Zo` GitHub Action
(`file .github/workflows/deploy-zo.yml`) runs on every push to main: it calls the Zo
MCP `bash` tool (auth via the `ZO_TOKEN` repo secret) to `git fetch` +
`git reset --hard FETCH_HEAD` + `./redeploy.sh` on Zo, then health-checks the live URL.
Before resetting, both deploy paths log `git status --short` and auto-stash any
unexpected local changes in the deploy clone (`git stash list` on Zo to inspect;
`pre-deploy-autostash` entries) — nothing should ever be writing there, so a
non-empty stash is a signal something's off.
Watch it with
`gh run watch --repo j-alicia-long/todo-now`, or trigger manually from the Actions tab
(workflow_dispatch).

**Non-site pushes skip deploys.** Both workflows (`Deploy to Zo` and the
GitHub Pages demo) use `paths-ignore` for anything that can't affect the built
site: `**.md`, `docs/**`, `.gitignore`, `.github/**`, lint/format/hook configs
(`.husky/**`, `.lintstagedrc`, `.prettierrc`, `.prettierignore`,
`eslint.config.js`, `stylelint.config.js`), and `scripts/**` (Mac-side
tooling). A mixed push (code + ignored files) still deploys. Note `.github/**`
includes the workflows themselves — after editing a workflow, use
workflow_dispatch to test it.

## Manual fallback — one command

**From the local Mac** (no Zo chat/terminal needed):

```bash
cd ~/Documents/repos/todo
./scripts/deploy-zo.sh          # full redeploy (server.ts changes too)
./scripts/deploy-zo.sh --fast   # frontend only, zero downtime
```

`file scripts/deploy-zo.sh` deploys **GitHub main**: it runs `git fetch` +
`git reset --hard FETCH_HEAD` + `file redeploy.sh` on Zo via the Zo MCP `bash` tool.
**Commit & push first** — the script warns if the local tree is dirty or ahead of
`origin/main`. Requires `mcporter` (`npm i -g mcporter`) and a Zo API token at
`~/.config/ai-cost-tracker/zo_token` (override with `ZO_TOKEN_FILE`).

**Directly on Zo:**

```bash
cd /home/workspace/repos/todo
./redeploy.sh
```

That rebuilds the bundle, restarts the service, and waits until the site returns
HTTP 200. (First run only: `chmod +x redeploy.sh`.)

**Frontend-only change** (anything in `src/`, `file index.tsx`, styles — not `file server.ts`)?
Skip the restart for a zero-downtime deploy:

```bash
./redeploy.sh --fast
```

## What each command actually does

| Command | Rebuilds `dist/` | Restarts server | Downtime | Use when |
| --- | --- | --- | --- | --- |
| `bun run build` | ✅ | ❌ | none | frontend changed; server serves new `dist/` immediately |
| `./redeploy.sh --fast` | ✅ | ❌ | none | same as above, with a health check |
|  | ✅ | ✅ | \~5–6s | `file server.ts` / API changed, or when in doubt |

## Manual equivalents (if you'd rather not use the script)

```bash
cd /home/workspace/repos/todo

# Frontend change → rebuild only (live instantly, no downtime):
bun run build

# Server.ts / API change → restart the service.
# The supervisor reruns `bun run prod` (= build + serve) automatically.
pkill -f "bun run prod"
```

## Watch it come back / debug

```bash
# Is it up?
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:57863/todo   # want 200

# Live build + server logs
tail -f /dev/shm/todo.log
tail -f /dev/shm/todo_err.log
```

## Notes

- **Live data lives at** `/home/workspace/todo-data/`, outside the repo tree, so a
  deploy's `git reset --hard` can never touch it
  (see `file src/server/files.ts` for the resolution order:
  `DATA_DIR` env → `/home/workspace/todo-data` if it exists → `./data`).
  The repo's `data/` folder is only used for local development.
- **Bug reports are the one exception to "nothing lives in the sync":** the Reporter
  writes to `/home/workspace/personal-os/02-projects/todo-app/reports/open/` (inside
  the Mutagen-synced tree, on purpose — reports are created on Zo but worked on the
  Mac). Resolution order in `file src/server/files.ts`: `REPORTS_DIR` env → that path if
  it exists → `<dataDir>/reports`.
- The live site runs from **Zo's clone at `/home/workspace/repos/todo`** — outside the
  Mutagen-synced `personal-os` tree, so the Mac↔Zo file sync can never touch it. Git +
  GitHub is the only channel between the Mac clone (`~/Documents/repos/todo`) and Zo's.
  Pushing to `github.com/j-alicia-long/todo-now` deploys via the `Deploy to Zo` Action,
  which resets Zo's clone to main and redeploys. `deploy-zo.sh` remains as a manual
  fallback (e.g., if the Action or its `ZO_TOKEN` secret breaks).
- If the Zo API token rotates, update both the local file
  (`~/.config/ai-cost-tracker/zo_token`) and the repo secret:
  `gh secret set ZO_TOKEN --repo j-alicia-long/todo-now < ~/.config/ai-cost-tracker/zo_token`.
- `pkill -f "bun run prod"` only matches the published service, not the dev server
  (`bun run dev`), so it's safe to run.
- If a redeploy ever hangs or the port is stuck, killing the process is safe — the
  supervisor always brings it back. As a last resort, ask chat to run `publish_site`.