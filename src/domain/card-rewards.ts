// Card rewards data — the single source of truth the /cards cheat-sheet
// is derived from. Card facts plus a flat list of Earn Rates (one Card ×
// one Spend Category → nominal rate + Strings). A sparse matrix as a
// flat array; the Recommendation engine (card-recommendations.ts) is the
// only reader. Vocabulary from CONTEXT.md ("Cards").

export type CardKey =
  | "usbar"
  | "amex"
  | "savorone"
  | "bofa"
  | "freedom"
  | "autograph";

export const CARD_KEYS: CardKey[] = [
  "usbar",
  "amex",
  "savorone",
  "bofa",
  "freedom",
  "autograph",
];

export type Card = {
  key: CardKey;
  name: string;
  /** Charges a ~3% foreign transaction fee — excluded when Abroad. */
  ftf: boolean;
  /** Points can move to airline/hotel partners. Badge only, never a rate bump. */
  transferable: boolean;
};

export const CARDS: Record<CardKey, Card> = {
  usbar: {
    key: "usbar",
    name: "USBAR",
    ftf: false,
    transferable: false,
  },
  amex: {
    key: "amex",
    name: "Amex Platinum",
    ftf: false,
    transferable: true,
  },
  savorone: {
    key: "savorone",
    name: "SavorOne",
    ftf: false,
    transferable: false,
  },
  bofa: {
    key: "bofa",
    name: "BofA CCR",
    ftf: true,
    transferable: false,
  },
  freedom: {
    key: "freedom",
    name: "Freedom Unlimited",
    ftf: true,
    transferable: false,
  },
  autograph: {
    key: "autograph",
    name: "Autograph",
    ftf: false,
    transferable: false,
  },
};

// Strings are structured, not prose: the tiebreak counts them, the UI
// prints their display text. A rate with no Strings is "clean".
export type EarnStringKind =
  | "spend-cap"
  | "merchant-exclusion"
  | "tap-required"
  | "choice-category";

export type EarnString = {
  kind: EarnStringKind;
  display: string;
};

export type SpendCategory =
  | "flights"
  | "dining"
  | "groceries"
  | "drugstores"
  | "online-shopping"
  | "gas-transit"
  | "cell-phone"
  | "streaming"
  | "entertainment"
  | "hotels-cars"
  | "amazon-walmart-target";

/** Table row order — mirrors the old hand-written cheat-sheet. */
export const SPEND_CATEGORIES: SpendCategory[] = [
  "flights",
  "dining",
  "groceries",
  "drugstores",
  "online-shopping",
  "gas-transit",
  "cell-phone",
  "streaming",
  "entertainment",
  "hotels-cars",
  "amazon-walmart-target",
];

// "wildcard" competes in every Spend Category (USBAR mobile wallet);
// "everything-else" rates are each card's flat catch-all, competing
// everywhere as the floor and ranked for the Everything-Else picks.
export type EarnScope = SpendCategory | "wildcard" | "everything-else";

export type EarnRate = {
  card: CardKey;
  scope: EarnScope;
  /** Nominal percent back (points valued at face: 3x @ 1¢ = 3). */
  rate: number;
  strings: EarnString[];
  /** Short "why" text for the table row. */
  note: string;
};

const cap = (display: string): EarnString => ({ kind: "spend-cap", display });
const excl = (display: string): EarnString => ({
  kind: "merchant-exclusion",
  display,
});
const tap = (): EarnString => ({
  kind: "tap-required",
  display: "mobile wallet only",
});
const choice = (display: string): EarnString => ({
  kind: "choice-category",
  display,
});

export const EARN_RATES: EarnRate[] = [
  // ── Category rates ──
  { card: "amex", scope: "flights", rate: 5, strings: [], note: "5x MR points" },
  { card: "savorone", scope: "dining", rate: 3, strings: [], note: "3%" },
  { card: "autograph", scope: "dining", rate: 3, strings: [], note: "3x" },
  { card: "freedom", scope: "dining", rate: 3, strings: [], note: "3%" },
  {
    card: "savorone",
    scope: "groceries",
    rate: 3,
    strings: [excl("excl. Walmart/Target")],
    note: "3%",
  },
  {
    card: "bofa",
    scope: "groceries",
    rate: 2,
    strings: [cap("$2.5k/quarter combined cap")],
    note: "2% grocery/wholesale",
  },
  { card: "freedom", scope: "drugstores", rate: 3, strings: [], note: "3%" },
  {
    card: "bofa",
    scope: "online-shopping",
    rate: 3,
    strings: [
      choice("set choice category"),
      cap("$2.5k/quarter combined cap"),
    ],
    note: "3%",
  },
  { card: "autograph", scope: "gas-transit", rate: 3, strings: [], note: "3x" },
  {
    card: "autograph",
    scope: "cell-phone",
    rate: 3,
    strings: [],
    note: "3x + $600/claim phone protection (Plat: $800/claim but only 1x)",
  },
  { card: "savorone", scope: "streaming", rate: 3, strings: [], note: "3%" },
  { card: "autograph", scope: "streaming", rate: 3, strings: [], note: "3x" },
  {
    card: "savorone",
    scope: "entertainment",
    rate: 3,
    strings: [excl("in-person venues only")],
    note: "3%",
  },
  {
    card: "autograph",
    scope: "hotels-cars",
    rate: 3,
    strings: [],
    note: "3x travel, book direct",
  },

  // ── Wildcard: competes in every category ──
  {
    card: "usbar",
    scope: "wildcard",
    rate: 3,
    strings: [tap(), cap("$5k/cycle cap")],
    note: "3x @ 1¢ = 3%",
  },

  // ── Flat catch-alls: the floor everywhere + Everything-Else ranking ──
  {
    card: "freedom",
    scope: "everything-else",
    rate: 1.5,
    strings: [],
    note: "1.5% flat — best no-tap catch-all",
  },
  { card: "savorone", scope: "everything-else", rate: 1, strings: [], note: "1%" },
  { card: "autograph", scope: "everything-else", rate: 1, strings: [], note: "1x" },
  { card: "bofa", scope: "everything-else", rate: 1, strings: [], note: "1%" },
  { card: "amex", scope: "everything-else", rate: 1, strings: [], note: "1x MR" },
  { card: "usbar", scope: "everything-else", rate: 1, strings: [], note: "1x without mobile wallet" },
];
