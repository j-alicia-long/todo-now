---
name: web-conventions
description: Code conventions for this app — TypeScript, React, SCSS, and code organization. Use when writing, refactoring, or reviewing any code in this repo.
---

# Web Conventions

Judgment-call conventions for TypeScript/React/SCSS codebases. Project architecture (modules, seams, where things live) is in the project's `AGENTS.md`.

**Before writing code, read the ESLint rules** — they are the other half of these conventions (the machine-checkable half, deliberately not repeated here) and they bind generated code at authoring time, not just at pre-commit:

1. The shared preset: `node_modules/@j-alicia-long/web-config/eslint.config.js` — every rule entry has a comment or message explaining the convention it enforces.
2. The project's own `eslint.config.js` for local overrides.

After changing code, run the project's lint script and fix findings before considering the work done — a pre-commit failure means this step was skipped.

## General principles

- **Reuse before building.** Check the project's existing components, hooks, and utils before writing new ones. When creating something new, shape it to be extendable.
- **Single source of truth.** Store each piece of data — and each _interpretation_ of data (e.g. "is this item due soon") — in exactly one place. Logic computed independently in two components will diverge.
- **Explicit over clever.** Prefer a plain `if` block over chained `&&`/`||` expressions used for control flow. Prefer explicit comparisons (`val === undefined`) over truthiness checks that conflate `0`, `""`, and `false` with "missing".
- **Declarative over imperative.** React components instead of DOM manipulation; CSS instead of measuring/drawing in JS; derive state instead of syncing it.

## Topic reference

Consult the matching file when working in that area:

- [typescript.md](typescript.md) — types, nullability, iteration idioms (`.ts`, `.tsx`)
- [react.md](react.md) — component patterns, hooks, state (`.tsx`)
- [css.md](css.md) — SCSS and JSX styling (`.scss`, JSX markup)
- [organization.md](organization.md) — file structure, code layout, comments
