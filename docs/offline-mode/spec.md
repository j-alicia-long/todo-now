# Offline mode — investigation & plan

**Status:** Shipped — spec [#4](https://github.com/j-alicia-long/todo-now/issues/4), tickets #5–#10, branch `feature/offline-mode`
**Goal:** Make the todo app usable with no network — load the app, view lists, and check things off on the subway; sync automatically when back online.

## Where we stand today

The app is _installable_ (there's a `public/manifest.json`, icons, and apple-touch meta in `index.html`) but it is **not offline-capable at all**. There is **no service worker** anywhere in the project. Consequences:

- With no network, the page **won't even load** — the browser can't fetch the HTML/JS/CSS.
- Every data read/write is a live `fetch` to `/api/*`. Offline, all of them fail: the UI shows empty lists, **creates never appear** (`create` waits for the server's response before adding the item), and edits/deletes appear to stick in memory (the reconciling refetch also fails) but are **lost on reload or reverted on reconnect** — nothing is persisted or queued.

So "PWA" today means "installable," not "works offline." Both halves — **app shell** and **data** — need work.

## Why this is a _small_ change, not a rewrite

The codebase is already shaped for offline. Two things make it easy:

1. **A single data seam already exists.** Every client read/write goes through the `Transport` interface (`src/stores/transport.ts`): `get / post / put / del`. Stores never call `fetch` directly. There's already a second implementation of this seam — `demoTransport` (`src/stores/demo-transport.ts`), an in-memory adapter used for the static GitHub Pages demo, which reuses the **same domain rules** the server runs. Offline support slots into this exact seam as a third adapter that wraps HTTP with a local cache + queue. No component or page code changes.

2. **Optimistic updates and shared domain logic already exist.** `useEntityList.mutate` (`src/stores/entity-store.ts`) applies an optimistic state change, runs the request, and only reconciles on failure. The client already runs the same lifecycle rules as the server (`applyStatusChange`, `applyRecurringCompletion`, `advanceDueDate`), so the optimistic state produced offline is already correct — we just need to _keep_ it instead of reverting when the failure is "offline" rather than "server rejected." One gap: `create` is **not** optimistic today — it waits for the server's constructed item before adding it to state. See "Decided: optimistic creates" below.

Precedent for local persistence already exists too: `useSettings` mirrors settings to `localStorage` and treats the server as best-effort.

## The one real architectural change: client-generated IDs

Right now the **server** assigns IDs — `construct` in `src/server/families.ts` calls `newId()` and the `writable` whitelist excludes `id`. An offline-created item has no server ID until it syncs, which breaks any follow-up edit made to it while still offline (e.g. create a task, then check it off before reconnecting).

Fix: let the **client** generate the ID (`crypto.randomUUID().slice(0,8)`) and have the server honor a supplied ID:

```ts
// families.ts construct(), each family:
id: (body.id as string) || newId(),
```

IDs are already random 8-char strings, so this is backward-compatible and collision risk is negligible for a single-user app. This is the linchpin that makes an offline create + offline edit replay cleanly in order.

## Decided: optimistic creates in the store (Option B)

`create` in `useEntityList` becomes optimistic like `update`/`remove`: the client builds the full item (client-generated ID + construction defaults) and adds it to state immediately; the `POST` runs in the background and reconciles on response. To avoid duplicating the server's defaults, each family's `construct` logic moves from `src/server/families.ts` into shared `src/domain/` code that client and server both import (the same pattern `demoTransport` already uses for lifecycle rules).

Alternative considered: have the offline transport synthesize the server's response, leaving the store untouched. Rejected because optimistic creates are the standard web-app pattern, improve perceived speed online too, and the client must know construction defaults either way.

**Document this decision in `docs/ARCHITECTURE.md` once the spec is executed.**

## Two layers, phased by value

### Phase 1 — App shell offline (highest value, lowest risk)

Make the app _load_ with no network.

- Add a service worker that precaches the built assets (hashed JS/CSS, `index.html`, icons, manifest).
- **Recommended:** use `vite-plugin-pwa` (Workbox under the hood) rather than hand-rolling. It auto-generates the precache manifest from Vite's hashed output and handles the notoriously fiddly SW update lifecycle (so a stale worker can't pin users to an old build). This is a full Zo Site with its own `package.json`/build, so adding the dev dependency is fine here (the "don't install packages" rule only applies to zo.space routes).
- **Self-host the fonts.** `index.html` pulls Inter and **Material Symbols** from Google's CDN. Material Symbols is the app's icon set — offline, every icon would break to raw text. Bundle both locally (or precache the CDN responses) so the shell renders correctly offline.
- Confirm SW **scope/base path** works under `/todo` and that `start_url: /todo` in the manifest matches.

After Phase 1 the app opens offline and shows whatever the last render cached. Combined with Phase 2 it becomes genuinely useful.

### Phase 2 — Read cache (view lists offline)

- On every successful `GET`, mirror each family's list into **IndexedDB**.
- When a `GET` fails (offline), serve the last cached list instead of an empty array.
- Implement as an `offlineTransport` wrapping `httpTransport`; wire it as the `defaultTransport` for non-demo builds (`src/stores/default-transport.ts`). Data is tiny (<200 items), so IndexedDB is comfortable; `localStorage` would also work but IndexedDB is the cleaner home for list data.

### Phase 3 — Write queue (check things off offline, sync on reconnect)

- When a mutation (`post/put/del`) fails due to being offline, **enqueue** it in IndexedDB (ordered) and resolve _successfully_ so the optimistic state sticks. Distinguish "offline" (queue + keep) from a real HTTP 4xx/5xx (throw → store reverts, current behavior) using `navigator.onLine` + the fetch error.
- On reconnect (`online` event), **replay the queue in order**, then refetch to reconcile. Depends on Phase 0's client-generated IDs so a queued create and its later edits share one ID.
- Handle the two collection-level ops specially: `DELETE /api/groceries/clear-bought` (queue it), and `POST /api/archive` (no-op offline — it's triggered by a weekly server-side automation, not the user).
- Conflict model: **single user, replay-in-order, last write wins.** Queued mutations replay in the order they were made; whichever device syncs last wins. Note: entities carry only `createdAt` — there is no `updatedAt` field, so no timestamp comparison happens and none is needed. Real conflicts are rare (occasionally editing on two devices while one was offline). No merge engine.
- Add a small **online/offline + "pending changes" indicator** so it's visible when edits haven't synced yet.

## Edge cases & notes

- **Normalize-on-read** (due-soon promotion, weekly recurring reset, 30-day trash purge) runs server-side on read (`src/server/files.ts`). Offline these time-based housekeeping passes won't run until reconnect — acceptable; they re-run on the next successful fetch.
- **Cross-family effects** (completing a shopping-sourced task marks its shopping item bought) are issued as two independent mutations by the composing page — both queue and replay independently, no special handling.
- **Settings** writes are already fire-and-forget with a `localStorage` fallback; an offline settings change is simply re-pushed on next load. Optionally queue it too, but low priority.

## Recommendation

Ship **Phase 1 first as its own commit** — it's the biggest perceived win (the app stops being a blank screen offline), is self-contained, and carries little risk. Then Phase 2 (view offline), then Phase 3 (edit offline) with the client-ID change landing just before it. Each phase is independently shippable and testable.

**Rough effort:** Phase 1 ~half a day (mostly SW config + self-hosting fonts); Phase 2 ~half a day; Phase 3 ~1–1.5 days (queue, replay, reconnect handling, indicator, tests). The existing `Transport` seam and shared domain rules are what keep these estimates small.
