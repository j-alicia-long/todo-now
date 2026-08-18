# Deploying / redeploying the todo site

The site runs as a **Cloudflare Worker**, live at
**https://todo.jlongx.workers.dev/todo** behind Cloudflare Access (log in as
`j.alicia.long@gmail.com` when prompted). Static assets are served by the
Workers assets binding; data lives in D1, raw bug reports in R2.

## TL;DR — just push

**Pushing to `main` deploys automatically.** The `Deploy to Cloudflare
Workers` Action (`.github/workflows/deploy.yml`) builds the site (the
`@cloudflare/vite-plugin` emits the deployable config at
`dist/todo/wrangler.json`), deploys it with `wrangler-action` using the
`CLOUDFLARE_API_TOKEN` repo secret, and health-checks the live URL. Watch it
with `gh run watch --repo j-alicia-long/todo-now`, or trigger manually from
the Actions tab (workflow_dispatch).

The health check accepts **200 or 302**: the app sits behind Cloudflare
Access, so an unauthenticated curl may only reach the Access login redirect —
that still proves the Worker route is live.

**Non-site pushes skip deploys.** Both workflows (this one and the GitHub
Pages demo) use `paths-ignore` for anything that can't affect the built site:
`**.md`, `docs/**`, `.gitignore`, `.github/**`, lint/format/hook configs, and
`scripts/**`. A mixed push (code + ignored files) still deploys. Note
`.github/**` includes the workflows themselves — after editing a workflow,
use workflow_dispatch to test it.

## Manual fallback — from the Mac

```bash
cd ~/Documents/repos/todo
bun install
bun run build
CLOUDFLARE_API_TOKEN="$(cat ~/.config/cloudflare/api_token)" \
  bunx wrangler deploy -c dist/todo/wrangler.json
```

Deploy from a clean checkout of `main` — the Action deploys GitHub main, so a
manual deploy from a dirty tree can silently ship unpushed changes.

## Where the live data lives

- **Lists + settings + archive**: the D1 database `todo` (id in
  `wrangler.jsonc`), one row per family in the `families` table (ADR 0002).
  Inspect with `bunx wrangler d1 execute todo --remote --command "SELECT name, length(json) FROM families"`.
  Point-in-time restore: [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)
  (`bunx wrangler d1 time-travel restore todo --timestamp=...`) — 30 days of
  history, no backup cron needed.
- **Raw bug reports**: the R2 bucket `todo-reports`
  (`bunx wrangler r2 object get todo-reports/<key> --pipe`). Sanitized copies
  are GitHub issues, as before.
- The repo's `data/` folder is legacy local-dev data only (gitignored);
  local dev now uses Miniflare's local D1/R2 simulation under `.wrangler/`.

## Secrets & token rotation

- **`CLOUDFLARE_API_TOKEN`** (deploys): lives in two places — the local file
  `~/.config/cloudflare/api_token` and the repo secret. **Expires
  2027-08-31.** On rotation, update both:
  `gh secret set CLOUDFLARE_API_TOKEN --repo j-alicia-long/todo-now < ~/.config/cloudflare/api_token`.
- **`GITHUB_TOKEN`** (Worker secret, lets the Reporter file GitHub issues):
  set with `bunx wrangler secret put GITHUB_TOKEN`. Until it's set, issue
  filing is a no-op and reports only land in R2 — the report file always
  survives.
- **`ANTHROPIC_API_KEY`** (repo secret, used by the issue-triage workflow):
  `gh secret set ANTHROPIC_API_KEY --repo j-alicia-long/todo-now`. Until it's
  set, `.github/workflows/triage.yml` fails on every new issue — the issue
  itself is unaffected, it just arrives untriaged. The Actions-provided
  `GITHUB_TOKEN` covers the labelling and commenting; nothing to set for that.

## Debug

```bash
# Is it up? (302 = Access login redirect, also fine)
curl -s -o /dev/null -w '%{http_code}\n' https://todo.jlongx.workers.dev/todo

# Live Worker logs (requests, console output, exceptions)
CLOUDFLARE_API_TOKEN="$(cat ~/.config/cloudflare/api_token)" bunx wrangler tail todo

# Recent deploys
CLOUDFLARE_API_TOKEN="$(cat ~/.config/cloudflare/api_token)" bunx wrangler deployments list
```
