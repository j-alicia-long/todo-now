# Todo Now

A warm, cozy, mobile-friendly todo app built as a React PWA. Designed to reduce decision load by surfacing small, actionable tasks and organizing work by time horizon.

[![Screenshot of the board](docs/screenshot.png)](https://j-alicia-long.github.io/todo-now/)

**▶ Try the live demo:** [j-alicia-long.github.io/todo-now](https://j-alicia-long.github.io/todo-now/) — static build seeded with sample data (in-memory, changes reset on reload).

## Features

- **Task board**: organize tasks by time horizon — This Week → This Month → Done — with drag-and-drop, a Future tab for parking ideas, and inline editing of due dates and labels right on each card
- **Recurring tasks**: weekly habits and long-term chores that resurface on the board when due — or hide them all from the board with a Settings toggle
- **Shopping & grocery lists**: lightweight checklists, each with its own pastel theme
- **Desktop & mobile**: responsive PWA — full web app on desktop, installable touch-first app on phones; works fully offline (cached lists, queued edits that sync on reconnect)
- **Theming**: warm cream (light) / deep cocoa (dark) themes
- **Bug Reporter**: shake (mobile) or ⌘⇧P (desktop) opens Report Mode — tap elements to highlight, then file a report saved as a GitHub issue for an agent to pick up later.

  ![Reporter compose modal: two highlighted targets with an inline mention chip in the note](docs/screenshot-reporter.png)

## Architecture

Layered React SPA over a thin Hono API: Controller (`src/tabs/todo-base.tsx`) → Tabs → Components → Stores (client data layer with a swappable transport seam) → shared pure Domain rules → generic Server resource modules → Cloudflare D1 (one JSON blob per list family). Full layer-by-layer breakdown, module map, and API table: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

### Stack

- **Runtime**: [Cloudflare Workers](https://workers.cloudflare.com) ([Bun](https://bun.sh) for tooling and tests)
- **Server**: [Hono](https://hono.dev) (API routes; static assets via the Workers assets binding)
- **Frontend**: React 19 + react-router-dom
- **Styling**: SASS with CSS custom properties (no Tailwind)
- **Drag & drop**: [@dnd-kit/core](https://dndkit.com)
- **Build**: [Vite](https://vite.dev) + [@cloudflare/vite-plugin](https://developers.cloudflare.com/workers/vite-plugin/)
- **Storage**: Cloudflare D1 — one `families` table, each list family's data as one JSON blob per row (ADR 0002); raw bug reports in R2. Local dev uses Miniflare's local simulation of both.

### API

Generic CRUD routes per list family (`/api/tasks`, `/api/shopping`, `/api/groceries`, `/api/recurring`), plus `/api/settings` (get/update), write-only `/api/reports` (bug Reporter), and `/api/archive` (weekly archive sweep). Full route table in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#api).

### Task Model

```typescript
{
  id: string;
  title: string;
  done: boolean;
  status: "this-week" | "this-month" | "future" | "done" | "trashed";
  effort: "low" | "medium" | "high";
  decisionLoad: "low" | "medium" | "high";
  area: string;
  dueDate: string | null;
  importance: "important" | "not-important" | null; // null = Unsorted on the Matrix
  createdAt: string;
  completedAt: string | null;
  deletedAt: string | null;
  source: "board" | "shopping" | "grocery";
  sourceItemId: string | null;
}
```

Urgency is never stored — a Task is urgent iff its due date is within 2 days or overdue (ADR 0001, `docs/adr/`).

## Development

```bash
bun install
bun run dev
```

`bun run dev` runs the Worker in workerd (Cloudflare's runtime) inside `vite dev`, with local D1/R2 simulation — no Cloudflare account needed. `bun run build && bun run preview` serves the built Worker.

## Hosting

Live on [Cloudflare Workers](https://workers.cloudflare.com) at [todo.jlongx.workers.dev/todo](https://todo.jlongx.workers.dev/todo), behind Cloudflare Access (private instance). Pushing to `main` deploys automatically via `.github/workflows/deploy.yml` (build + `wrangler deploy`); data lives in D1, raw bug reports in R2. Details and manual fallback: [docs/DEPLOY.md](docs/DEPLOY.md); migration history: [docs/cloudflare-migration/spec.md](docs/cloudflare-migration/spec.md).

### Demo build

A serverless demo lives at [j-alicia-long.github.io/todo-now](https://j-alicia-long.github.io/todo-now/), deployed by `.github/workflows/deploy-demo.yml` on every push to `main`. Building with `VITE_DEMO=true` swaps the HTTP transport for an in-memory one (`src/stores/demo-transport.ts`) that reuses the server's family logic and seeds sample data (`src/stores/demo-data.ts`) — no API server needed.

```bash
VITE_DEMO=true bunx vite build --base=/todo-now/ --outDir dist-demo
```

## License

MIT
