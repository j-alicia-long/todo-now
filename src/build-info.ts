// Build metadata shown in the Settings footer. The date is the committer
// date of HEAD, injected at build time via Vite `define` (see vite.config.ts).
// Outside Vite (bun test) the global is absent, so fall back to "now".

export const LAST_COMMIT_DATE: string =
  typeof __LAST_COMMIT_DATE__ !== "undefined"
    ? __LAST_COMMIT_DATE__
    : new Date().toISOString();
