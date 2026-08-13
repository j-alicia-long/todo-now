# Cloudflare Workers hosting with blob-per-Family D1 storage

Zo retired its free tier (Aug 2026), forcing a rehost. We decided to move the app to Cloudflare Workers, storing each Family's whole list as **one JSON document** in a two-column D1 table (`families(name, json)`), raw Reports in an R2 bucket, and the site behind Cloudflare Access. The blob-per-Family shape looks wrong for a SQL database — that's deliberate: the `ListStore` seam already reads and writes whole lists, and normalize-on-read (due-soon promotion, Trash purge, weekly reset — the app's only scheduler) plus the legacy file-format migrations all operate on parsed lists in JS. Blob-per-Family keeps every line of that untouched; only the ~40 lines of file I/O become a D1 adapter. At one user and ~20 KB of data, row-per-item buys nothing measurable. Do not "fix" this to a relational schema without hitting a trigger in the tech spec's *Future extension: row-per-item* section (`../../todo-architecture.md`).

## Considered Options

- **Row-per-item relational schema** — rejected for now: rewrites the read/normalize/write cycle and ports the legacy migrations to SQL for zero benefit at current size. Revisit triggers are documented in the tech spec.
- **Workers KV** — rejected: 1 write/sec/key drops writes during rapid grocery check-offs (each check-off rewrites the same key), and eventual consistency (~60 s) can serve a stale list when switching phone → laptop. Its strengths (global read fan-out) go unused by a one-person app.
- **Vercel + Turso/Neon** — rejected: the storage rewrite is required anyway (no persistent disk there either), and it splits one app across two vendors' configs, dashboards, and tokens.
- **Home server or Oracle free VM** — rejected: zero code changes, but permanent ops burden (uptime, patches, backups) for an app that must be reachable away from home.
- **Fly.io with a volume** — rejected: closest to the Zo model, but paid (~$3/mo) while Cloudflare's free tier covers everything.
