# Architecture

All source files are kebab-case (ESLint-enforced via the shared preset).

## Layers

- **Controller**: `src/tabs/todo-base.tsx` — calls store hooks once, builds action handles, owns tab/modal/drawer routing state, and the header/add-bar chrome. Styles in `todo-base.scss`.
- **Tabs**: `src/tabs/` — one component per view, each deriving its own slices from raw store lists: `board-tab.tsx` (owns drag-and-drop), `shopping-tab.tsx`, `groceries-tab.tsx`, `recurring-tab.tsx`, `recurring-modal.tsx` (owns its draft form state; mounts fresh per open), `sidebar-drawer.tsx` (archive/trash/shopping-archive/settings panels), `settings-view.tsx` (the Settings panel's content).
- **Components**: `src/components/` — presentational components: `task-card.tsx`, `future-task-card.tsx`, `trash-card.tsx`, `board-column.tsx`, `shopping-items.tsx`, `recurring-list-item.tsx`. Domain-agnostic primitives live in `src/components/kit/`: `icon.tsx`, `link-pills.tsx`, `tag-select.tsx`, `move-action-button.tsx`, `key-hint.tsx`, `date-picker.tsx`. Components with 3+ callbacks take a narrow action-handle object (e.g. `TaskActions`, `RecurringItemActions`) declared in the consumer's file and built once in TodoBase; smaller components take plain props. Exception: `reporter.tsx` is a self-contained feature (the Reporter — see `../CONTEXT.md`), owning Report Mode input hijacking, Target capture (`src/lib/report-capture.ts`), shake activation (`src/lib/use-shake.ts`), and its own submit; TodoBase only passes `currentTab` and the shake setting.
- **Backend**: `server.ts` — the Cloudflare Workers entry: builds the adapter set from `env` bindings (D1, R2, GitHub token) and exports the `fetch` handler; static assets are served by the Workers assets binding (config in `wrangler.jsonc`), with SPA fallback for `/todo` deep links. Routes live in `src/server/`:
  - `src/server/app.ts` — `createApp(deps)`: composes every route (settings, groceries `clear-bought`, `/api/archive`, reports, the four family resources) against injected seams (`ListStore`s, `SettingsStore`, `ArchiveStore`, `ReportWriter`, `IssueCreator`), so any runtime or test can assemble the app with its own adapters.
  - `src/server/resource.ts` — generic resource module: mounts GET/POST/PUT/DELETE for one family; owns HTTP semantics, whitelisted merges, 404s. Persistence enters through an injected `ListStore` seam (`{read, write}`). Tested against an in-memory store (`src/server/resource.test.ts`).
  - `src/server/families.ts` — the four family configs: pure `construct`/`applyUpdate`/`applyRemove` hooks plus each family's writable-field whitelist; delegates lifecycle rules to `src/domain/` (`src/server/families.test.ts`).
  - `src/server/normalize.ts` — storage-agnostic legacy migrations and normalize-on-read for Tasks (due-soon promotion, Trash purge) and Recurring Items (weekly reset) — the app's only scheduler. Shared by every store adapter.
  - `src/server/d1.ts` — the production store adapters: one D1 `families(name, json)` table, each Family's whole list as one JSON blob per row (ADR 0002); Settings and the archive are each one more row.
  - `src/server/files.ts` — file store adapters (one JSON file per family in `data/`), kept for local tooling and the Phase 2 import.
  - `src/server/reports.ts` — the Reporter's write-only endpoint (`POST /api/reports`): validates a Report, renders it to Markdown, saves it through an injected `ReportWriter` seam, then files a Sanitized copy as a GitHub issue through an injected `IssueCreator` seam and stamps the issue URL into the file's frontmatter (`issue: pending` if filing fails — the file always survives). Snippet sanitization is a pure module (`src/server/sanitize.ts`); the production `ReportWriter` puts raw Markdown into an R2 bucket (`src/server/r2.ts`, keeping the same-minute filename de-collision), and the issue adapter (`github.ts`) `fetch`es the GitHub REST API (`POST /repos/{repo}/issues`) with a token from a Workers secret — repo or token absent → no-op creator, so dev stays issue-silent. Tests: `reports.test.ts`, `sanitize.test.ts`, `github.test.ts`.
- **Domain**: `src/domain/task-rules.ts` — pure Task lifecycle rules (status transitions, due-date auto-promote, trash purge) shared by server and client; the `Task` type lives here (`src/domain/task-rules.test.ts`).
- **Domain**: `src/domain/recurrence.ts` — pure Week & recurrence rules shared by server and client: weekly reset (`resetWeeklyItems`), completion stamping (`applyRecurringCompletion`), due-date advancement on long-term completion (`advanceDueDate`, enforces endsOn/endsAfter), first-due derivation, and Board visibility selectors (`boardWeeklyItems`, `upcomingLongTermItems`, gated by `showEarlyDays`). The `RecurringItem` type lives here. All functions take an injected `now: Date` (`src/domain/recurrence.test.ts`).
- **Stores**: `src/stores/` — client data layer. `transport.ts` (narrow HTTP seam, swappable in tests), `entity-store.ts` (generic list store: fetch, optimistic create/update, refetch-reconcile on error), `hooks.ts` (per-family hooks: `useTasks`, `useShopping`, `useGroceries`, `useRecurring`, `useSettings`). Entity types without lifecycle rules (`ShoppingItem`, `GroceryItem`) live in `src/domain/entities.ts`, shared by server and client. Item construction defaults live in `src/domain/construct.ts`, shared by the server's create routes and the client's optimistic creates, so both build identical items (client-supplied `id`/`createdAt` are honored). TodoBase composes these hooks and keeps only cross-family coordination (e.g. completing a shopping-sourced task toggles the source item). Tested with in-memory transport + happy-dom (`src/stores/entity-store.test.ts`).
- **Offline**: the `Transport` seam has three adapters — `httpTransport` (real HTTP), `demoTransport` (in-memory, demo builds), and `makeOfflineTransport` (`src/stores/offline-transport.ts`), which wraps HTTP for production: successful GETs mirror each family's list into storage; offline GETs serve the cached list with queued mutations overlaid; offline mutations enqueue (ordered) and resolve so optimistic state sticks; on reconnect the queue replays in order, then a `todo:synced` event refetches every list. Storage and connectivity are injected (`src/stores/offline-storage.ts` provides IndexedDB; tests inject in-memory fakes — happy-dom has no IndexedDB). Observable state (`getState`/`subscribe`: offline, pending count, syncing flag) drives the sync badge via `useOfflineState` — visible whenever queued changes exist, "Syncing…" during replay, and a brief "All changes synced" flash when the queue drains. The app shell is precached by a Workbox service worker (vite-plugin-pwa in `vite.config.ts`); fonts are self-hosted. See `docs/offline-mode/spec.md` and ADR 0002.
- **Data**: Cloudflare D1, blob-per-Family (one `families` table; each row is one Family's whole list as JSON — see ADR 0002); raw Reports in an R2 bucket. Local dev uses Miniflare's local D1/R2 simulation (state under `.wrangler/`, gitignored). The legacy JSON files in `data/` (also gitignored — personal data) remain until the Phase 2 import.

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
| POST   | `/api/reports`                | Save a bug/idea Report as Markdown + file a sanitized GitHub issue |
| POST   | `/api/archive`                | Archive done tasks / bought items older than 4 weeks to the archive store |

## Architecture vocabulary

Terms used in architecture discussions and reviews. Domain terms live in `../CONTEXT.md`; these describe code structure.

- **Module** — a unit of code with an **interface** (what callers see) and an **implementation** (what's hidden behind it).
- **Deep / shallow** — deep = small interface hiding substantial implementation; shallow = interface nearly as complex as the implementation. Prefer deep.
- **Seam** — a substitution point where one implementation can be swapped for another (e.g. `transport.ts`: real HTTP in prod, in-memory in tests).
- **Adapter** — a concrete implementation plugged into a seam.
- **Leverage** — one interface serving many call sites (e.g. `entity-store.ts` serving every list family).
- **Locality** — related logic concentrated in one module, so behavior and bugs are found in one place.
- **Family** — domain term (see `../CONTEXT.md`): one kind of item the app manages (Tasks, Shopping Items, Grocery Items, Recurring Items, Settings).
