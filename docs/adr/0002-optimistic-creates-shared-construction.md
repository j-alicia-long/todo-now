# Creates are optimistic in the store, built from shared construction defaults

Offline mode needed creates to appear instantly with no server response. Two options: (A) have the offline transport synthesize a fake server response so the store's wait-for-server `create()` could stay unchanged, or (B) make `create()` itself optimistic — build the item client-side and reconcile with the server in the background. We chose **B**, the standard web-app pattern (React Query / Linear style): the store builds the full item via the family's shared `construct` from `src/domain/construct.ts` (client-generated 8-char id), shows it immediately, POSTs the complete item, and swaps in the server's response — removing the item if the server rejects it. The same construction code runs on the server's create routes, and constructs honor a client-supplied `id` and `createdAt`, so an offline create replayed later is indistinguishable from an online one. Every build benefits: creates feel instant even online, and the demo transport reuses the same defaults.

Conflict model: single user, replay-in-order, last write wins. Entities carry only `createdAt` — no `updatedAt` timestamps exist, and none are needed.

## Considered Options

- (A) Offline transport synthesizes the server response, store unchanged — rejected: duplicates construction knowledge inside a transport (wrong layer), only helps the offline path, and leaves online creates waiting on the network.
- Server-only construction with a temporary client placeholder id remapped on sync — rejected: id remapping ripples through queued edits referencing the placeholder; honoring client ids removes the problem entirely.
- Adding `updatedAt` timestamps for field-level last-write-wins merges — rejected: single-user app; replay-in-order gives the same outcome without new schema.
