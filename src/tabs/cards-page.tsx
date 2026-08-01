// Credit card cheat-sheet reference page. Static content distilled from
// the card-maximization guide; reachable only via the settings drawer.

import { Link } from "react-router-dom";
import { Icon } from "../components/ui";
import "./cards-page.scss";

type CardKey = "usbar" | "amex" | "savorone" | "bofa" | "freedom" | "autograph";

// Material credit_card icon tinted in the card's brand color.
const MiniCard = ({ card }: { card: CardKey }) => (
  <Icon name="credit_card" className={`card-icon card-icon-${card}`} />
);

type CheatRow = {
  purchase: string;
  icon: string;
  card: string;
  cards: CardKey[];
  why: string;
};

const CHEAT_SHEET: CheatRow[] = [
  {
    purchase: "Flights (booked direct)",
    icon: "flight",
    card: "Amex Platinum",
    cards: ["amex"],
    why: "5x MR points",
  },
  {
    purchase: "Dining",
    icon: "restaurant",
    card: "SavorOne, Autograph, or CFU",
    cards: ["savorone", "autograph", "freedom"],
    why: "3%",
  },
  {
    purchase: "Groceries",
    icon: "grocery",
    card: "SavorOne",
    cards: ["savorone"],
    why: "3% (excl. Walmart/Target)",
  },
  {
    purchase: "Drugstores / pharmacies",
    icon: "local_pharmacy",
    card: "Freedom Unlimited",
    cards: ["freedom"],
    why: "3%",
  },
  {
    purchase: "Online shopping",
    icon: "shopping_cart",
    card: "BofA CCR",
    cards: ["bofa"],
    why: "3% (set choice category)",
  },
  {
    purchase: "Gas / EV, transit",
    icon: "local_gas_station",
    card: "Autograph",
    cards: ["autograph"],
    why: "3x",
  },
  {
    purchase: "Cell phone bill",
    icon: "smartphone",
    card: "Amex Plat or Autograph",
    cards: ["amex", "autograph"],
    why: "Plat: $800/claim protection, 1x · Autograph: $600/claim, 3x",
  },
  {
    purchase: "Streaming",
    icon: "play_circle",
    card: "SavorOne or Autograph",
    cards: ["savorone", "autograph"],
    why: "3%",
  },
  {
    purchase: "Entertainment",
    icon: "theater_comedy",
    card: "SavorOne",
    cards: ["savorone"],
    why: "3%, in-person venues only",
  },
  {
    purchase: "Hotels / rental cars (direct)",
    icon: "hotel",
    card: "Autograph",
    cards: ["autograph"],
    why: "3x travel, no FTF",
  },
  {
    purchase: "Foreign transactions",
    icon: "public",
    card: "SavorOne / Autograph / USBAR / Plat",
    cards: ["savorone", "autograph", "usbar", "amex"],
    why: "All no-FTF — avoid BofA CCR & Freedom Unlimited (3% FTF)",
  },
  {
    purchase: "Everything else (tap-to-pay)",
    icon: "contactless",
    card: "USBAR (mobile wallet)",
    cards: ["usbar"],
    why: "3x @ 1¢ = 3%, capped at $5k/cycle",
  },
  {
    purchase: "Everything else (no tap)",
    icon: "payments",
    card: "Freedom Unlimited",
    cards: ["freedom"],
    why: "1.5% flat — best no-tap catch-all",
  },
];

type CardDetail = {
  cardKey: CardKey;
  name: string;
  tagline: string;
  points: string[];
};

const CARD_DETAILS: CardDetail[] = [
  {
    cardKey: "usbar",
    name: "USBAR (U.S. Bank Altitude Reserve)",
    tagline: "The catch-all (post-nerf)",
    points: [
      "3x on mobile wallet (Apple/Google/Samsung Pay), capped at $5,000/billing cycle, then 1x.",
      "Points worth 1¢ everywhere post-nerf → mobile wallet = flat 3%. 5% discount on gift card redemptions.",
      "Use the US Bank Travel Center only to burn the $325 credit — ideally on a flight (5x portal). Book hotels/cars direct for loyalty perks.",
      "$325 credit only triggers on Travel Center bookings.",
      "Decide at renewal: keep only if you'll use the portal credit, otherwise downgrade to a no-AF US Bank card.",
      "Travel protections when paying with the card: trip cancellation/interruption, trip delay, baggage, primary rental CDW.",
    ],
  },
  {
    cardKey: "amex",
    name: "Amex Platinum",
    tagline: "The credits card, not a spend card",
    points: [
      "Spend only flights (5x) on it. Everything else is 1x — never daily-drive it.",
      "Justify the fee with credits: airline incidental, Uber, digital entertainment, Saks, Clear, hotel credits (FHR/THC), lounge access.",
      "MR transfer partners: Delta direct, or Virgin Atlantic for cheaper Delta awards. Hold MR for awards — don't cash out at 0.6¢.",
    ],
  },
  {
    cardKey: "savorone",
    name: "Capital One SavorOne",
    tagline: "Dining / grocery / entertainment backup",
    points: [
      "3% dining, groceries, entertainment, streaming. No annual fee.",
      "Keep it active — helps future Capital One approvals (e.g. Venture X, which would make these points transferable).",
    ],
  },
  {
    cardKey: "bofa",
    name: "BofA Customized Cash Rewards",
    tagline: "Online shopping specialist",
    points: [
      "Set the 3% choice category deliberately — Online Shopping is usually best since dining/gas are covered elsewhere.",
      "3% choice + 2% grocery/wholesale, capped at $2,500 combined spend/quarter.",
      "3% foreign transaction fee — don't use abroad.",
    ],
  },
  {
    cardKey: "freedom",
    name: "Chase Freedom Unlimited",
    tagline: "The no-tap catch-all",
    points: [
      "1.5% flat on everything — no activation, no rotating categories, no cap. Best option when a merchant doesn't take tap-to-pay.",
      "3% on dining and drugstores; 5% on Chase Travel bookings (prefer direct bookings, so mostly ignore).",
      "Points (Ultimate Rewards) are cash-only for now — with a Sapphire Reserve you could pool CFU points and transfer to partners (Virgin Atlantic → Delta, Hyatt).",
      "3% foreign transaction fee — don't use abroad.",
    ],
  },
  {
    cardKey: "autograph",
    name: "WF Autograph",
    tagline: "Demoted to niche duty",
    points: [
      "Keep for: cell phone bill (3x + $600/claim phone protection), and 3x categories abroad where BofA/Freedom would charge FTF.",
      "No annual fee — keep open for credit age, just stop daily-driving it.",
    ],
  },
];

export const CardsPage = () => {
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
        → USBAR (3%). Category spend → the matching 3x card. No tap → Freedom
        Unlimited (1.5%).
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
                <td className="cheat-purchase">
                  <Icon name={row.icon} className="cheat-purchase-icon" />
                  {row.purchase}
                </td>
                <td className="cheat-card-name">
                  {row.cards.length > 0 && (
                    <span className="cheat-card-icons">
                      {row.cards.map((c) => (
                        <MiniCard key={c} card={c} />
                      ))}
                    </span>
                  )}
                  {row.card}
                </td>
                <td>{row.why}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="cards-section-title">Per-card details</h2>
      <div className="card-details-list">
        {CARD_DETAILS.map((card) => (
          <details key={card.name} className="card-detail">
            <summary>
              <MiniCard card={card.cardKey} />
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
