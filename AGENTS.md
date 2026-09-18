# Todo App

Jennifer's personal dashboard and task manager: a React PWA running as a Cloudflare Worker.

- Package manager & tooling: **Bun**. Frontend: React + Vite + SASS. Backend: Hono routes composed in `src/server/app.ts`, Cloudflare D1 storage (Miniflare local simulation in dev).
- Commands: `bun test src`, `bun run typecheck`, `bun run lint`, `bun run dev`

## Rules for every task

- Push each feature as its own commit to GitHub. Don't batch unrelated changes.
- `data/` is gitignored — never commit personal task data.
- Binary assets (icons, images) live only in the deployed site, not in the GitHub repo — exception: README screenshots in `docs/` (e.g. `screenshot.png`, `screenshot-reporter.png`).
- Update file docstrings, `../todo-architecture.md` (product spec), `README.md` for new features; log notable shipped work in `docs/devlog.md`.

## Deeper docs

- Domain glossary (what a "family" is, etc.): `CONTEXT.md`
- Code structure, module layers, and architecture vocabulary: `docs/ARCHITECTURE.md`
- Colors, themes, and interaction details: `docs/VISUAL-CONVENTIONS.md`
- Issue report triage keys (issue labels, work order): `docs/TRIAGE.md`
- Shared code conventions: ESLint preset from [j-alicia-long/web-config](https://github.com/j-alicia-long/web-config) (bun git dependency); judgment calls in the `.github/skills/web-conventions/` skill (re-sync with `bun run sync-skills`)

# Deprecated docs

No need to reference these docs, unless you are really stuck.

- Roadmap: `docs/roadmap.md` · Product spec & project map: `../todo-architecture.md`, `../AGENTS.md` · Narrative history: `../history.md`

## Live URLs

- Production: https://todo.jlongx.workers.dev/todo (behind Cloudflare Access)
- Demo (sample data): https://j-alicia-long.github.io/todo-now/
- GitHub: <copilot-ref kind="repo" target-id="https://github.com/j-alicia-long/todo-now" label="j-alicia-long/todo-now" />
