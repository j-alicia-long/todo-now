# Deploying / redeploying the todo site

The site is a **published Zo Site** running as a supervised HTTP service (label `todo`)
on port `57863`, served live at **https://todo-jlong.zocomputer.io/todo**.

You don't need to prompt chat to redeploy. In production, `server.ts` serves the
built files from `./dist` on every request, and a supervisor keeps the service
alive — kill it and it restarts itself.

## TL;DR — one command

```bash
cd /home/workspace/personal-os/02-projects/todo-app/todo
./redeploy.sh
```

That rebuilds the bundle, restarts the service, and waits until the site returns
HTTP 200. (First run only: `chmod +x redeploy.sh`.)

**Frontend-only change** (anything in `src/`, `index.tsx`, styles — not `server.ts`)?
Skip the restart for a zero-downtime deploy:

```bash
./redeploy.sh --fast
```

## What each command actually does

| Command | Rebuilds `dist/` | Restarts server | Downtime | Use when |
|---|---|---|---|---|
| `bun run build` | ✅ | ❌ | none | frontend changed; server serves new `dist/` immediately |
| `./redeploy.sh --fast` | ✅ | ❌ | none | same as above, with a health check |
| `./redeploy.sh` | ✅ | ✅ | ~5–6s | `server.ts` / API changed, or when in doubt |

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

- The live site runs from **this workspace directory**, not from GitHub. Pushing to
  `github.com/j-alicia-long/todo-now` does **not** deploy — running the commands above does.
  Commit/push separately if you want the repo in sync.
- `pkill -f "bun run prod"` only matches the published service, not the dev server
  (`bun run dev`), so it's safe to run.
- If a redeploy ever hangs or the port is stuck, killing the process is safe — the
  supervisor always brings it back. As a last resort, ask chat to run `publish_site`.
