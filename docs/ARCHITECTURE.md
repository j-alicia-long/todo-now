# Architecture

All source files are kebab-case (ESLint-enforced via the shared preset).

## Layers

- **Controller**: `src/tabs/todo-base.tsx` — calls store hooks once, builds action handles, owns tab/modal/drawer routing state, and the header/add-bar chrome. Styles in `todo-base.scss`.
- **Tabs**: `src/tabs/` — one component per view, each deriving its own slices from raw store lists: `board-tab.tsx` (owns drag-and-drop), `shopping-tab.tsx`, `groceries-tab.tsx`, `recurring-tab.tsx`, `recurring-modal.tsx` (owns its draft form state; mounts fresh per open), `sidebar-drawer.tsx` (archive/trash/shopping-archive/settings panels).
- **Components**: `src/components/` — presentational components: `ui.tsx` (Icon, LinkPills, TagSelect), `date-picker.tsx`, `task-card.tsx`, `future-task-card.tsx`, `trash-card.tsx`, `board-column.tsx`, `shopping-items.tsx`, `recurring-list-item.tsx`, `settings-view.tsx`. Components with 3+ callbacks take a narrow action-handle object (e.g. `TaskActions`, `RecurringItemActions`) declared in the consumer's file and built once in TodoBase; smaller components take plain props. Exception: `reporter.tsx` is a self-contained feature (the Reporter — see `../CONTEXT.md`), owning Report Mode input hijacking, Target capture (`src/lib/report-capture.ts`), shake activation (`src/lib/use-shake.ts`), and its own submit; TodoBase only passes `currentTab` and the shake setting.
- **Backend**: `server.ts` — wiring only: settings routes, groceries `clear-bought`, `/api/archive`, static/Vite serving. List-family CRUD lives in `src/server/`:
  - `src/server/resource.ts` — generic resource module: mounts GET/POST/PUT/DELETE for one family; owns HTTP semantics, whitelisted merges, 404s. Persistence enters through an injected `ListStore` seam (`{read, write}`). Tested against an in-memory store (`src/server/resource.test.ts`).
  - `src/server/families.ts` — the four family configs: pure `construct`/`applyUpdate`/`applyRemove` hooks plus each family's writable-field whitelist; delegates lifecycle rules to `src/domain/` (`src/server/families.test.ts`).
  - `src/server/files.ts` — file store adapters (one JSON file per family in `data/`), including legacy migrations and normalize-on-read for Tasks (due-soon promotion, Trash purge) and Recurring Items (weekly reset) — the app's only scheduler.
  - `src/server/reports.ts` — the Reporter's write-only endpoint (`POST /api/reports`): validates a Report, renders it to Markdown, and saves it through an injected `ReportWriter` seam. The file adapter (in `files.ts`) writes to `data/reports/open/`; an agent resolves a Report by moving it to `data/reports/resolved/` (`src/server/reports.test.ts`).
- **Domain**: `src/domain/task-rules.ts` — pure Task lifecycle rules (status transitions, due-date auto-promote, trash purge) shared by server and client; the `Task` type lives here (`src/domain/task-rules.test.ts`).
- **Domain**: `src/domain/recurrence.ts` — pure Week & recurrence rules shared by server and client: weekly reset (`resetWeeklyItems`), completion stamping (`applyRecurringCompletion`), due-date advancement on long-term completion (`advanceDueDate`, enforces endsOn/endsAfter), first-due derivation, and Board visibility selectors (`boardWeeklyItems`, `upcomingLongTermItems`, gated by `showEarlyDays`). The `RecurringItem` type lives here. All functions take an injected `now: Date` (`src/domain/recurrence.test.ts`).
- **Stores**: `src/stores/` — client data layer. `transport.ts` (narrow HTTP seam, swappable in tests), `entity-store.ts` (generic list store: fetch, optimistic create/update, refetch-reconcile on error), `hooks.ts` (per-family hooks: `useTasks`, `useShopping`, `useGroceries`, `useRecurring`, `useSettings`). Entity types without lifecycle rules (`ShoppingItem`, `GroceryItem`) live in `src/domain/entities.ts`, shared by server and client. Item construction defaults live in `src/domain/construct.ts`, shared by the server's create routes and the client's optimistic creates, so both build identical items (client-supplied `id`/`createdAt` are honored). TodoBase composes these hooks and keeps only cross-family coordination (e.g. completing a shopping-sourced task toggles the source item). Tested with in-memory transport + happy-dom (`src/stores/entity-store.test.ts`).
- **Offline**: the `Transport` seam has three adapters — `httpTransport` (real HTTP), `demoTransport` (in-memory, demo builds), and `makeOfflineTransport` (`src/stores/offline-transport.ts`), which wraps HTTP for production: successful GETs mirror each family's list into storage; offline GETs serve the cached list with queued mutations overlaid; offline mutations enqueue (ordered) and resolve so optimistic state sticks; on reconnect the queue replays in order, then a `todo:synced` event refetches every list. Storage and connectivity are injected (`src/stores/offline-storage.ts` provides IndexedDB; tests inject in-memory fakes — happy-dom has no IndexedDB). Observable state (`getState`/`subscribe`) drives the offline/pending badge via `useOfflineState`. The app shell is precached by a Workbox service worker (vite-plugin-pwa in `vite.config.ts`); fonts are self-hosted. See `docs/offline-mode/spec.md` and ADR 0002.
- **Data**: JSON files in `data/` (gitignored — contains personal data): tasks, shopping, groceries, recurring, settings.

## Tabs

Board → Recurring → Shopping → Groceries
Sidebar drawer: Todo Archive, Todo Trash, Shopping Archive, Settings

## API

The four list families (`tasks`, `shopping`, `groceries`, `recurring`) share the same generic CRUD surface, mounted by `src/server/resource.ts`:

| Method | Endpoint            | Description                                                          |
| ------ | ------------------- | -------------------------------------------------------------------- |
| GET    | `/api/<family>`     | List all items                                                       |
| POST   | `/api/<family>`     | Create an item                                                       |
| PUT    | `/api/<family>/:id` | Update an item (whitelisted fields only)                             |
| DELETE | `/api/<family>/:id` | Delete an item (Tasks soft-delete; `?permanent=true` to hard-delete) |

Bespoke routes:

| Method | Endpoint                      | Description                                                    |
| ------ | ----------------------------- | -------------------------------------------------------------- |
| GET    | `/api/settings`               | Read settings                                                  |
| PUT    | `/api/settings`               | Merge-update settings                                          |
| DELETE | `/api/groceries/clear-bought` | Remove all bought grocery items                                |
| POST   | `/api/reports`                | Save a bug/idea Report as Markdown to `data/reports/open/`     |
| POST   | `/api/archive`                | Archive done tasks / bought items older than 4 weeks to `data/archive.md` |

## Architecture vocabulary

Terms used in architecture discussions and reviews. Domain terms live in `../CONTEXT.md`; these describe code structure.

- **Module** — a unit of code with an **interface** (what callers see) and an **implementation** (what's hidden behind it).
- **Deep / shallow** — deep = small interface hiding substantial implementation; shallow = interface nearly as complex as the implementation. Prefer deep.
- **Seam** — a substitution point where one implementation can be swapped for another (e.g. `transport.ts`: real HTTP in prod, in-memory in tests).
- **Adapter** — a concrete implementation plugged into a seam.
- **Leverage** — one interface serving many call sites (e.g. `entity-store.ts` serving every list family).
- **Locality** — related logic concentrated in one module, so behavior and bugs are found in one place.
- **Family** — domain term (see `../CONTEXT.md`): one kind of item the app manages (Tasks, Shopping Items, Grocery Items, Recurring Items, Settings).
