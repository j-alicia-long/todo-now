# TypeScript Conventions

## Nullability

- Use `undefined` as the single "no value" representation. Avoid introducing `null` into types or assignments when `undefined` already covers it — carrying both doubles every nullability check.
  - Exception: React's "render nothing" convention (`ReactNode | null`) may use `null`.
- Check for absence explicitly: `val === undefined`, not `!val`.

## Typing

- Prefer string literal unions over enums. An enum is acceptable only when the value itself isn't self-descriptive (e.g. integer flags).
- For props where omission would likely be a bug, declare `prop: T | undefined` instead of `prop?: T` — the former forces callers to pass the value explicitly; the latter fails silently when forgotten. Use `prop?: T` only when a missing value is a normal, expected case (e.g. an optional style flag).
- Prefer generics and `satisfies` over type assertions (`as`). Assertions silence the checker; `satisfies` keeps it working for you.

## Idioms

- Prefer functional iteration (`map`, `filter`, `reduce`) over `forEach` / `for...of` when producing a value.
- Prefer array spread (`[a, b, ...rest]`) over `concat`.
- Avoid `let`. When initialization needs branching, compute the value with an IIFE (immediately-invoked function expression) and assign it to a `const` — this also works in expression positions like JSX.
- Delete code that has no effect (wrapper elements, dead CSS properties, unused branches) rather than leaving it "just in case".
