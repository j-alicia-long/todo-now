# Filterable card recommendations

> Evolves the static `/cards` cheat-sheet into a computed, filterable view. Domain vocabulary lives in CONTEXT.md ("Cards" section); source research in the card-maximization guide (`01-areas/finance/card-maximization.md` in personal-os).

## Problem Statement

The `/cards` page is a hand-written table that assumes Jennifer has all six cards in her pocket and is spending domestically. The moment reality diverges — a card left at home, a lost card, or travel abroad where two cards charge a 3% foreign transaction fee — the table's answers are wrong, and re-deriving "which card should I actually use right now?" means mentally re-running the whole guide.

## Solution

Replace the hand-written table with data plus a small engine. All rewards knowledge moves into a flat list of **Earn Rates** (one Card × one Spend Category → nominal rate + **Strings** like caps, exclusions, or mobile-wallet-required) in its own data module. A persisted **Wallet** (which cards are on hand, part of Settings) and an **Abroad** toggle filter that data, and a pure **Recommendation** function derives the best card per category: highest nominal rate among on-hand cards, ties broken by fewest Strings (the runner-up shown as tied-with-caveat), FTF cards excluded entirely when Abroad. USBAR's mobile-wallet 3% competes in every category as a **Wildcard** but is suppressed wherever a clean, equal-or-better card is on hand. Transferable-points cards (Amex MR) get a badge, never a rate bump. The visible table becomes a projection of this engine — same page, but its answers now reflect what's actually in Jennifer's pocket.

## User Stories

1. As the app's user, I want the cheat-sheet derived from structured Earn Rate data, so that the table can never contradict the underlying card facts.
2. As the app's user, I want to mark which cards I have on hand (my Wallet), so that recommendations only ever name cards I can physically use.
3. As the app's user, I want my Wallet persisted in Settings, so that a card left at home for a week stays deselected across visits and devices.
4. As the app's user, I want each category row to show the single best on-hand card, so that the answer is a glance, not a comparison.
5. As the app's user, I want ties on rate broken by fewest Strings, with the stringier card shown as tied-with-caveat, so that the clean card is the default and the fallback is still visible.
6. As the app's user, I want an Abroad toggle that excludes FTF cards entirely, so that traveling doesn't require me to lie about which cards I'm carrying.
7. As the app's user, I want USBAR's mobile-wallet 3% to compete in every category but stay hidden where an equal-or-better clean card is on hand, so that it surfaces exactly when it's the real answer (e.g. SavorOne missing) without cluttering every row.
8. As the app's user, I want point-earning cards badged as "transferable" while ranking stays on nominal rate, so that I see the upside without the model pretending to know point valuations.
9. As the app's user, I want Drugstores as a category (Duane Reade, CVS, Walgreens, Rite Aid), so that CFU's 3% there isn't invisible.
10. As the app's user, I want Amazon / Walmart / Target as a category, so that the grocery-exclusion trap (SavorOne's 3% not applying) steers me to the right card instead of the wrong habit.
11. As the app's user, I want a single "Everything else" row showing both the mobile-wallet pick and the physical-card fallback, so that I have an answer whether or not the terminal takes Apple Pay.
12. As the app's user, I want the per-card detail dropdowns to remain, so that the playbook context (credits, renewal decisions) stays one tap away.
13. As the app's user, I want deselecting every card to produce a calm empty state, so that a nonsensical filter reads as empty, not broken.

## Implementation Decisions

- **New data module `src/domain/card-rewards.ts`**: card facts (key, name, FTF flag, transferable flag) and the flat Earn Rate list. A sparse matrix as a flat array — easy to filter, sort, and extend; no nesting to fight.
- **New pure domain module for the recommendation engine** (sibling to task-rules, matrix-rules, recurrence). It owns: Wallet filtering, Abroad exclusion, nominal-rate ranking, the fewest-Strings tiebreak, Wildcard suppression ("suppress where a clean on-hand card has rate ≥ wildcard's"), and the Everything-Else dual pick (best mobile-wallet pick + best physical-card fallback).
- **Strings are structured, not prose**: a small union (spend cap, merchant exclusion, mobile-wallet-required, choice-category) with a display string. The tiebreak counts them; the UI prints them.
- **Settings gains `walletCards`** (array of card keys; default = all). Abroad is ephemeral UI state, not persisted — trips end, and a stale Abroad toggle would silently hide two cards. Server change is minimal: whitelist the new Settings field.
- **UI stays on the existing `/cards` page**: a card-chip filter row and Abroad toggle above the table; table rows become computed Recommendations. Per-card details section unchanged.
- **Freedom Unlimited replaces the old rotating-Freedom logic** everywhere (already shipped: no quarter map, no activation reminders).

## Testing Decisions

- Tests assert external behavior of the engine only: given Earn Rates, a Wallet, and toggles → which card(s) per category. Prior art: the task-rules and matrix-rules suites (pure functions, `bun test`).
- **Single seam — the recommendation engine module.** Behavioral surface to cover: full-wallet baseline matches the current cheat-sheet; missing-card scenarios (no SavorOne → dining falls to Autograph/CFU tie, broken by Strings); Abroad excludes BofA + CFU and re-ranks; Wildcard suppression on/off cases (equal clean card present vs. absent); tie-with-caveat output shape; Everything-Else returns both picks; empty Wallet returns empty.
- No settings-family test for `walletCards` — it's a plain whitelisted field with no behavior of its own. No tests of the static data module or page rendering, consistent with the codebase.

## Out of Scope

- Point valuations or effective-rate math (MR at 1.5¢, etc.) — nominal rate only, transferable is a badge.
- Freedom's rotating 5% quarters — Jennifer's card is a Freedom Unlimited; no quarter data structure.
- Spend tracking against caps (e.g. USBAR's $5k/cycle) — caps are displayed Strings, not counters.
- Wholesale clubs and Chase Travel portal as categories (deliberately skipped).
- Card management UI (adding/editing cards or rates in-app) — the data module is edited in code.
- Automatic FTF detection or geolocation — Abroad is a manual toggle.

## Further Notes

- Vocabulary (Card, Spend Category, Earn Rate, Strings, Wildcard, FTF, Transferable, Wallet, Abroad, Recommendation, Everything Else) is recorded in CONTEXT.md — keep code names aligned with it.
- No ADR: every decision here is cheaply reversible (per the sparing-ADR rule).
- Per standing instructions, implementation should update the product spec (todo-architecture.md) and README, and ship as its own commit(s).
