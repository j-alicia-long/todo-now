# Devlog

Running log of development on the todo app (Unstuck dashboard). Newest entries first.

**Convention:** one `## YYYY-MM-DD` section per working day. Keep entries short — what shipped, key decisions, and links to commits. The longer narrative history (sessions, open questions, decisions) lives in the parent workspace's `history.md`.

---

## 2026-08-13 — Board setting to hide recurring cards (#38)

- New Settings toggle "Hide recurring tasks" (Board section): hides all recurring task cards from the Board's columns view, including completed ones in Done. Recurring generation and the Recurring tab are untouched — this is purely board visibility.
- Follows the existing settings pattern: `hideRecurringOnBoard` on the `Settings` type, default `false` in `DEFAULT_SETTINGS` (so existing users whose stored settings lack the key keep seeing recurring cards), synced via `/api/settings`. Board gating is one conditional in `BoardTab`; covered by new component tests (`board-tab.test.tsx`).

---

## 2026-08-13 — Cloudflare Workers runtime port (migration Phase 1)

- The server now runs as a Cloudflare Worker: `server.ts` is the Workers entry (composes adapters from `env` bindings, exports `fetch`); all routes moved into `createApp(deps)` in `src/server/app.ts` behind injected seams. Zo's Bun runtime is dead, so this unblocks the move (`docs/cloudflare-migration/spec.md`, ADR 0002).
- New adapters: `d1.ts` (blob-per-Family — one `families(name, json)` row per list; Settings and the archive are rows too), `r2.ts` (raw Reports, same-minute filename de-collision preserved), and `github.ts` now `fetch`es `POST /repos/{repo}/issues` with a Workers-secret token instead of spawning the `gh` CLI (token absent → no-op, as before).
- Pure normalize/migrate logic extracted from `files.ts` into storage-agnostic `normalize.ts`; the file adapters stay for tooling and the Phase 2 import. All 235 tests green, domain rules untouched.
- Local dev/preview run the Worker in workerd via `@cloudflare/vite-plugin` with Miniflare's local D1/R2 (`bun run dev`) — no real Cloudflare resources yet; account setup, data import, and Access are Phases 2–3. The GitHub Pages demo build skips the plugin (`VITE_DEMO`) and stays static.

---

- Board cards now get a very slight tint on hover — purple for task and shopping cards, green for grocery — layered over each card's own background so the base color still reads through.
- Implemented with a per-variant `--hover-tint` custom property consumed by one `&:hover` rule (avoids a specificity fight between the default purple and grocery's green). Recurring / future / trash cards set the tint to `transparent` so they keep their own look. New `--card-hover-tint` / `--grocery-hover-tint` tokens in `styles.scss` for light + dark.

---

## 2026-08-13 — Reporter highlights: track the visual viewport under zoom (#34)

- On iOS the page pans + scales the *visual* viewport (pinch, or auto-zoom when focusing a small-font input), but `position: fixed` highlight boxes were placed straight from `getBoundingClientRect()` (layout-viewport coords) with no correction, so they drifted off their targets when zoomed.
- The measure loop also only listened to `document` scroll and `window` resize — iOS reports zoom pan/scale on `window.visualViewport`, so the boxes never re-measured mid-zoom.
- Fix: subscribe to `visualViewport` `resize`/`scroll`, and convert each rect to visual-viewport space (`(coord − offset) × scale`). The transform is an identity when unzoomed, so desktop/unzoomed behavior is unchanged. Needs an on-device iOS check to confirm alignment.

---

## 2026-08-13 — Recurrence number inputs: allow empty while typing (#33)

- The "Repeat every" input snapped back to `1` on every keystroke — `Math.max(1, parseInt(e.target.value) || 1)` ran in `onChange`, so clearing the field to retype a single digit immediately refilled it. The "After N occurrences" input had the same defect.
- Switched both to string-backed state (`repeatEveryInput` / `endsAfterInput`) so the field can go momentarily empty; the clamped numeric value is derived for submit + pluralization, and `onBlur` normalizes the text back to a valid number. Mirrors the existing `showEarly` pattern.

---

## 2026-08-12 — Pin card pills to one height (constant, bottom-aligned rows)

- Follow-up to `2befb56`: shrinking the Move-mode buttons removed the *reserved* extra space, but the label pills still read as bottom-padded. Root cause was two things the earlier fix didn't touch — (1) `.card-tag` variants had no fixed height, so each font size / border combination measured differently (area 20.8px vs. due 22.8px vs. Done subtext 18.3px), and (2) `.card-row` was `align-items: center`, so a shorter pill floated mid-row with visible slack beneath it
- Introduced a `--card-pill-height: 20px` token in `styles.scss` and pinned every pill that shares the card row to it — `.card-tag` (now `inline-flex` + `line-height: 1`, vertical padding dropped), `.card-due-subtext`, `.link-pill` / `.link-pill.add` / `.link-pill-input`, and `.card-row .card-action-btn`
- Switched `.card-row` and `.card-tags` to `align-items: flex-end` so pills bottom-align within the row, per the report
- Result: every single-line card row is exactly 20px (was 20 / 20.8 / 22.8 depending on which pills a card had) and wrapped rows are exact multiples (44px, 68px). Row height is now identical with Move mode on and off — verified in-browser across 34 sample cards
- Reports: `2026-08-10-2146-now-there-s-too-much-space-on-the-labels.md`, `2026-08-11-1849-the-labels-still-have-extra-bottom-paddi.md`

---

## 2026-08-11 — Reports file as GitHub issues (hybrid)

- Each Report now files as a **GitHub issue** (label `bug`/`idea`) alongside its local Markdown file — issues are the tracker (close = resolved), the file is the full-fidelity companion; they link to each other via `issue:` frontmatter and a body backlink
- New pure sanitizer (`src/server/sanitize.ts`): issue snippets get text nodes and text-bearing attributes masked with **same-length** `x` placeholders (layout bugs stay diagnosable); tags/ids/classes/selectors/SVG geometry pass through — the repo is public, raw snippets never leave the machine
- New `IssueCreator` seam + `gh`-CLI adapter (`github.ts`); file always saves first (`issue: pending` if filing fails/disabled), so no report is ever lost. Dev default: filing off; `REPORTS_REPO` env or production enables
- Reports folder flattened (no more `open/`/`resolved/` — status lives on the issue); triage keys became repo labels (P0–P2, Large/Medium/Small), documented in `docs/TRIAGE.md`; daily triage automation prompt updated to work from issues
- Verified end-to-end against the real repo (issue #14, closed)

---

## 2026-08-11 — Shrink Move-mode buttons to match tag height

- Board task cards reserved a full 26px row height for the move-action buttons (18px icon + 2×4px padding), leaving too much empty space around the label pills when Move mode was off. Reduced the move buttons to tag height instead — scoped `.card-row .card-action-btn` to `padding: 1px 8px` + 16px icon, and dropped `.card-row` `min-height` from 26px to 20px. Scoped to `.card-row` so trash/future-card action buttons are unaffected
- Report: `2026-08-10-2146-now-there-s-too-much-space-on-the-labels.md`

---

## 2026-08-10 — Settings toggle to hide the report button (PR)

- New "Report button" toggle in Settings → Bug Reports hides the floating bug button; Report Mode stays reachable via ⌘⇧P (desktop) or shake (mobile)
- Added `showReportButton` (default true) to Settings; `Reporter` gains a `showLauncher` prop gating the launcher
- Report: `2026-08-09-1719-add-settings-page-toggle-to-show-hide-bu.md`

---

## 2026-08-10 — Remove unwired Tailwind + shadcn scaffolding (PR)

- The app is SCSS-only and Tailwind was never wired into the build (no `@tailwindcss/vite` plugin, `components.json` pointed at a non-existent `src/styles.css`), so its toolchain was dead weight
- Removed deps: `@tailwindcss/vite`, `@tailwindcss/typography`, `tailwindcss`, `tw-animate-css`, `shadcn`, `tailwind-merge`, `clsx`; deleted `components.json` and `src/lib/utils.ts` (`cn`)
- Rebuilt `KeyHint` (the last kit component using Tailwind classes) with plain SCSS classes (`.key-hint*` in `todo-base.scss`) — chips now render as proper bordered keycaps (previously the Tailwind classes were inert)
- typecheck, lint, build, and tests all pass; verified visually in the demo build
- Report: `2026-08-10-0041-tech-debt-unwired-tailwind-shadcn-scaffolding.md`

---

## 2026-08-10 — Remove orphaned deps (lucide-react, class-variance-authority)

- Both deps had zero importers after the dead design-kit/shadcn cleanup; removed from `package.json` (lockfile updated via `bun install`). typecheck, build, lint, and tests all pass
- Report: `2026-08-10-0041-tech-debt-remove-orphaned-deps-lucide-cva.md`

---

## 2026-08-10 — KeyHint shows "+" between keys

- Multi-key shortcuts in Settings (e.g. Shift Enter) rendered as adjacent chips with no separator; `KeyHint` now inserts a muted "+" between chips ("Shift + Enter")
- Report: `2026-08-09-1705-add-between-key-commands.md`

---

## 2026-08-10 — Header icon uses theme purple

- The board header's leaf (`eco`) icon was hard-coded green (`--success`); recolored it to the theme's purple accent (`--accent`) to match the app theme
- Report: `2026-08-09-1528-make-this-purple-like-the-theme.md`

---

## 2026-08-10 — Fix Move-mode row height jitter

- Toggling Move mode no longer shifts card/row height: reserved the move-action button height (26px) on `.card-row` (Board) and `.list-item-sub` (Shopping) via `min-height`, so the row stays the same height whether or not the buttons are shown
- Report: `2026-08-10-0156-the-task-item-vertical-height-jitters-wh.md`

---

## 2026-08-10 — Offline mode (spec #4, tickets #5–#10)

- The app now works with no network: the shell loads (Workbox service worker via vite-plugin-pwa, self-hosted Inter + Material Symbols), lists render from an IndexedDB read cache, and checking off / creating / editing / deleting all work offline
- Offline mutations queue in order (persisted in IndexedDB, survive reload) and replay automatically on reconnect, then every list refetches (`todo:synced`); server 4xx/5xx still throws and reverts. Conflict model: single user, replay-in-order, last write wins
- Creates are now optimistic everywhere (instant even online): built client-side from shared construction defaults (`src/domain/construct.ts`, honors client `id`/`createdAt`), POSTed whole, reconciled in the background — ADR 0002
- New sync badge: "Offline — N unsynced changes" whenever queued changes exist (even back online), "Syncing N changes…" during replay, then a 2s "All changes synced" flash once the queue drains; sync failure keeps the unsynced badge
- All at the existing `Transport` seam — a third adapter (`offline-transport.ts`) wrapping HTTP, storage + connectivity injected; 206 tests (32 new), each ticket Playwright-verified offline
- Commits `ba50256` (#5), `625a55b` (#6), `68b9926` (#7), `4f49ba2` (#8), `c23249c` (#9), + indicator (#10)

---

## 2026-08-09 — Shopping move mode + shared MoveActionButton (PR)

- Shopping tab gains a "Move" toggle (mirrors the Board); the per-item archive and category-move (chevron) buttons now appear only in move mode
- Extracted a shared `MoveActionButton` (in `ui.tsx`, styled via `.card-action-btn`) and reused it in both `task-card` (Board) and `shopping-items` — no duplicated markup
- Report: `2026-08-09-0659-show-only-in-move-mode-just-like-on-the.md`

---

## 2026-08-09 — Hide done tasks completed >7 days ago (PR)

- The Board's Done column now shows only tasks completed within the last 7 days; older ones are hidden (display-only — not trashed or deleted)
- New pure helper `isRecentlyDone(task, now)` + `DONE_VISIBLE_MS` in `task-rules.ts` (tasks with no `completedAt` stamp are always kept); `board-tab` filters the Done column through it
- 4 unit tests added
- Report: `2026-08-09-0829-hide-done-tasks-completed-more-than-7-da.md`

---

## 2026-08-09 — Floating bug button (Reporter launcher)

- Persistent accent FAB (bug icon) in the bottom-right opens Report Mode on tap — a reliable mobile entry point that doesn't depend on device-motion permissions
- Positioned to match the in-mode report FAB, so tapping transitions seamlessly into the same spot
- MVP shipped in place of the unreliable shake-to-report on mobile; shake wiring left intact
- Report: `2026-08-09-0827-shake-to-report-does-not-work-on-mobile-b.md`

---

## 2026-08-09 — Keyboard Shortcuts section in Settings

- Settings panel gains a "Keyboard Shortcuts" section listing the app's real shortcuts (Report Mode open/compose/save/exit, Matrix triage sort/skip)
- Keycaps reuse the existing `KeyHint` kit component; modifier shown as ⌘ on Mac, Ctrl elsewhere
- Also added top spacing between stacked settings sections (`.settings-title:not(:first-child)`)
- Report: `2026-08-09-0829-add-keyboard-shortcut-menu-to-settings-p.md`

---

## 2026-08-09 — Reporter keyboard shortcuts: Enter opens compose, Shift+Enter saves

- While picking Targets, pressing **Enter** now opens the compose modal (previously only the FAB did)
- Inside the compose modal, **Shift+Enter** saves the report (plain Enter still adds a newline in the note)
- Added a `phaseRef` to gate the global Enter handler to picking mode only
- Report: `2026-08-09-0700-reporter-enter-key-should-open-the-repor.md`

---

## 2026-08-09 — Hide the add-link button on Done tasks (P2 bug)

- Done task cards no longer show the `+ attach_file` pill; existing links stay visible and clickable
- `LinkPills` gains an optional `canAdd` prop (default `true`); `TaskCard` passes `canAdd={!task.done}`
- Report: `2026-08-09-0653-don-t-show-these-on-tasks-in-done-col-ex.md`

---

## 2026-08-09 — Reporter target-ids reuse freed numbers (P1 bug)

- Selecting then deselecting Targets used to leave a monotonic counter climbing (`t1`→`t2`→…), so a fresh selection after a deselect got `t10` instead of `t1`
- `toggleTargetAt` now computes the lowest unused `t{n}` from the current Targets instead of a `nextIdRef` counter; deselecting a Target frees its id for reuse
- Report: `2026-08-09-0657-reporter-bug-when-i-select-and-deselect.md`

---

## 2026-08-09 — paths-ignore widened to all non-site files

- Both workflows now also skip deploys for `.gitignore`, `.github/**` (workflows themselves — use workflow_dispatch to test workflow edits), `.husky/**`, lint/format configs (`.lintstagedrc`, `.prettierrc`, `.prettierignore`, `eslint.config.js`, `stylelint.config.js`), and `scripts/**`
- Deliberately still deploying on: `tsconfig.json` (path aliases affect the build), `bunfig.toml`, `package.json`, `components.json`, `zosite.json`, `redeploy.sh` (runs on Zo)

---

## 2026-08-09 — Deploys log + auto-stash before the reset

- Both deploy paths (`deploy-zo.yml`, `scripts/deploy-zo.sh`) now run `git status --short` + `git stash push --include-untracked -m pre-deploy-autostash` before `git reset --hard` in the deploy clone
- Nothing should ever write to `/home/workspace/repos/todo`, so instead of silently bulldozing surprises, the deploy preserves them as evidence (`git stash list` on Zo)
- Ignored files (`dist/`, `node_modules/`) are untouched; a clean tree makes the stash a no-op

---

## 2026-08-09 — Reports move into the Mutagen sync so Mac agents can see them

- Reporter output was landing in `/home/workspace/todo-data/reports/` on Zo — invisible to Mac-side dev agents, so the "check open reports" rule only worked on Zo
- Considered committing reports to the repo or filing GitHub issues; both rejected — the repo is public and snippets contain personal task text
- New home: `personal-os/02-projects/todo-app/reports/{open,resolved}/`, inside the Mac↔Zo Mutagen sync — safe here (unlike the repo clobbering) because each report has one writer per phase: Zo creates, file is immutable, Mac moves to `resolved/`
- Server resolution order: `REPORTS_DIR` env → the Zo synced-tree path if it exists → `<dataDir>/reports` (local dev/tests)
- `reports/AGENTS.md` documents the workflow and sync edge cases (union-merge duplicates: `resolved/` wins)

---

- Both GitHub Actions workflows (`Deploy to Zo`, GitHub Pages demo) gain `paths-ignore` for `**.md` and `docs/**` — a push touching only docs no longer redeploys anything; mixed pushes still deploy, and workflow_dispatch remains for forcing one
- `devlog.md` moved to `docs/devlog.md`; dense paragraph entries reformatted as bullets; references updated (AGENTS.md, roadmap, handoff, DEPLOY.md)

---

## 2026-08-09 — Repo escapes the Mutagen sync: Zo clone moves to /home/workspace/repos/todo

Structural fix for the stale-build/clobber class of bugs: the repo no longer lives inside the Mac↔Zo synced `personal-os` tree on either side.

- Zo's clone moves to `/home/workspace/repos/todo` (outside the sync root); the Mac clone moves to `~/Documents/repos/todo` with a symlink left at the old path
- Mutagen never follows symlinks, and its portable mode won't propagate an absolute one — so git + GitHub is now the _only_ channel between the two clones, and a deploy's `reset --hard` on Zo can never sync back and wipe uncommitted Mac edits
- Repointed `redeploy.sh`, `deploy-zo.yml`, and `deploy-zo.sh` at the new Zo path
- Removed `deploy-zo.sh --sync` (the Mutagen-nonce deploy path) — physically impossible once the repo is outside the sync, and it was a footgun by design
- DEPLOY.md updated

---

## 2026-08-09 — Deploy fix: force Zo checkout to match GitHub main

- Zo deploys were silently failing ("Deploy to Zo" action red since the Reporter push): the Mac↔Zo folder sync copies in-progress local edits into Zo's working tree as uncommitted changes, so the deploy's `git pull --ff-only` aborted with "local changes would be overwritten"
- The live site was stuck on a pre-Aug-6 build (no Move pill, no link paperclips, no Reporter)
- Fix: deploy now runs `git fetch origin main && git reset --hard FETCH_HEAD` (GitHub is the source of truth; untracked/ignored files like `data/` are untouched) in both `.github/workflows/deploy-zo.yml` and `scripts/deploy-zo.sh`

---

## 2026-08-09 — In-app bug Reporter (shake / ⌘⇧P → highlight → Markdown file)

New Reporter feature: shake the phone (or ⌘⇧P on desktop) to file a bug or idea from inside the app.

- Report Mode: a slight dim overlay where taps select elements as Targets (glowing highlight, `tN` label) instead of operating the app; a floating bug button opens a compose modal with a Bug/Idea toggle and target chips that insert Mention chips inline in the note
- Submitting POSTs to the new write-only `/api/reports`, which renders Markdown (frontmatter Page Context + note with `[tN]` tokens + per-Target selector/snippet sections) into `data/reports/open/` — gitignored, since snippets can contain personal task text; agents resolve a report by moving it to `data/reports/resolved/`
- New modules: `src/domain/report.ts` (shared types), `src/lib/report-capture.ts` (selector/snippet capture, note serialization), `src/lib/use-shake.ts` (devicemotion shake detection + iOS permission), `src/components/reporter.tsx`, `src/server/reports.ts` (validation/rendering/route behind a `ReportWriter` seam)
- "Shake to report" toggle in Settings requests iOS motion permission
- Domain terms (Report, Kind, Target, Mention, Report Mode, Open/Resolved) added to CONTEXT.md
- Tested: unit (rendering, filenames, route, capture, serialization) + Playwright E2E

---

## 2026-08-07 — Auto-deploy to Zo on push (GitHub Action)

Push to main now deploys the live site — no manual script run needed.

- New `Deploy to Zo` workflow (`.github/workflows/deploy-zo.yml`) does exactly what `deploy-zo.sh` git mode did: calls the Zo MCP `bash` tool via `npx mcporter` to `git pull --ff-only` + `./redeploy.sh` on Zo, then curl-checks the live URL for HTTP 200
- Zo API token lives in the `ZO_TOKEN` repo secret; `concurrency: deploy-zo` serializes overlapping pushes
- `deploy-zo.sh` stays as the manual fallback; DEPLOY.md updated

---

## 2026-08-06 — Deploy script: git-pull is now the default

Tonight's deploy failed because the Mutagen sync was stalled, while `git pull` + `redeploy.sh` on Zo worked fine — so that's the default now.

- `deploy-zo.sh` git mode pulls pushed main onto Zo's checkout and redeploys (warns when the local tree is dirty or ahead of origin/main)
- The old Mutagen-nonce path survives behind `--sync` for deploying the local tree without pushing
- DEPLOY.md updated

---

## 2026-08-06 — Board move mode + card layout fixes

Decluttered board task cards.

- New "Move" pill toggle sits right-aligned in a `board-toolbar` row opposite the Columns/Matrix switcher (columns view only); the per-card arrow/archive buttons render only while it's on
- Move mode also hides link pills and the area label, leaving just title + due date + move buttons
- The toggle is deliberately unpersisted React state, so it resets to off whenever the board remounts (tab switch, reload)
- Card-row layout fixes: `.card-tags` now left-aligns (`flex-start`) so wrapped rows hug the left edge — date/links/clip always left, area pill right only when it shares a row; `.card-links` lost `flex-shrink: 0` so pills wrap instead of overflowing; `.card-actions` gets `align-self: flex-end` to pin move buttons bottom-right
- The add-form date button now stretches to match the input/Add heights
- This Month empty-state copy updated ("use the arrow" no longer visible by default)

---

## 2026-08-06 — Local deploy script (`scripts/deploy-zo.sh`)

Repurposed ai-carbon-footprint's `deploy-zo.sh` for this app: deploy to Zo straight from the local Mac without opening Zo chat.

- Unlike the carbon app's per-file `write_file` uploads (which would corrupt our binary assets), this one leans on the existing Mutagen sync — it writes a nonce file, polls Zo via the MCP `bash` tool until the sync catches up, then triggers the on-Zo `redeploy.sh` (passing through `--fast`)
- Needs `mcporter` + the Zo token at `~/.config/ai-cost-tracker/zo_token`
- DEPLOY.md updated; `.deploy-nonce` gitignored

---

## 2026-08-06 — Cards page column-shift fix + tied-pick polish

`/cards` UI polish:

- The cheat table now uses `table-layout: fixed` with viewport-relative column widths (22/36/42%, min-width 640px scrolling below that), so columns no longer shift when wallet chips are toggled — previously auto layout resized columns to content
- Tied picks stack on separate lines instead of joining with "or"
- The mobile-wallet caveat collapses to a `contactless` icon (full text on hover), and the Everything-Else dual pick gets a line break too

---

## 2026-08-01 — Pinned rates: Amex Plat wins cell phone

Reverses the earlier "ranking unchanged (perks never bump rates)" call: Jennifer prefers Amex Plat's $800/claim phone protection over Autograph's 3x, so the cell-phone recommendation should say Amex.

- Added an optional `pinned` flag to `EarnRate` — a pinned rate wins its category outright, before the rate/Strings tiebreaks — and set it on Amex's cell-phone rate
- The judgment call lives in the data module next to the protection note; the engine stays generic
- If Amex leaves the Wallet, cell phone falls back to the normal rate winner
- Tests + CONTEXT.md/spec updated

---

## 2026-08-01 — Rename "tap/no tap" to mobile wallet / physical card

"Tap" was ambiguous — physical credit cards can also tap, but USBAR's 3x specifically requires a mobile wallet (Apple Pay etc).

- Renamed throughout: the `tap-required` String kind is now `mobile-wallet-required`, the Everything-Else picks are `mobileWallet`/`physicalCard` (was `tap`/`noTap`), and the `/cards` page now labels the dual pick "(mobile wallet)" / "(physical card)"
- Docs (CONTEXT.md glossary, card-recommendations spec/tickets) updated to match

---

## 2026-08-01 — Restore Amex Plat phone-protection note

- The engine migration silently dropped a nuance from the old hand-written table: paying the cell phone bill with Amex Plat gets $800/claim phone protection (vs Autograph's $600) at the cost of 3x→1x
- Restored it in the cell-phone Earn Rate note and the Amex Plat details card; ranking unchanged (perks never bump rates) `d7767ea`

---

## 2026-07-31 — Filterable card recommendations

The `/cards` cheat-sheet is no longer hand-written: card facts and a flat Earn Rate list live in `src/domain/card-rewards.ts`, and a pure recommendation engine derives the best card per spend category.

- Engine (`src/domain/card-recommendations.ts`, tested at the engine seam with `bun test`): highest nominal rate among on-hand cards, ties broken by fewest Strings (runner-up shown tied-with-caveat), the USBAR mobile-wallet Wildcard suppressed wherever a clean equal-or-better card is on hand, and an Everything-Else tap/no-tap dual pick
- A persisted `walletCards` setting drives a card-chip filter row (deselect a card you left at home; empty wallet shows a calm empty state)
- An ephemeral Abroad chip excludes the FTF cards (BofA CCR, Freedom Unlimited) without touching the Wallet
- Added Drugstores and Amazon/Walmart/Target categories; transferable-points cards get a badge
- Built from the spec + ticket breakdown in `docs/card-recommendations/`

---

## 2026-07-31 — Credit Cards reference page

- New static reference page at `/cards`: a cheat-sheet table (purchase category → card → rate) and `<details>` dropdowns with per-card playbooks
- Reachable only from the settings drawer ("Credit Cards" link); a home button in the page header returns to the board
- Content distilled from the card-maximization guide
- Correction later the same day: the card is a **Chase Freedom Unlimited** (flat 1.5% + 3% dining/drugstores), not a rotating-category Chase Freedom — removed the 5%-quarter callout and hardcoded quarter map, added a drugstores row, and made CFU the "everything else (no tap)" pick

---

## 2026-07-27 — Production data moved out of the synced tree

- A broken-then-recreated Mutagen sync (Zo desktop app) let stale Mac copies overwrite the live `data/*.json` on Zo — Mutagen's re-created session had no baseline, so every differing file became a conflict and alpha (the Mac) won
- Fix: production data now lives at `/home/workspace/todo-data/`, outside the synced `personal-os` tree ([`4f3b4d1`](https://github.com/j-alicia-long/todo-now/commit/4f3b4d1))
- The server resolves its data dir as `DATA_DIR` env → `/home/workspace/todo-data` if it exists → `./data` (local dev/tests); the weekly archive follows
- Migrated the live files, restarted the service, verified reads/writes hit the new location and the public site returns 200; repo `data/` is now dev-only

---

## 2026-07-27 — Default board view setting

- Display Settings gains a **Default Board View** picker (Columns / Matrix) — a segmented pill reusing the board toggle styling — that chooses which view the Board tab opens in ([`5193481`](https://github.com/j-alicia-long/todo-now/commit/5193481))
- Stored as `defaultBoardView` in server-synced settings (localStorage fallback); `useSettings` gains a generic `set()` and `toggle()` is now typed to boolean keys only
- Verified with Playwright against the real server (data backed up/restored): setting persists and the Board opens straight into the Matrix after reload

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

---

## 2026-07-20 — Calendar & recurring fixes

- Fixed recurring board filtering, added inline calendar date picker, fixed calendar height ([`e6675c6`](https://github.com/j-alicia-long/todo-now/commit/e6675c6))

---

## 2026-07-16 — Recurring tab buildout & polish

Iterated the Recurring tab into its settled form.

- Two-column layout, edit modal, recurrence picker, Done column ([`336b26c`](https://github.com/j-alicia-long/todo-now/commit/336b26c))
- Simplified fields (dropped priority/effort/decision), added due date & area, auto-sort long-term section ([`1aa7096`](https://github.com/j-alicia-long/todo-now/commit/1aa7096))
- Visual cleanup: neutral columns, purple events theme ([`1f1bc8a`](https://github.com/j-alicia-long/todo-now/commit/1f1bc8a), [`0a13055`](https://github.com/j-alicia-long/todo-now/commit/0a13055))
- Mobile fixes: scroll, hidden tab labels, modal form ([`8bce007`](https://github.com/j-alicia-long/todo-now/commit/8bce007))

---

## 2026-07-15 — Shopping board, Recurring tab, UI theme

Big feature day: shopping list redesign, new Recurring tab, and the purple visual theme.

- Shopping wants/needs columns, done section, grocery clear button ([`87e129d`](https://github.com/j-alicia-long/todo-now/commit/87e129d)); later 3-col layout with grocery column ([`714024a`](https://github.com/j-alicia-long/todo-now/commit/714024a))
- New Recurring tab with weekly and long-term sections ([`969db96`](https://github.com/j-alicia-long/todo-now/commit/969db96)) plus link hub ([`5b7ebdd`](https://github.com/j-alicia-long/todo-now/commit/5b7ebdd))
- Auto-promote due tasks and weekly archive of old done items ([`49762c8`](https://github.com/j-alicia-long/todo-now/commit/49762c8))
- UI theme: purple accent, pastel due date labels, 4px radius ([`0587818`](https://github.com/j-alicia-long/todo-now/commit/0587818), [`152c863`](https://github.com/j-alicia-long/todo-now/commit/152c863))
- Fixed calendar today/selected highlights (react-aria selectors) ([`ff42c0f`](https://github.com/j-alicia-long/todo-now/commit/ff42c0f)); added missing project files ([`74045d6`](https://github.com/j-alicia-long/todo-now/commit/74045d6))

---

## 2026-07-14 — Repo created

- Initial commit ([`c8c0354`](https://github.com/j-alicia-long/todo-now/commit/c8c0354))
