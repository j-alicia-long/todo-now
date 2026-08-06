// Recommendation engine — the single source of truth for "which card
// do I pull out right now?". Pure projection of the Earn Rate data
// (card-rewards.ts) through a Wallet; sibling to task-rules and
// matrix-rules. Nothing here is stored: the /cards table re-derives
// every Recommendation on render. Vocabulary from CONTEXT.md ("Cards").

import type { CardKey, EarnRate, SpendCategory } from "./card-rewards";
import { CARDS, EARN_RATES, SPEND_CATEGORIES } from "./card-rewards";

export type Recommendation = {
  category: SpendCategory;
  pick: EarnRate;
  /** Runner-up tied on nominal rate (the stringier fallback), if any. */
  tiedWith?: EarnRate;
};

type EngineInput = {
  /** Cards on hand. Every Recommendation is computed against this. */
  wallet: CardKey[];
  /** Traveling internationally: FTF cards are excluded entirely. */
  abroad?: boolean;
};

/** The rates that may compete: on-hand cards, minus FTF cards abroad. */
const usableRates = ({ wallet, abroad = false }: EngineInput): EarnRate[] =>
  EARN_RATES.filter(
    (r) => wallet.includes(r.card) && !(abroad && CARDS[r.card].ftf)
  );

/** Candidates for a category: its own rates, then the Wildcard, then
 * the flat catch-alls — array order is the deterministic tiebreak after
 * rate and Strings count. */
const candidatesFor = (
  category: SpendCategory,
  rates: EarnRate[]
): EarnRate[] => [
  ...rates.filter((r) => r.scope === category),
  ...rates.filter((r) => r.scope === "wildcard"),
  ...rates.filter((r) => r.scope === "everything-else"),
];

/** Pinned rates win outright; then highest rate; ties break by fewest
 * Strings; stable order last. */
const rank = (candidates: EarnRate[]): EarnRate[] =>
  [...candidates].sort(
    (a, b) =>
      Number(b.pinned ?? false) - Number(a.pinned ?? false) ||
      b.rate - a.rate ||
      a.strings.length - b.strings.length
  );

/** A Wildcard is suppressed wherever a clean rate on another on-hand
 * card is equal-or-better — it surfaces only when it's the real answer. */
const suppressWildcards = (candidates: EarnRate[]): EarnRate[] =>
  candidates.filter(
    (r) =>
      r.scope !== "wildcard" ||
      !candidates.some(
        (other) =>
          other.card !== r.card &&
          other.strings.length === 0 &&
          other.rate >= r.rate
      )
  );

export const recommendAll = (input: EngineInput): Recommendation[] => {
  const onHand = usableRates(input);
  return SPEND_CATEGORIES.flatMap((category) => {
    const ranked = rank(suppressWildcards(candidatesFor(category, onHand)));
    const [pick, next] = ranked;
    if (!pick) return [];
    const tiedWith =
      next && next.card !== pick.card && next.rate === pick.rate
        ? next
        : undefined;
    return [tiedWith ? { category, pick, tiedWith } : { category, pick }];
  });
};

export type EverythingElsePicks = {
  /** Best catch-all when the terminal takes mobile wallet (Apple Pay etc). */
  mobileWallet?: EarnRate;
  /** Best catch-all without a mobile wallet — the physical-card fallback. */
  physicalCard?: EarnRate;
};

const requiresMobileWallet = (r: EarnRate): boolean =>
  r.strings.some((s) => s.kind === "mobile-wallet-required");

/** The single "Everything else" row: best mobile-wallet pick and best
 * physical-card fallback among Wildcard + flat catch-all rates on hand. */
export const everythingElse = (input: EngineInput): EverythingElsePicks => {
  const ranked = rank(
    usableRates(input).filter(
      (r) => r.scope === "wildcard" || r.scope === "everything-else"
    )
  );
  return {
    mobileWallet: ranked[0],
    physicalCard: ranked.filter((r) => !requiresMobileWallet(r))[0],
  };
};
