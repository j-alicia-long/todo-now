// Credit card cheat-sheet reference page. Static content distilled from
// the card-maximization guide; reachable only via the settings drawer.

import { Link } from "react-router-dom";
import { Icon } from "../components/ui";
import "./cards-page.scss";

type CheatRow = { purchase: string; card: string; why: string };

const CHEAT_SHEET: CheatRow[] = [
  {
    purchase: "Freedom 5% rotating category",
    card: "Chase Freedom",
    why: "5% up to $1,500/qtr — activate quarterly",
  },
  {
    purchase: "Flights (booked direct)",
    card: "Amex Platinum",
    why: "5x MR — best flight multiplier",
  },
  {
    purchase: "Dining",
    card: "SavorOne or Autograph",
    why: "3% — SavorOne if Venture X later (transferable)",
  },
  {
    purchase: "Groceries",
    card: "SavorOne",
    why: "3% (excl. Walmart/Target)",
  },
  {
    purchase: "Online shopping",
    card: "BofA CCR",
    why: "3% (set choice category) — 5.25% w/ Platinum Honors",
  },
  { purchase: "Gas / EV, transit", card: "Autograph", why: "3x" },
  {
    purchase: "Cell phone bill",
    card: "Amex Plat or Autograph",
    why: "Plat: $800/claim protection, 1x · Autograph: $600/claim, 3x",
  },
  {
    purchase: "Streaming",
    card: "SavorOne or Autograph",
    why: "3%",
  },
  { purchase: "Entertainment", card: "SavorOne", why: "3%" },
  {
    purchase: "Hotels / rental cars (direct)",
    card: "Autograph",
    why: "3x travel, no FTF — direct keeps loyalty perks",
  },
  {
    purchase: "Foreign transactions",
    card: "SavorOne / Autograph / USBAR / Plat",
    why: "All no-FTF — avoid BofA CCR & Freedom (3% FTF)",
  },
  {
    purchase: "Everything else (tap-to-pay)",
    card: "USBAR (mobile wallet)",
    why: "3x @ 1¢ = 3%, capped at $5k/cycle",
  },
  {
    purchase: "Everything else (no tap)",
    card: "Any 1–1.5%",
    why: "Weakest spot — 2% catch-all would plug this gap",
  },
];

// Known Chase Freedom 5% rotating categories, keyed by "<year>-Q<n>".
// Update as quarters get announced (chase.com/freedomfive).
const CHASE_QUARTERS: Record<string, string> = {
  "2026-Q2": "Amazon, Whole Foods, Chase Travel, Feeding America",
  "2026-Q3":
    "Gas stations, public transit, EV charging, select live entertainment, United Way — activate by Sep 14, 2026",
};

const getCurrentQuarter = (now: Date) => {
  const q = Math.floor(now.getMonth() / 3) + 1;
  return {
    key: `${now.getFullYear()}-Q${q}`,
    label: `Q${q} ${now.getFullYear()}`,
  };
};

type CardDetail = {
  emoji: string;
  name: string;
  tagline: string;
  points: string[];
};

const CARD_DETAILS: CardDetail[] = [
  {
    emoji: "🏆",
    name: "USBAR (U.S. Bank Altitude Reserve)",
    tagline: "The catch-all (post-nerf)",
    points: [
      "3x on mobile wallet (Apple/Google/Samsung Pay), capped at $5,000/billing cycle, then 1x.",
      "Points worth 1¢ everywhere post-nerf → mobile wallet = flat 3%. 5% discount on gift card redemptions.",
      "Use the US Bank Travel Center only to burn the $325 credit — ideally on a flight (5x portal). Book hotels/cars direct for loyalty perks.",
      "$325 credit only triggers on Travel Center bookings. If you won't book ≥$325/yr through the portal, the $400 AF is a real cost — decide at renewal: keep only if you'll use the portal credit, otherwise downgrade to a no-AF US Bank card.",
      "Travel protections when paying with the card: trip cancellation/interruption, trip delay, baggage, primary rental CDW.",
    ],
  },
  {
    emoji: "💳",
    name: "Amex Platinum",
    tagline: "The credits card, not a spend card",
    points: [
      "Spend only flights (5x) on it. Everything else is 1x — never daily-drive it.",
      "Justify the fee with credits: airline incidental, Uber, digital entertainment, Saks, Clear, hotel credits (FHR/THC), lounge access.",
      "MR transfer partners: Delta direct, or Virgin Atlantic for cheaper Delta awards. Hold MR for awards — don't cash out at 0.6¢.",
    ],
  },
  {
    emoji: "🍿",
    name: "Capital One SavorOne",
    tagline: "Dining / grocery / entertainment backup",
    points: [
      "3% dining, groceries, entertainment, streaming. No annual fee.",
      "Keep it active — helps future Capital One approvals (e.g. Venture X, which would make these points transferable).",
    ],
  },
  {
    emoji: "🛒",
    name: "BofA Customized Cash Rewards",
    tagline: "Choice-category specialist",
    points: [
      "Set the 3% choice category deliberately — Online Shopping is usually best since dining/gas are covered elsewhere.",
      "3% choice + 2% grocery/wholesale, capped at $2,500 combined spend/quarter.",
      "With ≥$100k at BofA/Merrill (Platinum Honors): 5.25%/3.5% — then it can beat USBAR for online shopping.",
      "3% foreign transaction fee — don't use abroad.",
    ],
  },
  {
    emoji: "🔄",
    name: "Chase Freedom",
    tagline: "The 5% specialist",
    points: [
      "Activate the rotating category every quarter (reminder: mid-Mar/Jun/Sep/Dec).",
      "Max the $1,500/quarter cap when the category is good (grocery, gas, Amazon quarters).",
      "Points are cash-only for now — with a Sapphire Reserve you could pool Freedom points and transfer to partners (Virgin Atlantic → Delta, Hyatt).",
      "3% foreign transaction fee — don't use abroad.",
    ],
  },
  {
    emoji: "✍️",
    name: "WF Autograph",
    tagline: "Demoted to niche duty",
    points: [
      "Keep for: cell phone bill (3x + $600/claim phone protection), and 3x categories abroad where BofA/Freedom would charge FTF.",
      "No annual fee — keep open for credit age, just stop daily-driving it.",
    ],
  },
];

export const CardsPage = () => {
  const { key, label } = getCurrentQuarter(new Date());
  const categories = CHASE_QUARTERS[key];

  return (
    <div className="todo-page cards-page">
      <header className="todo-header">
        <h1>
          <Icon name="credit_card" /> Credit Cards
        </h1>
        <div className="header-actions">
          <Link to="/" className="home-btn" aria-label="Back to home">
            <Icon name="home" />
          </Link>
        </div>
      </header>

      <p className="cards-intro">
        Which card to pull out, at a glance. Tap-to-pay with no better category
        → USBAR (3%). Category spend → the matching 3x card. Freedom 5% quarter
        beats everything.
      </p>

      <div className="cheat-table-wrapper">
        <table className="cheat-table">
          <thead>
            <tr>
              <th>Purchase</th>
              <th>Card</th>
              <th>Rate / Why</th>
            </tr>
          </thead>
          <tbody>
            {CHEAT_SHEET.map((row) => (
              <tr key={row.purchase}>
                <td>{row.purchase}</td>
                <td className="cheat-card-name">{row.card}</td>
                <td>{row.why}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="chase-quarter">
        <Icon name="autorenew" />
        <div>
          <span className="chase-quarter-label">
            Chase Freedom 5% — {label}
          </span>
          <span className="chase-quarter-categories">
            {categories ??
              "Not yet announced — check chase.com/freedomfive and update this page."}
          </span>
        </div>
      </div>

      <h2 className="cards-section-title">Per-card details</h2>
      <div className="card-details-list">
        {CARD_DETAILS.map((card) => (
          <details key={card.name} className="card-detail">
            <summary>
              <span className="card-detail-emoji">{card.emoji}</span>
              <span className="card-detail-name">{card.name}</span>
              <span className="card-detail-tagline">{card.tagline}</span>
              <Icon name="expand_more" className="card-detail-chevron" />
            </summary>
            <ul>
              {card.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </div>
  );
};
