# Todo App (Unstuck Dashboard)

Jennifer's personal task/shopping/grocery manager: a React PWA hosted as a Zo Site.

- Runtime & package manager: **Bun**. Frontend: React + Vite + SASS. Backend: Hono routes in `server.ts`, JSON file storage.
- Commands: `bun test src`, `bun run typecheck`, `bun run lint`, `bun run dev`

## Rules for every task

- Push each feature as its own commit to GitHub. Don't batch unrelated changes.
- `data/` is gitignored — never commit personal task data.
- Binary assets (icons, images) live only in the deployed site, not in the GitHub repo — exception: README screenshots in `docs/` (e.g. `screenshot.png`, `screenshot-reporter.png`).
- Update `../todo-architecture.md` (product spec) and `README.md` for new features; log notable shipped work in `docs/devlog.md`.
- **Check open `bug`/`idea` issues on GitHub for user-filed Reports** (filed by the in-app Reporter, sanitized). Raw unsanitized snippets live in the companion files at `../reports/` (`~/Documents/personal-os/02-projects/todo-app/reports/`, Mutagen-synced from Zo — see its AGENTS.md). After fixing one, close its issue (`Closes #N` in the commit/PR, or `gh issue close`).

## Deeper docs

- Code structure, module layers, and architecture vocabulary: `docs/ARCHITECTURE.md`
- Colors, themes, and interaction details: `docs/VISUAL-CONVENTIONS.md`
- Domain glossary (what a "family" is, etc.): `CONTEXT.md`
- Shared code conventions: ESLint preset from [j-alicia-long/web-config](https://github.com/j-alicia-long/web-config) (bun git dependency); judgment calls in the `.github/skills/web-conventions/` skill (re-sync with `bun run sync-skills`)
- Roadmap: `docs/roadmap.md` · Product spec & project map: `../todo-architecture.md`, `../AGENTS.md` · Narrative history: `../history.md`

## Live URLs

- Production: https://todo-jlong.zocomputer.io/todo
- Demo (sample data): https://j-alicia-long.github.io/todo-now/
- GitHub: <copilot-ref kind="repo" target-id="https://github.com/j-alicia-long/todo-now" label="j-alicia-long/todo-now" />
