# Todo App

Jennifer's personal dashboard and task manager: a React PWA running as a Cloudflare Worker.

- Package manager & tooling: **Bun**. Frontend: React + Vite + SASS. Backend: Hono routes composed in `src/server/app.ts`, Cloudflare D1 storage (Miniflare local simulation in dev).
- Commands: `bun test src`, `bun run typecheck`, `bun run lint`, `bun run dev`

## To do before each commit:

- Verify that all new features are covered by tests.
- `data/` is gitignored — never commit personal task data.
- Push each feature as its own commit to GitHub. Don't batch unrelated changes.
- Ensure that all relevant documentation is updated (`README.md`, `../todo-architecture.md`, `docs/devlog.md`).
- Check for and remove any unused files related to the current work. Keep cleanup scoped to the current task.
- Run `bun test src`, `bun run typecheck`, and `bun run lint` to catch errors early.

## Rules for updating documentation

- Keep copy succinct - 1-2 sentences per docstring, devlog entry, bullet point.

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
