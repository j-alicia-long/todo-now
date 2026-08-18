// Card rewards data — the single source of truth the /cards cheat-sheet
// is derived from. Card facts plus a flat list of Earn Rates (one Card ×
// one Spend Category → nominal rate + Strings). A sparse matrix as a
// flat array; the Recommendation engine (card-recommendations.ts) is the
// only reader. Vocabulary from CONTEXT.md ("Cards").

export type CardKey =
  "usbar" | "amex" | "savorone" | "bofa" | "freedom" | "autograph";

export const CARD_KEYS: CardKey[] = [
  "usbar",
  "amex",
  "savorone",
  "bofa",
  "freedom",
  "autograph",
];

// Trip-protection coverage, coarse on purpose: the useful question when
// booking is "does paying with this card protect the trip?", not the exact
// dollar caps (which move, and live in each issuer's Guide to Benefits).
// "verify" is a real state, not a placeholder — some no-AF cards' coverage
// depends on the underlying Visa/Mastercard network tier, which public
// sources disagree about.
export type TravelInsuranceTier = "full" | "rental-only" | "none" | "verify";

export type Card = {
  key: CardKey;
  name: string;
  /** Charges a ~3% foreign transaction fee — excluded when Abroad. */
  ftf: boolean;
  /** Points can move to airline/hotel partners for better rewards. */
  transferable: boolean;
  /** Trip protections when the trip is paid for with this card. */
  travelInsurance: TravelInsuranceTier;
  /** What the tier covers — shown in the card's details, always caveated. */
  travelInsuranceNote: string;
};

export const CARDS: Record<CardKey, Card> = {
  usbar: {
    key: "usbar",
    name: "USBAR",
    ftf: false,
    transferable: false,
    travelInsurance: "full",
    travelInsuranceNote:
      "Trip cancellation/interruption, trip delay, lost/delayed baggage, and primary rental car CDW. Travel Center bookings count.",
  },
  amex: {
    key: "amex",
    name: "Amex Platinum",
    ftf: false,
    transferable: true,
    travelInsurance: "full",
    travelInsuranceNote:
      "Trip cancellation/interruption, trip delay, and baggage insurance. Car rental loss & damage is opt-in per rental, not automatic.",
  },
  savorone: {
    key: "savorone",
    name: "SavorOne",
    ftf: false,
    transferable: false,
    travelInsurance: "verify",
    travelInsuranceNote:
      "Rental car CDW (secondary) and travel accident insurance. Whether trip cancellation applies depends on the card's Mastercard tier — check your Guide to Benefits before relying on it.",
  },
  bofa: {
    key: "bofa",
    name: "BofA CCR",
    ftf: true,
    transferable: false,
    travelInsurance: "none",
    travelInsuranceNote:
      "No trip protections worth planning around — and it charges FTF, so it shouldn't be the travel card anyway.",
  },
  freedom: {
    key: "freedom",
    name: "Freedom Unlimited",
    ftf: true,
    transferable: false,
    travelInsurance: "rental-only",
    travelInsuranceNote:
      "Secondary rental car CDW only — no trip cancellation/interruption or delay coverage (those live on the Sapphire cards).",
  },
  autograph: {
    key: "autograph",
    name: "Autograph",
    ftf: false,
    transferable: false,
    travelInsurance: "rental-only",
    travelInsuranceNote:
      "Secondary rental car CDW and travel accident coverage only — no trip cancellation/interruption or delay. (That's the Autograph Journey, a different card.)",
  },
};

// Strings are structured, not prose: the tiebreak counts them, the UI
// prints their display text. A rate with no Strings is "clean".
export type EarnStringKind =
  | "spend-cap"
  | "merchant-exclusion"
  | "mobile-wallet-required"
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
  /** Wins its category regardless of rate — a non-rate perk (e.g.
   * phone protection) judged to beat the nominal-rate winner. */
  pinned?: boolean;
};

const cap = (display: string): EarnString => ({ kind: "spend-cap", display });
const excl = (display: string): EarnString => ({
  kind: "merchant-exclusion",
  display,
});
const mobileWallet = (): EarnString => ({
  kind: "mobile-wallet-required",
  display: "mobile wallet only",
});
const choice = (display: string): EarnString => ({
  kind: "choice-category",
  display,
});

export const EARN_RATES: EarnRate[] = [
  // ── Category rates ──
  {
    card: "amex",
    scope: "flights",
    rate: 5,
    strings: [],
    note: "5x MR points",
  },
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
    strings: [choice("set choice category"), cap("$2.5k/quarter combined cap")],
    note: "3%",
  },
  { card: "autograph", scope: "gas-transit", rate: 3, strings: [], note: "3x" },
  {
    card: "amex",
    scope: "cell-phone",
    rate: 1,
    strings: [],
    note: "1x, but $800/claim phone protection beats the 3x",
    pinned: true,
  },
  {
    card: "autograph",
    scope: "cell-phone",
    rate: 3,
    strings: [],
    note: "3x + $600/claim phone protection",
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
    strings: [mobileWallet(), cap("$5k/cycle cap")],
    note: "3x @ 1¢ = 3%",
  },

  // ── Flat catch-alls: the floor everywhere + Everything-Else ranking ──
  {
    card: "freedom",
    scope: "everything-else",
    rate: 1.5,
    strings: [],
    note: "1.5% flat — general catch-all",
  },
  {
    card: "savorone",
    scope: "everything-else",
    rate: 1,
    strings: [],
    note: "1%",
  },
  {
    card: "autograph",
    scope: "everything-else",
    rate: 1,
    strings: [],
    note: "1x",
  },
  { card: "bofa", scope: "everything-else", rate: 1, strings: [], note: "1%" },
  {
    card: "amex",
    scope: "everything-else",
    rate: 1,
    strings: [],
    note: "1x MR",
  },
  {
    card: "usbar",
    scope: "everything-else",
    rate: 1,
    strings: [],
    note: "1x without mobile wallet",
  },
];
