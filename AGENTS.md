# Todo App (Unstuck Dashboard)

React PWA hosted as a Zo Site. Jennifer's personal task/shopping/grocery manager, built during the Fractal Accelerator (Jul 2026).

## Tech stack

- React + Vite + Bun + SASS (not Tailwind — Jennifer's explicit preference)
- Hono API routes (server.ts)
- JSON file storage in data/ (tasks.json, shopping.json, groceries.json, recurring.json, settings.json)
- Material Design icons (google material-symbols/outlined)
- react-aria-components for date picker / calendar

## Architecture

- Frontend: `src/tabs/TodoBase.tsx` (~460 lines) — the controller: calls store hooks once, builds action handles, owns tab/modal/drawer routing state, and the header/add-bar chrome
- Tabs: `src/tabs/` — one component per view, each deriving its own slices from raw store lists: `BoardTab.tsx` (owns drag-and-drop), `ShoppingTab.tsx`, `GroceriesTab.tsx`, `RecurringTab.tsx`, `RecurringModal.tsx` (owns its draft form state; mounts fresh per open), `SidebarDrawer.tsx` (archive/trash/shopping-archive/settings panels). Styles in `TodoBase.scss` (~1600 lines)
- Components: `src/components/` — presentational components extracted from the old TodoPage: `ui.tsx` (Icon, LinkPills, TagSelect), `DatePicker.tsx`, `TaskCard.tsx`, `FutureTaskCard.tsx`, `TrashCard.tsx`, `BoardColumn.tsx`, `ShoppingItems.tsx`, `RecurringListItem.tsx`, `SettingsView.tsx`. Components with 3+ callbacks take a narrow action-handle object (e.g. `TaskActions`, `RecurringItemActions`) declared in the consumer's file and built once in TodoBase; smaller components take plain props.
- Backend: `server.ts` — wiring only: settings routes, groceries `clear-bought`, `/api/archive`, static/Vite serving. List-family CRUD lives in `src/server/`:
  - `src/server/resource.ts` — generic resource module: mounts GET/POST/PUT/DELETE for one family; owns HTTP semantics, whitelisted merges, 404s. Persistence enters through an injected `ListStore` seam (`{read, write}`). Tested via `bun test` against an in-memory store (`src/server/resource.test.ts`).
  - `src/server/families.ts` — the four family configs: pure `construct`/`applyUpdate`/`applyRemove` hooks plus each family's writable-field whitelist; delegates lifecycle rules to `src/domain/`. Tested via `bun test` (`src/server/families.test.ts`).
  - `src/server/files.ts` — file store adapters (one JSON file per family in `data/`), including legacy migrations and normalize-on-read for Tasks (due-soon promotion, Trash purge) and Recurring Items (weekly reset) — the app's only scheduler.
- Domain: `src/domain/task-rules.ts` — pure Task lifecycle rules (status transitions, due-date auto-promote, trash purge) shared by server and client; the `Task` type lives here. Tested via `bun test` (`src/domain/task-rules.test.ts`).
- Domain: `src/domain/recurrence.ts` — pure Week & recurrence rules shared by server and client: weekly reset (`resetWeeklyItems`), completion stamping (`applyRecurringCompletion`), due-date advancement on long-term completion (`advanceDueDate`, enforces endsOn/endsAfter), first-due derivation, and Board visibility selectors (`boardWeeklyItems`, `upcomingLongTermItems`, gated by `showEarlyDays`). The `RecurringItem` type lives here. All functions take an injected `now: Date`. Tested via `bun test` (`src/domain/recurrence.test.ts`).
- Stores: `src/stores/` — client data layer. `transport.ts` (narrow HTTP seam, swappable in tests), `entity-store.ts` (generic list store: fetch, optimistic update, refetch-reconcile on error), `hooks.ts` (per-family hooks: `useTasks`, `useShopping`, `useGroceries`, `useRecurring`, `useSettings`). Entity types without lifecycle rules (`ShoppingItem`, `GroceryItem`) live in `src/domain/entities.ts`, shared by server and client. TodoPage composes these hooks and keeps only cross-family coordination (e.g. completing a shopping-sourced task toggles the source item). Tested via `bun test` (`src/stores/entity-store.test.ts`, in-memory transport + happy-dom).
- Data: JSON files in `data/` (gitignored — contains personal data)

## Architecture vocabulary

Terms used in architecture discussions, reviews, and this file. Domain terms live in `CONTEXT.md`; these describe code structure.

- **Module** — a unit of code with an **interface** (what callers see) and an **implementation** (what's hidden behind it).
- **Deep / shallow** — deep = small interface hiding substantial implementation; shallow = interface nearly as complex as the implementation. Prefer deep.
- **Seam** — a substitution point where one implementation can be swapped for another (e.g. `transport.ts`: real HTTP in prod, in-memory in tests).
- **Adapter** — a concrete implementation plugged into a seam.
- **Leverage** — one interface serving many call sites (e.g. `entity-store.ts` serving every list family).
- **Locality** — related logic concentrated in one module, so behavior and bugs are found in one place.
- **Family** — domain term (see `CONTEXT.md`): one kind of item the app manages (Tasks, Shopping Items, Grocery Items, Recurring Items, Settings).

## Tabs

Board → Recurring → Shopping → Groceries
Sidebar drawer: Todo Archive, Todo Trash, Shopping Archive, Settings

## Code conventions

- Shared conventions come from [j-alicia-long/web-config](https://github.com/j-alicia-long/web-config) (a bun git dependency):
  - ESLint preset: `eslint.config.js` spreads `@j-alicia-long/web-config/eslint` (machine-checkable rules)
  - Agent skill: `.github/skills/web-conventions/` (judgment calls) — a committed copy; re-sync after updating the dependency with `bun run sync-skills`

## Visual conventions

- Board columns: This Week (orange tint), This Month (purple tint), Done (green tint) — pastel backgrounds
- Color-coded area labels: Life Admin=blue, Social=purple, Health=orange, Learning=teal, Career=green, Project=pink
- Due dates: urgency colors (red/orange/yellow/green) with pastel backgrounds
- Shopping: purple theme (#b48cdc). Groceries: green theme (#78be82).
- Recurring tasks appear in Board's This Week column with green left accent
- Task titles editable by double-click (desktop) / double-tap (mobile); Enter to save, Escape to cancel
- Mobile: icon-only tabs below 768px, swipe support within board columns

## Live URLs

- Production: https://todo-jlong.zocomputer.io/todo
- GitHub: https://github.com/j-alicia-long/todo-now

## Standing instructions

- Push each feature as its own commit to GitHub. Don't batch unrelated changes.
- Update `../todo-architecture.md` (product spec) and `README.md` for new features.
- `data/` is gitignored — never commit personal task data.
- Binary assets (icons, images) live only in the deployed site, not in the GitHub repo.

## Project context

- Product spec: `personal-os/02-projects/todo-app/todo-architecture.md`
- Devlog: `devlog.md` (this repo) — short, dated entries with commit links; update it when shipping notable work
- Roadmap: `docs/roadmap.md` — planned, deferred, and cut work
- Narrative history: `personal-os/02-projects/todo-app/history.md` (condensed sessions & decisions)
- Project map: `personal-os/02-projects/todo-app/AGENTS.md`
- Domain glossary: `CONTEXT.md` (this repo)
