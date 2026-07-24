# Devlog

Running log of development on the todo app (Unstuck dashboard). Newest entries first.

**Convention:** one `## YYYY-MM-DD` section per working day. Keep entries short — what shipped, key decisions, and links to commits. The longer narrative history (sessions, open questions, decisions) lives in the parent workspace's `devlog.md`.

---

## 2026-07-24 — Architecture hardening

Codebase quality pass: extracted domain logic, added tooling, deepened the data layer.

- Documented the stores layer in AGENTS.md ([`7e4ccf8`](https://github.com/j-alicia-long/todo-now/commit/7e4ccf8))
- Per-family store hooks to deepen the client data seam ([`ed8d718`](https://github.com/j-alicia-long/todo-now/commit/ed8d718))
- ESLint + pre-commit hooks (husky, lint-staged, prettier); fixed all lint errors ([`f540c86`](https://github.com/j-alicia-long/todo-now/commit/f540c86), [`0a58054`](https://github.com/j-alicia-long/todo-now/commit/0a58054))
- Extracted Task lifecycle rules into a shared domain module ([`ed0ee22`](https://github.com/j-alicia-long/todo-now/commit/ed0ee22))
- Added CONTEXT.md domain glossary and first ADR ([`7f87092`](https://github.com/j-alicia-long/todo-now/commit/7f87092))
- Removed Small Win feature ([`c338076`](https://github.com/j-alicia-long/todo-now/commit/c338076)); added deployment instructions ([`1179da6`](https://github.com/j-alicia-long/todo-now/commit/1179da6)); shopping list item links ([`5415bd8`](https://github.com/j-alicia-long/todo-now/commit/5415bd8))

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
