// Credit card cheat-sheet reference page. The table is a projection of
// the Recommendation engine over the Earn Rate data — never hand-written.
// Reachable only via the settings drawer.

import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../components/kit/icon";
import { everythingElse, recommendAll } from "../domain/card-recommendations";
import type {
  CardKey,
  EarnRate,
  SpendCategory,
  TravelInsuranceTier,
} from "../domain/card-rewards";
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

// Travel-insurance badge. Only "full" gets colour — the point of the badge
// is to answer "which card do I put the trip on?" at a glance, so the two
// cards that actually protect a trip should be the ones that stand out.
const TRAVEL_INSURANCE_BADGES: Record<
  TravelInsuranceTier,
  { label: string; icon: string }
> = {
  full: { label: "trip protected", icon: "verified_user" },
  "rental-only": { label: "rental car only", icon: "directions_car" },
  none: { label: "no trip cover", icon: "shield" },
  verify: { label: "check coverage", icon: "help" },
};

const TravelInsuranceBadge = ({ card }: { card: CardKey }) => {
  const tier = CARDS[card].travelInsurance;
  const { label, icon } = TRAVEL_INSURANCE_BADGES[tier];
  return (
    <span
      className={`travel-badge travel-badge-${tier}`}
      title={CARDS[card].travelInsuranceNote}
    >
      <Icon name={icon} className="travel-badge-icon" />
      {label}
    </span>
  );
};

type CardDetail = {
  cardKey: CardKey;
  name: string;
  tagline: string;
  points: string[];
};

// Playbook context only — rates, caps, and category picks are the table's
// job, so anything derivable from an Earn Rate is deliberately absent here.
// Travel protections come from the card data, not these bullets.
const CARD_DETAILS: CardDetail[] = [
  {
    cardKey: "usbar",
    name: "USBAR (U.S. Bank Altitude Reserve)",
    tagline: "The catch-all (post-nerf)",
    points: [
      "Points redeem at 1¢ everywhere post-nerf, plus a 5% discount on gift card redemptions.",
      "Use the US Bank Travel Center only to burn the $325 credit — it won't trigger on anything else. A flight is the best thing to spend it on (5x in the portal); book hotels/cars direct for loyalty perks.",
      "$400 annual fee, which makes this borderline: a capped 3% catch-all plus Priority Pass for $400. Decide at renewal — keep only if you'll run ≥$325/yr through the portal, otherwise downgrade to a no-AF US Bank card.",
      "Downgrading loses the grandfathered mobile-wallet earn, but at 3% capped it's no longer sacred.",
    ],
  },
  {
    cardKey: "amex",
    name: "Amex Platinum",
    tagline: "The credits card, not a spend card",
    points: [
      "Never daily-drive it — everything outside flights earns 1x.",
      "Justify the fee with credits: airline incidental, Uber, digital entertainment, Saks, Clear, hotel credits (FHR/THC), lounge access.",
      "MR transfer partners: Delta direct, or Virgin Atlantic for cheaper Delta awards. Hold MR for awards — don't cash out at 0.6¢.",
    ],
  },
  {
    cardKey: "savorone",
    name: "Capital One SavorOne",
    tagline: "Dining / grocery / entertainment backup",
    points: [
      "No annual fee — keep it active regardless, since it helps future Capital One approvals (e.g. Venture X, which would make these points transferable).",
    ],
  },
  {
    cardKey: "bofa",
    name: "BofA Customized Cash Rewards",
    tagline: "Online shopping specialist",
    points: [
      "Set the 3% choice category deliberately — Online Shopping is usually best, since dining and gas are covered elsewhere.",
      "With ≥$100k at BofA/Merrill (Platinum Honors) the rates jump to 5.25% / 3.5%, which would beat USBAR for online shopping. Worth consolidating assets to hit a tier.",
      "3% foreign transaction fee — don't use abroad.",
    ],
  },
  {
    cardKey: "freedom",
    name: "Chase Freedom Unlimited",
    tagline: "The physical-card catch-all",
    points: [
      "No activation, no rotating categories, no cap — the fallback whenever a merchant won't take tap-to-pay.",
      "5% on Chase Travel bookings, but you prefer booking direct, so mostly ignore it.",
      "Points (Ultimate Rewards) are cash-only for now — with a Sapphire Reserve you could pool CFU points and transfer to partners (Virgin Atlantic → Delta, Hyatt).",
      "3% foreign transaction fee — don't use abroad.",
    ],
  },
  {
    cardKey: "autograph",
    name: "WF Autograph",
    tagline: "Demoted to niche duty",
    points: [
      "Keep it for 3x categories abroad, where BofA and Freedom would both charge FTF.",
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
              <TravelInsuranceBadge card={card.cardKey} />
              <Icon name="expand_more" className="card-detail-chevron" />
            </summary>
            <ul>
              <li className="card-detail-travel">
                <strong>Travel insurance:</strong>{" "}
                {CARDS[card.cardKey].travelInsuranceNote}
              </li>
              {card.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </details>
        ))}
      </div>

      <p className="cards-footnote">
        Coverage summaries are directional — dollar caps and exclusions change,
        so check the issuer's Guide to Benefits before you rely on one for a
        real trip.
      </p>
    </div>
  );
};
