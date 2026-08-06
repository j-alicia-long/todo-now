// Credit card cheat-sheet reference page. The table is a projection of
// the Recommendation engine over the Earn Rate data — never hand-written.
// Reachable only via the settings drawer.

import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../components/ui";
import { everythingElse, recommendAll } from "../domain/card-recommendations";
import type { CardKey, EarnRate, SpendCategory } from "../domain/card-rewards";
import { CARDS, CARD_KEYS } from "../domain/card-rewards";
import { useSettings } from "../stores/hooks";
import "./cards-page.scss";

// Material credit_card icon tinted in the card's brand color.
const MiniCard = ({ card }: { card: CardKey }) => (
  <Icon name="credit_card" className={`card-icon card-icon-${card}`} />
);

// Presentation metadata only — the picks themselves come from the engine.
const CATEGORY_LABELS: Record<SpendCategory, { label: string; icon: string }> =
  {
    flights: { label: "Flights (booked direct)", icon: "flight" },
    dining: { label: "Dining", icon: "restaurant" },
    groceries: { label: "Groceries", icon: "grocery" },
    drugstores: { label: "Drugstores / pharmacies", icon: "local_pharmacy" },
    "online-shopping": { label: "Online shopping", icon: "shopping_cart" },
    "gas-transit": { label: "Gas / EV, transit", icon: "local_gas_station" },
    "cell-phone": { label: "Cell phone bill", icon: "smartphone" },
    streaming: { label: "Streaming", icon: "play_circle" },
    entertainment: { label: "Entertainment", icon: "theater_comedy" },
    "hotels-cars": { label: "Hotels / rental cars (direct)", icon: "hotel" },
    "amazon-walmart-target": {
      label: "Amazon / Walmart / Target",
      icon: "storefront",
    },
  };

const whyText = (rate: EarnRate): string => {
  const strings = rate.strings.map((s) => s.display);
  return [rate.note, ...strings].join(" · ");
};

// One pick inside a card cell: brand icon, name, transferable badge,
// and — for a tied runner-up — its caveat inline. A mobile-wallet
// caveat collapses to a contactless icon (full text on hover) to
// keep the column compact.
const PickCell = ({
  rate,
  caveat = false,
}: {
  rate: EarnRate;
  caveat?: boolean;
}) => {
  const caveatText = rate.strings.map((s) => s.display).join(", ");
  const mobileWallet = rate.strings.some(
    (s) => s.kind === "mobile-wallet-required"
  );
  return (
    <span className="cheat-pick">
      <MiniCard card={rate.card} />
      {CARDS[rate.card].name}
      {caveat && rate.strings.length > 0 && (
        <span className="cheat-caveat" title={caveatText}>
          {mobileWallet ? (
            <Icon name="contactless" className="cheat-caveat-icon" />
          ) : (
            `(${caveatText})`
          )}
        </span>
      )}
    </span>
  );
};

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
      "Cell phone protection: $800/claim if you pay the bill with it — beats Autograph's $600, but you trade 3x for 1x.",
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
    tagline: "The physical-card catch-all",
    points: [
      "1.5% flat on everything — no activation, no rotating categories, no cap. Best option when you can't pay by mobile wallet (Apple Pay etc).",
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
  const { settings, set } = useSettings();
  const wallet = settings.walletCards;
  // Ephemeral by design: trips end, and a persisted stale Abroad toggle
  // would silently hide two cards.
  const [abroad, setAbroad] = useState(false);
  const recommendations = recommendAll({ wallet, abroad });
  const catchAll = everythingElse({ wallet, abroad });

  const toggleCard = (card: CardKey) =>
    set(
      "walletCards",
      wallet.includes(card)
        ? wallet.filter((c) => c !== card)
        : [...wallet, card]
    );

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
        Which card to pull out, at a glance. Toggle off any card you don't have
        on hand — the table recomputes to what's actually in your pocket.
      </p>

      <div className="wallet-chips" role="group" aria-label="Cards on hand">
        {CARD_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            className={`wallet-chip ${wallet.includes(key) ? "on" : "off"}`}
            aria-pressed={wallet.includes(key)}
            onClick={() => toggleCard(key)}
          >
            <MiniCard card={key} />
            {CARDS[key].name}
          </button>
        ))}
        <button
          type="button"
          className={`wallet-chip abroad-chip ${abroad ? "on" : "off"}`}
          aria-pressed={abroad}
          onClick={() => setAbroad((a) => !a)}
        >
          <Icon name="public" className="card-icon" />
          Abroad
        </button>
      </div>

      {recommendations.length === 0 ? (
        <p className="cards-empty">
          <Icon name="wallet" /> No cards on hand — tap a card above to add it
          back to your wallet.
        </p>
      ) : (
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
              {recommendations.map(({ category, pick, tiedWith }) => (
                <tr key={category}>
                  <td className="cheat-purchase">
                    <Icon
                      name={CATEGORY_LABELS[category].icon}
                      className="cheat-purchase-icon"
                    />
                    {CATEGORY_LABELS[category].label}
                  </td>
                  <td className="cheat-card-name">
                    <PickCell rate={pick} />
                    {tiedWith && (
                      <>
                        <br />
                        <PickCell rate={tiedWith} caveat />
                      </>
                    )}
                  </td>
                  <td>{whyText(pick)}</td>
                </tr>
              ))}
              <tr>
                <td className="cheat-purchase">
                  <Icon name="contactless" className="cheat-purchase-icon" />
                  Everything else
                </td>
                <td className="cheat-card-name">
                  {catchAll.mobileWallet && (
                    <>
                      <PickCell rate={catchAll.mobileWallet} />
                      {" (mobile wallet)"}
                    </>
                  )}
                  {catchAll.physicalCard &&
                    catchAll.physicalCard.card !==
                      catchAll.mobileWallet?.card && (
                      <>
                        {catchAll.mobileWallet && <br />}
                        <PickCell rate={catchAll.physicalCard} />
                        {" (physical card)"}
                      </>
                    )}
                </td>
                <td>
                  Mobile wallet:{" "}
                  {catchAll.mobileWallet && whyText(catchAll.mobileWallet)}
                  <br />
                  Physical card:{" "}
                  {catchAll.physicalCard &&
                    catchAll.physicalCard.card !==
                      catchAll.mobileWallet?.card &&
                    whyText(catchAll.physicalCard)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

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
