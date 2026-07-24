# File Structure, Code Layout & Documentation

## File structure

- Where things live is defined in the project's `AGENTS.md` — follow it.
- Group related components in a domain subfolder rather than a flat pile.
- Keep the server route layer thin (HTTP semantics only); business rules go in domain modules as pure functions shared by server and client.

## Code layout

- Use guard clauses (early returns) instead of wrapping a function body in an `if`.
- Order grouped peer items alphabetically (switch cases, config maps, exported constants) so additions have an obvious home.
- Inline a variable used exactly once — _except_ when the name documents an otherwise-magic value.
- Avoid string interpolation when constructing identifiers people will search for (class names, file names, log messages). A literal string is greppable; an interpolated one is invisible.

## Comments & naming

- Names should carry the meaning: `isTaskDueSoon`, `recurring-list-item.tsx`. If a name needs a comment to explain it, rename it.
- Comment only what the code can't say: non-obvious constraints, fixes for obscure bugs, "why" decisions.
- Give exported functions/components a JSDoc (`/** */`) only when usage isn't clear from the signature.
- Tag TODOs with an owner or issue: `// TODO(username): …` or `// TODO(#42): …`. Untagged TODOs get resolved or tagged before merge.
