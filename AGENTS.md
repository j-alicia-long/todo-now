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
- Backend: `server.ts` with CRUD routes for `/api/tasks`, `/api/shopping`, `/api/groceries`, `/api/recurring`, `/api/settings`, `/api/archive`
- Domain: `src/domain/task-rules.ts` — pure Task lifecycle rules (status transitions, due-date auto-promote, trash purge) shared by server and client; the `Task` type lives here. Tested via `bun test` (`src/domain/task-rules.test.ts`).
- Domain: `src/domain/recurrence.ts` — pure Week & recurrence rules shared by server and client: weekly reset (`resetWeeklyItems`), completion stamping (`applyRecurringCompletion`), due-date advancement on long-term completion (`advanceDueDate`, enforces endsOn/endsAfter), first-due derivation, and Board visibility selectors (`boardWeeklyItems`, `upcomingLongTermItems`, gated by `showEarlyDays`). The `RecurringItem` type lives here. All functions take an injected `now: Date`. Tested via `bun test` (`src/domain/recurrence.test.ts`).
- Stores: `src/stores/` — client data layer. `transport.ts` (narrow HTTP seam, swappable in tests), `entity-store.ts` (generic list store: fetch, optimistic update, refetch-reconcile on error), `hooks.ts` (per-family hooks: `useTasks`, `useShopping`, `useGroceries`, `useRecurring`, `useSettings`; entity types live here). TodoPage composes these hooks and keeps only cross-family coordination (e.g. completing a shopping-sourced task toggles the source item). Tested via `bun test` (`src/stores/entity-store.test.ts`, in-memory transport + happy-dom).
- Data: JSON files in `data/` (gitignored — contains personal data)

## Tabs

Board → Recurring → Shopping → Groceries
Sidebar drawer: Todo Archive, Todo Trash, Shopping Archive, Settings

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
