# Deploying / redeploying the todo site

The site is a **published Zo Site** running as a supervised HTTP service (label `todo`)
on port `57863`, served live at **https://todo-jlong.zocomputer.io/todo**.

You don't need to prompt chat to redeploy. In production, `file server.ts` serves the
built files from `./dist` on every request, and a supervisor keeps the service
alive — kill it and it restarts itself.

## TL;DR — just push

**Pushing to `main` deploys automatically.** The `Deploy to Zo` GitHub Action
(`file .github/workflows/deploy-zo.yml`) runs on every push to main: it calls the Zo
MCP `bash` tool (auth via the `ZO_TOKEN` repo secret) to `git pull --ff-only` +
`./redeploy.sh` on Zo, then health-checks the live URL. Watch it with
`gh run watch --repo j-alicia-long/todo-now`, or trigger manually from the Actions tab
(workflow_dispatch).

## Manual fallback — one command

**From the local Mac** (no Zo chat/terminal needed):

```bash
cd ~/Documents/personal-os/02-projects/todo-app/todo
./scripts/deploy-zo.sh          # full redeploy (server.ts changes too)
./scripts/deploy-zo.sh --fast   # frontend only, zero downtime
```

`file scripts/deploy-zo.sh` deploys **GitHub main**: it runs `git pull` +
`file redeploy.sh` on Zo via the Zo MCP `bash` tool. This is the default because it
doesn't depend on the Mutagen file sync being healthy and it keeps Zo's checkout up to
date. **Commit & push first** — the script warns if the local tree is dirty or ahead of
`origin/main`. Requires `mcporter` (`npm i -g mcporter`) and a Zo API token at
`~/.config/ai-cost-tracker/zo_token` (override with `ZO_TOKEN_FILE`).

**Fallback — deploy the local tree without pushing** (`--sync`): the older Mutagen-sync
path. Waits for the file sync to deliver local edits (including uncommitted ones) to Zo,
then redeploys. Only works while the Mutagen session is healthy:

```bash
./scripts/deploy-zo.sh --sync          # full redeploy of the synced local tree
./scripts/deploy-zo.sh --sync --fast   # frontend only
```

**Directly on Zo:**

```bash
cd /home/workspace/personal-os/02-projects/todo-app/todo
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
cd /home/workspace/personal-os/02-projects/todo-app/todo

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

- **Live data lives at** `/home/workspace/todo-data/`, outside the Mutagen-synced
  `personal-os` tree, so a broken/re-created file sync can never overwrite it
  (that happened once — see `file src/server/files.ts` for the resolution order:
  `DATA_DIR` env → `/home/workspace/todo-data` if it exists → `./data`).
  The repo's `data/` folder is only used for local development.
- The live site runs from **Zo's checkout of this directory**, not from GitHub directly.
  Pushing to `github.com/j-alicia-long/todo-now` deploys via the `Deploy to Zo` Action,
  which pulls main onto Zo's checkout and redeploys. `deploy-zo.sh` remains as a manual
  fallback (e.g., if the Action or its `ZO_TOKEN` secret breaks).
- If the Zo API token rotates, update both the local file
  (`~/.config/ai-cost-tracker/zo_token`) and the repo secret:
  `gh secret set ZO_TOKEN --repo j-alicia-long/todo-now < ~/.config/ai-cost-tracker/zo_token`.
- `pkill -f "bun run prod"` only matches the published service, not the dev server
  (`bun run dev`), so it's safe to run.
- If a redeploy ever hangs or the port is stuck, killing the process is safe — the
  supervisor always brings it back. As a last resort, ask chat to run `publish_site`.