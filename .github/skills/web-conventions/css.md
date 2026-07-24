# CSS / SCSS Conventions

For projects using plain SCSS (no CSS Modules, no Tailwind).

## Approach

- Mobile-first: write base rules for small screens; media queries scale _up_.
- Use the project's design tokens (CSS custom properties, e.g. `--bg`, `--accent`) for colors — no hardcoded hex/rgba in component styles. New colors get a token first (with a dark-mode value if the project has one).

## Markup

- Use semantic HTML (`<h1>`, `<p>`, `<button>`, `<nav>`) over generic `<div>`/`<span>`.
- Group siblings with a fragment (`<>`) rather than a wrapper `<div>`, unless the wrapper is doing layout work (flex/grid container).
- Build class names statically. Template-literal class construction defeats project-wide search — for conditional styling, toggle whole class names.

## Selectors & naming

- Style via class selectors (`.logo-img`), not type (`img`) or ID (`#logo`) selectors.
- Name modifiers with a postfix: `button-floating`, not `floating-button` — related names sort together alphabetically.
- Avoid deep nesting of class rules; keep selectors shallow so styles stay searchable and specificity stays flat.

## Properties

- Set explicit `width`/`height` on images to prevent layout shift while they load.
- Full-screen fixed/absolute overlays: use `inset: 0` (or `top/right/bottom/left: 0`) rather than `width: 100%` + viewport-height hacks.
- Prefer simple `padding`/`margin`/`min-*`/`max-*` values over `calc()` gymnastics unless responsiveness truly requires it.
- For a styling pattern that recurs (e.g. responsive font sizing), extract a shared class or mixin instead of copying the rule block.
