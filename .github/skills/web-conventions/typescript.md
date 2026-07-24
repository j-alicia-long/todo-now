# TypeScript Conventions

## Nullability

- Use `undefined` as the single "no value" representation. Avoid introducing `null` into types or assignments when `undefined` already covers it — carrying both doubles every nullability check.
  - Exceptions: React's "render nothing" convention (`ReactNode | null`), and JSON-serialized data (JSON has no `undefined`).
- Check for absence explicitly: `val === undefined` (or the `val != null` idiom for both), not `!val`.

## Typing

- For props where omission would likely be a bug, declare `prop: T | undefined` instead of `prop?: T` — the former forces callers to pass the value explicitly; the latter fails silently when forgotten. Use `prop?: T` only when a missing value is a normal, expected case (e.g. an optional style flag).
- Prefer generics and `satisfies` over type assertions (`as`). Assertions silence the checker; `satisfies` keeps it working for you.

## Idioms

- When producing a value, prefer `map`/`filter`/`reduce` over a loop that mutates an accumulator.
- Avoid `let`. When initialization needs branching, compute the value with an IIFE (immediately-invoked function expression) and assign it to a `const` — this also works in expression positions like JSX.
- Delete code that has no effect (wrapper elements, dead CSS properties, unused branches) rather than leaving it "just in case".
