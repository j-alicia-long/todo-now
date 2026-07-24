# React Conventions

## Pure rendering

- Keep render bodies pure: no side effects, no reads from mutable globals. Side effects belong in `useEffect` or event handlers.
- Read reactive values from reactive sources — e.g. router hooks instead of `window.location` — so the component re-renders when they change.

## Hooks

- Extract repeated state-plus-handler logic into a custom hook.
- Never call a hook inline as a prop value.
- An object's setup and cleanup belong in the _same_ effect, unless they genuinely need different dependency arrays.

## Components

- Refactor a complex stateful component into a **controller** (owns state and handlers) and a **view** (receives everything as props). Views become trivially unit-testable — pass state in directly.
- When a component takes 3+ callbacks, group them into a narrow action-handle object (e.g. `TaskActions`) declared next to the component and built once by the controller, instead of a prop per callback.
- When several related components need the same state, prefer `useContext` over drilling props through intermediaries.

## State

- Client data fetching goes through the project's data layer — don't roll ad-hoc `fetch` + `useState` loading per component.
- Avoid storing derived data; compute it during render. Avoid state that goes stale on its own (e.g. a captured "now" timestamp — inject `now` as an argument into the logic that needs it).
