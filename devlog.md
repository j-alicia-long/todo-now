# Devlog

Running log of development on the todo app (Unstuck dashboard). Newest entries first.

**Convention:** one `## YYYY-MM-DD` section per working day. Keep entries short — what shipped, key decisions, and links to commits. The longer narrative history (sessions, open questions, decisions) lives in the parent workspace's `history.md`.

---

## 2026-08-06 — Deploy script: git-pull is now the default

Tonight's deploy failed because the Mutagen sync was stalled, while `git pull` + `redeploy.sh` on Zo worked fine — so that's the default now. `deploy-zo.sh` git mode pulls pushed main onto Zo's checkout and redeploys (warns when the local tree is dirty or ahead of origin/main); the old Mutagen-nonce path survives behind `--sync` for deploying the local tree without pushing. DEPLOY.md updated.

---

## 2026-08-06 — Board move mode + card layout fixes

Decluttered board task cards. New "Move" pill toggle sits right-aligned in a `board-toolbar` row opposite the Columns/Matrix switcher (columns view only); the per-card arrow/archive buttons render only while it's on. Move mode also hides link pills and the area label, leaving just title + due date + move buttons. The toggle is deliberately unpersisted React state, so it resets to off whenever the board remounts (tab switch, reload). Card-row layout fixes: `.card-tags` now left-aligns (`flex-start`) so wrapped rows hug the left edge — date/links/clip always left, area pill right only when it shares a row; `.card-links` lost `flex-shrink: 0` so pills wrap instead of overflowing; `.card-actions` gets `align-self: flex-end` to pin move buttons bottom-right; the add-form date button now stretches to match the input/Add heights. This Month empty-state copy updated ("use the arrow" no longer visible by default).

---

## 2026-08-06 — Local deploy script (`scripts/deploy-zo.sh`)

Repurposed ai-carbon-footprint's `deploy-zo.sh` for this app: deploy to Zo straight from the local Mac without opening Zo chat. Unlike the carbon app's per-file `write_file` uploads (which would corrupt our binary assets), this one leans on the existing Mutagen sync — it writes a nonce file, polls Zo via the MCP `bash` tool until the sync catches up, then triggers the on-Zo `redeploy.sh` (passing through `--fast`). Needs `mcporter` + the Zo token at `~/.config/ai-cost-tracker/zo_token`. DEPLOY.md updated; `.deploy-nonce` gitignored.

---

## 2026-08-06 — Cards page column-shift fix + tied-pick polish

`/cards` UI polish: the cheat table now uses `table-layout: fixed` with viewport-relative column widths (22/36/42%, min-width 640px scrolling below that), so columns no longer shift when wallet chips are toggled — previously auto layout resized columns to content. Tied picks stack on separate lines instead of joining with "or", the mobile-wallet caveat collapses to a `contactless` icon (full text on hover), and the Everything-Else dual pick gets a line break too.

---

## 2026-08-01 — Pinned rates: Amex Plat wins cell phone

Reverses the earlier "ranking unchanged (perks never bump rates)" call: Jennifer prefers Amex Plat's $800/claim phone protection over Autograph's 3x, so the cell-phone recommendation should say Amex. Added an optional `pinned` flag to `EarnRate` — a pinned rate wins its category outright, before the rate/Strings tiebreaks — and set it on Amex's cell-phone rate. The judgment call lives in the data module next to the protection note; the engine stays generic. If Amex leaves the Wallet, cell phone falls back to the normal rate winner. Tests + CONTEXT.md/spec updated.

---

## 2026-08-01 — Rename "tap/no tap" to mobile wallet / physical card

"Tap" was ambiguous — physical credit cards can also tap, but USBAR's 3x specifically requires a mobile wallet (Apple Pay etc). Renamed throughout: the `tap-required` String kind is now `mobile-wallet-required`, the Everything-Else picks are `mobileWallet`/`physicalCard` (was `tap`/`noTap`), and the `/cards` page now labels the dual pick "(mobile wallet)" / "(physical card)". Docs (CONTEXT.md glossary, card-recommendations spec/tickets) updated to match.

---

## 2026-08-01 — Restore Amex Plat phone-protection note

The engine migration silently dropped a nuance from the old hand-written table: paying the cell phone bill with Amex Plat gets $800/claim phone protection (vs Autograph's $600) at the cost of 3x→1x. Restored it in the cell-phone Earn Rate note and the Amex Plat details card; ranking unchanged (perks never bump rates). `d7767ea`

---

## 2026-07-31 — Filterable card recommendations

The `/cards` cheat-sheet is no longer hand-written: card facts and a flat Earn Rate list live in `src/domain/card-rewards.ts`, and a pure recommendation engine (`src/domain/card-recommendations.ts`, tested at the engine seam with `bun test`) derives the best card per spend category — highest nominal rate among on-hand cards, ties broken by fewest Strings (runner-up shown tied-with-caveat), the USBAR mobile-wallet Wildcard suppressed wherever a clean equal-or-better card is on hand, and an Everything-Else tap/no-tap dual pick. A persisted `walletCards` setting drives a card-chip filter row (deselect a card you left at home; empty wallet shows a calm empty state), and an ephemeral Abroad chip excludes the FTF cards (BofA CCR, Freedom Unlimited) without touching the Wallet. Added Drugstores and Amazon/Walmart/Target categories; transferable-points cards get a badge. Built from the spec + ticket breakdown in `docs/card-recommendations/`.

---

## 2026-07-31 — Credit Cards reference page

New static reference page at `/cards`: a cheat-sheet table (purchase category → card → rate) and `<details>` dropdowns with per-card playbooks. Reachable only from the settings drawer ("Credit Cards" link); a home button in the page header returns to the board. Content distilled from the card-maximization guide.

Correction later the same day: the card is a **Chase Freedom Unlimited** (flat 1.5% + 3% dining/drugstores), not a rotating-category Chase Freedom — removed the 5%-quarter callout and hardcoded quarter map, added a drugstores row, and made CFU the "everything else (no tap)" pick.

---

## 2026-07-27 — Production data moved out of the synced tree

A broken-then-recreated Mutagen sync (Zo desktop app) let stale Mac copies overwrite the live `data/*.json` on Zo — Mutagen's re-created session had no baseline, so every differing file became a conflict and alpha (the Mac) won. Fix: production data now lives at `/home/workspace/todo-data/`, outside the synced `personal-os` tree ([`4f3b4d1`](https://github.com/j-alicia-long/todo-now/commit/4f3b4d1)). The server resolves its data dir as `DATA_DIR` env → `/home/workspace/todo-data` if it exists → `./data` (local dev/tests); the weekly archive follows. Migrated the live files, restarted the service, verified reads/writes hit the new location and the public site returns 200. Repo `data/` is now dev-only.

---

## 2026-07-27 — Default board view setting

Display Settings gains a **Default Board View** picker (Columns / Matrix) — a segmented pill reusing the board toggle styling — that chooses which view the Board tab opens in ([`5193481`](https://github.com/j-alicia-long/todo-now/commit/5193481)). Stored as `defaultBoardView` in server-synced settings (localStorage fallback); `useSettings` gains a generic `set()` and `toggle()` is now typed to boolean keys only. Verified with Playwright against the real server (data backed up/restored): setting persists and the Board opens straight into the Matrix after reload.

---

## 2026-07-27 — Matrix Triage shipped

Replaced the Matrix's Unsorted tray with **Triage**: a one-Task-at-a-time sorting modal. Spec + 6 tickets in `docs/matrix-triage/`, worked frontier-first, one commit per slice:

- **`triage-rules` domain module** ([`f974793`](https://github.com/j-alicia-long/todo-now/commit/f974793)): pure stack derivation (the Matrix partition's Unsorted list) and skip rotation (send-to-back, wraps); UI holds only skipped ids, never a task-list copy; 8 behavioral tests
- **Triage modal + keyboard** ([`9b8f97d`](https://github.com/j-alicia-long/todo-now/commit/9b8f97d)): auto-opens on every Matrix visit with Unsorted Tasks; full-detail active card with the stack peeking behind; keys 1–4 mirror the grid (S skips, Escape dismisses); floating "Sort N tasks" pill reopens it; sorts reuse `applyMatrixDrop` (ADR-0001 due-date writes included)
- **Tray removal** ([`d170af2`](https://github.com/j-alicia-long/todo-now/commit/d170af2)): Matrix grid goes full-width; the pill is the only Unsorted surface
- **Drag from the modal** ([`772619c`](https://github.com/j-alicia-long/todo-now/commit/772619c)): active card is a normal dnd-kit draggable; modal fades while dragging so the Quadrants show through; drop-outside is a no-op
- **Mobile corner swipe** ([`571409f`](https://github.com/j-alicia-long/todo-now/commit/571409f)): swipe toward a Quadrant's corner (up-left Do … down-right Reconsider) with finger-tracking tilt and spring-back below the 80px threshold

Glossary: _Triage_ added to `CONTEXT.md`; _Unsorted_ redefined (tray retired). All 137 tests pass; typecheck clean; verified on desktop + iPhone emulation with Playwright drag/swipe tests against real persistence (data backed up and restored).

---

## 2026-07-25 — Eisenhower Matrix shipped

Broke spec issue [#1](https://github.com/j-alicia-long/todo-now/issues/1) into 5 tracer-bullet tickets (`docs/eisenhower-matrix/`) and worked the chain end to end, one commit per slice:

- **`importance` field** ([`94d1c1f`](https://github.com/j-alicia-long/todo-now/commit/94d1c1f)): nullable binary field on Task (null = Unsorted), PUT-writable, defaults null, backfilled on read; no `urgency` field stored per ADR-0001
- **`matrix-rules` domain module** ([`4911c52`](https://github.com/j-alicia-long/todo-now/commit/4911c52)): pure rules for urgency (due ≤2 days or overdue, injected clock), Quadrant assignment, scoping, Unsorted, and the drop function; 16 behavioral tests
- **Matrix view** ([`7b2bdec`](https://github.com/j-alicia-long/todo-now/commit/7b2bdec)): Columns ↔ Matrix toggle on the Board tab; 2×2 grid + Unsorted tray reusing Task cards; per-cell empty states; mobile stacks with the tray first; verified with Playwright screenshots
- **Drag-to-triage** ([`6c84083`](https://github.com/j-alicia-long/todo-now/commit/6c84083)): Quadrants are drop targets; drops write importance and cross-boundary due dates (today+2 in / today+7 out) via the domain module; verified end-to-end with a Playwright drag test against real persistence (data backed up/restored). Desktop only — mobile triage gesture deferred (Board's no-touch-drag convention)
- **Docs** ([`86f1a7c`](https://github.com/j-alicia-long/todo-now/commit/86f1a7c)): README features + Task Model updated; todo-architecture.md gained a "The Matrix" requirements section

All 129 tests pass; typecheck and lint clean.

---

## 2026-07-25 — Public demo site

Shipped a shareable demo at **https://j-alicia-long.github.io/todo-now/** — the full app running serverless with sample data (no personal data).

- Demo mode via the transport seam: `VITE_DEMO=true` builds swap `httpTransport` for an in-memory `demo-transport.ts` that reuses the server's `FamilyConfig` hooks (`families.ts`) and `mergeWritable`, so demo CRUD behavior matches production exactly; state resets on reload
- `demo-data.ts` seeds relative-dated sample tasks/shopping/groceries/recurring so the board always looks current
- GitHub Actions workflow (`deploy-demo.yml`) builds with `--base=/todo-now/` and deploys to GitHub Pages on every push to `main`; router basename follows `BASE_URL` in demo builds; small "Demo — sample data" badge
- Verified locally with Playwright (board/shopping/groceries render, task completion and adding work, zero console errors); all 111 tests pass

---

## 2026-07-24 — Architecture hardening

Codebase quality pass: extracted domain logic, added tooling, deepened the data layer.

- Adopted shared [j-alicia-long/web-config](https://github.com/j-alicia-long/web-config) (new repo created today): ESLint preset as a bun git dependency plus a synced `web-conventions` agent skill; conventions that can be lint rules are, judgment calls live in the skill ([`3140856`](https://github.com/j-alicia-long/todo-now/commit/3140856), [`a186cca`](https://github.com/j-alicia-long/todo-now/commit/a186cca))
- Renamed all source files to kebab-case and enforced it via ESLint ([`8c183ae`](https://github.com/j-alicia-long/todo-now/commit/8c183ae))
- Modeled the planned **Eisenhower Matrix** feature via domain modeling: Matrix/Importance/Urgency/Quadrant/Unsorted terms added to `CONTEXT.md`, plus ADR 0001 (urgency is derived from due dates, never stored)

- Deepened the server with a generic per-family resource module: one `createResourceRoutes` call per list family replaces twenty near-identical CRUD handlers; persistence behind an injected `ListStore` seam, family rules as pure `construct`/`applyUpdate`/`applyRemove` hooks with writable-field whitelists; server.ts 730 → 270 lines; route + family-config tests (15 new) ([`0e1188a`](https://github.com/j-alicia-long/todo-now/commit/0e1188a))
- Dropped the retired `priority` field from Tasks (schema, whitelist, fixtures, dead styles) with a read-migration stripping stored rows; the Matrix will start all Tasks Unsorted ([`8d393f0`](https://github.com/j-alicia-long/todo-now/commit/8d393f0))

- Reworked recurrence scheduling: due dates land on the occurrence day, new `showEarlyDays` field controls Board lead time (defaults 14d long-term / 0d weekly), and completing a long-term item auto-advances its dueDate with endsOn/endsAfter enforcement ([`7b7d971`](https://github.com/j-alicia-long/todo-now/commit/7b7d971))
- Split the page into one component per view: `src/pages/` → `src/tabs/`, TodoPage → TodoBase (a ~460-line controller), with BoardTab (owns drag-and-drop), ShoppingTab, GroceriesTab, RecurringTab, RecurringModal (owns its form state), and SidebarDrawer each deriving their own view slices
- Decomposed TodoPage (~2,900 → ~1,225 lines) into `src/components/`: shared UI primitives and presentation helpers, then Board cards, then list rows and settings; components with 3+ callbacks take narrow action-handle objects (`TaskActions`, `RecurringCardActions`, `ShoppingItemActions`, …) instead of prop drilling ([`68080f7`](https://github.com/j-alicia-long/todo-now/commit/68080f7))
- Extracted Week & recurrence rules into a pure shared domain module `src/domain/recurrence.ts` with injected clock, 36 tests ([`5c5fd2a`](https://github.com/j-alicia-long/todo-now/commit/5c5fd2a))
- Documented the stores layer in AGENTS.md ([`7e4ccf8`](https://github.com/j-alicia-long/todo-now/commit/7e4ccf8))
- Per-family store hooks to deepen the client data seam ([`ed8d718`](https://github.com/j-alicia-long/todo-now/commit/ed8d718))
- ESLint + pre-commit hooks (husky, lint-staged, prettier); fixed all lint errors ([`f540c86`](https://github.com/j-alicia-long/todo-now/commit/f540c86), [`0a58054`](https://github.com/j-alicia-long/todo-now/commit/0a58054))
- Extracted Task lifecycle rules into a shared domain module ([`ed0ee22`](https://github.com/j-alicia-long/todo-now/commit/ed0ee22))
- Added CONTEXT.md domain glossary and first ADR ([`7f87092`](https://github.com/j-alicia-long/todo-now/commit/7f87092))
- Removed Small Win feature ([`c338076`](https://github.com/j-alicia-long/todo-now/commit/c338076)); added deployment instructions ([`1179da6`](https://github.com/j-alicia-long/todo-now/commit/1179da6)); shopping list item links, add-to-board success checkmark, and a Done-column timezone fix (grouping now uses local dates, not UTC) ([`5415bd8`](https://github.com/j-alicia-long/todo-now/commit/5415bd8))

## 2026-07-20 — Calendar & recurring fixes

- Fixed recurring board filtering, added inline calendar date picker, fixed calendar height ([`e6675c6`](https://github.com/j-alicia-long/todo-now/commit/e6675c6))

## 2026-07-16 — Recurring tab buildout & polish

Iterated the Recurring tab into its settled form.

- Two-column layout, edit modal, recurrence picker, Done column ([`336b26c`](https://github.com/j-alicia-long/todo-now/commit/336b26c))
- Simplified fields (dropped priority/effort/decision), added due date & area, auto-sort long-term section ([`1aa7096`](https://github.com/j-alicia-long/todo-now/commit/1aa7096))
- Visual cleanup: neutral columns, purple events theme ([`1f1bc8a`](https://github.com/j-alicia-long/todo-now/commit/1f1bc8a), [`0a13055`](https://github.com/j-alicia-long/todo-now/commit/0a13055))
- Mobile fixes: scroll, hidden tab labels, modal form ([`8bce007`](https://github.com/j-alicia-long/todo-now/commit/8bce007))

## 2026-07-15 — Shopping board, Recurring tab, UI theme

Big feature day: shopping list redesign, new Recurring tab, and the purple visual theme.

- Shopping wants/needs columns, done section, grocery clear button ([`87e129d`](https://github.com/j-alicia-long/todo-now/commit/87e129d)); later 3-col layout with grocery column ([`714024a`](https://github.com/j-alicia-long/todo-now/commit/714024a))
- New Recurring tab with weekly and long-term sections ([`969db96`](https://github.com/j-alicia-long/todo-now/commit/969db96)) plus link hub ([`5b7ebdd`](https://github.com/j-alicia-long/todo-now/commit/5b7ebdd))
- Auto-promote due tasks and weekly archive of old done items ([`49762c8`](https://github.com/j-alicia-long/todo-now/commit/49762c8))
- UI theme: purple accent, pastel due date labels, 4px radius ([`0587818`](https://github.com/j-alicia-long/todo-now/commit/0587818), [`152c863`](https://github.com/j-alicia-long/todo-now/commit/152c863))
- Fixed calendar today/selected highlights (react-aria selectors) ([`ff42c0f`](https://github.com/j-alicia-long/todo-now/commit/ff42c0f)); added missing project files ([`74045d6`](https://github.com/j-alicia-long/todo-now/commit/74045d6))

## 2026-07-14 — Repo created

- Initial commit ([`c8c0354`](https://github.com/j-alicia-long/todo-now/commit/c8c0354))
