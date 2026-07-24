# Todo App (Unstuck Dashboard)

React PWA hosted as a Zo Site. Jennifer's personal task/shopping/grocery manager, built during the Fractal Accelerator (Jul 2026).

## Tech stack

- React + Vite + Bun + SASS (not Tailwind — Jennifer's explicit preference)
- Hono API routes (server.ts)
- JSON file storage in data/ (tasks.json, shopping.json, groceries.json, recurring.json, settings.json)
- Material Design icons (google material-symbols/outlined)
- react-aria-components for date picker / calendar

## Architecture

- Frontend: single-page app in `src/pages/TodoPage.tsx` (~1500 lines) + `TodoPage.scss` (~1600 lines)
- Backend: `server.ts` with CRUD routes for `/api/tasks`, `/api/shopping`, `/api/groceries`, `/api/recurring`, `/api/settings`, `/api/archive`
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
- Development history: `personal-os/02-projects/todo-app/devlog.md`
- Project map: `personal-os/02-projects/todo-app/AGENTS.md`
- Domain glossary: `CONTEXT.md` (this repo)
