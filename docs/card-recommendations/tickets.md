# Filterable card recommendations — tickets

Tracer-bullet breakdown of `spec.md` (filterable `/cards` page). Work the frontier: any ticket whose blockers are all done.

---

## 01 — Computed cheat-sheet from Earn Rate data (full-wallet baseline)

**What to build:** The `/cards` cheat-sheet table stops being hand-written and becomes a projection of structured data. All rewards knowledge lives as Card facts (key, name, FTF flag, Transferable flag) plus a flat list of Earn Rates (one Card × one Spend Category → nominal rate + Strings). A pure Recommendation engine derives the best Card per Spend Category: highest nominal rate wins; ties on rate break by fewest Strings, with the stringier runner-up shown as tied-with-caveat; USBAR's mobile-wallet 3% competes everywhere as a Wildcard but is suppressed in any category where a clean, equal-or-better on-hand Card exists; the single "Everything else" row shows both the tap-to-pay pick and the no-tap fallback. Transferable Cards get a badge in the output, never a rate bump. With the default full Wallet and Abroad off, the rendered table gives the same answers as today's static sheet — including the new Drugstores and Amazon/Walmart/Target categories from the spec. Per-card detail dropdowns remain unchanged.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Rewards data lives in its own domain data module as Card facts + a flat Earn Rate array; Strings are a structured union (spend cap, merchant exclusion, tap-required, choice-category) each with a display string
- [ ] A pure recommendation engine module (sibling to task-rules/matrix-rules) computes Recommendations per Spend Category from Earn Rates; `bun test src` covers: full-wallet baseline matches the current cheat-sheet, tied-with-caveat output shape, Wildcard suppression when an equal clean card is present and surfacing when absent, Everything-Else returning both tap and no-tap picks
- [ ] The `/cards` table rows are rendered from engine output (no hand-written CHEAT_SHEET rows); Drugstores and Amazon/Walmart/Target appear as categories; Transferable cards show a badge
- [ ] Vocabulary matches CONTEXT.md (Card, Spend Category, Earn Rate, Strings, Wildcard, Recommendation, Everything Else); typecheck and lint pass

---

## 02 — Wallet: mark cards on hand, persisted, recommendations follow

**What to build:** Jennifer can mark which Cards she physically has on hand, and every Recommendation is computed against that Wallet. A card-chip filter row above the cheat-sheet table toggles each Card in and out of the Wallet. The Wallet persists in Settings (default: all cards), so a card left at home stays deselected across visits and devices. When a Card is deselected, rows re-rank: with SavorOne gone, dining falls to the Autograph/CFU tie broken by Strings, and the USBAR Wildcard surfaces wherever it becomes the real answer. Deselecting every Card produces a calm empty state — reads as empty, not broken.

**Blocked by:** 01 — Computed cheat-sheet from Earn Rate data.

**Status:** ready-for-agent

- [ ] Settings gains `walletCards` (array of card keys, default all) flowing through the existing settings hook and server persistence; no dedicated settings tests (plain field, no behavior)
- [ ] Engine accepts a Wallet and only recommends on-hand Cards; `bun test src` covers missing-card scenarios (no SavorOne → dining tie broken by Strings; Wildcard surfaces when its suppressor is off-hand) and empty Wallet → empty result
- [ ] `/cards` shows a card-chip filter row above the table; toggling a chip updates rows immediately and persists across reloads
- [ ] Deselecting all cards shows a calm empty state instead of an empty/broken table

---

## 03 — Abroad toggle excludes FTF cards

**What to build:** An Abroad toggle on the `/cards` page for international travel. When on, Cards that charge a foreign transaction fee (BofA CCR, Freedom Unlimited) are excluded from Recommendations entirely and every row re-ranks — no need to lie about which cards are being carried, since the Wallet is untouched. Abroad is ephemeral UI state, deliberately not persisted: trips end, and a stale toggle would silently hide two cards.

**Blocked by:** 01 — Computed cheat-sheet from Earn Rate data.

**Status:** ready-for-agent

- [ ] Engine accepts an Abroad flag; `bun test src` covers Abroad excluding BofA + CFU and re-ranking affected categories (e.g. drugstores, no-tap Everything Else fallback)
- [ ] `/cards` shows an Abroad toggle near the card-chip row; toggling re-renders rows immediately
- [ ] Abroad resets on page load (not persisted to Settings or localStorage)
- [ ] Abroad composes with the Wallet: an FTF card stays selected in the Wallet but is never recommended while Abroad

---

## 04 — Documentation sync

**What to build:** Project documentation reflects the shipped feature. The product spec (todo-architecture.md) describes the computed `/cards` page, Wallet setting, and Abroad toggle; README covers the feature at its usual level of detail; devlog logs the shipped work; CONTEXT.md vocabulary is confirmed aligned with the code names actually used.

**Blocked by:** 01, 02, 03.

**Status:** ready-for-agent

- [ ] `../todo-architecture.md` product spec updated for the filterable cards page
- [ ] `README.md` updated; notable work logged in `devlog.md`
- [ ] CONTEXT.md Cards vocabulary matches shipped code names (no doc changes needed if already aligned)
- [ ] Shipped as its own commit(s), separate from feature commits
