// Behavioral tests for the Recommendation engine: given Earn Rates, a
// Wallet, and toggles → which Card(s) per Spend Category. Expected
// values come from the current cheat-sheet / card-maximization guide,
// never recomputed from the data module.

import { describe, test, expect } from "bun:test";
import { CARD_KEYS } from "./card-rewards";
import { recommendAll, everythingElse } from "./card-recommendations";

const FULL_WALLET = [...CARD_KEYS];

describe("recommendAll — full-wallet baseline", () => {
  test("each category's best pick matches the cheat-sheet", () => {
    const recs = recommendAll({ wallet: FULL_WALLET });
    const picks = Object.fromEntries(
      recs.map((r) => [r.category, r.pick.card])
    );
    expect(picks).toEqual({
      flights: "amex",
      dining: "savorone",
      groceries: "savorone",
      drugstores: "freedom",
      "online-shopping": "bofa",
      "gas-transit": "autograph",
      "cell-phone": "autograph",
      streaming: "savorone",
      entertainment: "savorone",
      "hotels-cars": "autograph",
      "amazon-walmart-target": "usbar",
    });
  });
});

describe("recommendAll — Wildcard suppression", () => {
  test("USBAR never appears in dining while a clean equal card is on hand", () => {
    const recs = recommendAll({ wallet: FULL_WALLET });
    const dining = recs.find((r) => r.category === "dining")!;
    expect(dining.pick.card).not.toBe("usbar");
    expect(dining.tiedWith?.card).not.toBe("usbar");
  });

  test("USBAR's mobile-wallet 3% surfaces when the clean cards are off hand", () => {
    // No SavorOne / Autograph / Freedom → the wildcard is the real
    // dining answer (3% beats Amex's 1x catch-all).
    const recs = recommendAll({ wallet: ["usbar", "amex", "bofa"] });
    const dining = recs.find((r) => r.category === "dining")!;
    expect(dining.pick.card).toBe("usbar");
    expect(dining.pick.rate).toBe(3);
  });
});

describe("recommendAll — tied-with-caveat", () => {
  test("a category with a unique best rate has no runner-up", () => {
    const recs = recommendAll({ wallet: FULL_WALLET });
    const flights = recs.find((r) => r.category === "flights")!;
    expect(flights.pick.card).toBe("amex");
    expect(flights.tiedWith).toBeUndefined();
  });

  test("ties on rate break by fewest Strings and surface the runner-up", () => {
    // Groceries: SavorOne 3% (1 string) beats the USBAR wildcard 3%
    // (2 strings); the stringier card shows as tied-with-caveat.
    const recs = recommendAll({ wallet: FULL_WALLET });
    const groceries = recs.find((r) => r.category === "groceries")!;
    expect(groceries.pick.card).toBe("savorone");
    expect(groceries.tiedWith?.card).toBe("usbar");
    expect(groceries.tiedWith?.strings.length).toBeGreaterThan(
      groceries.pick.strings.length
    );
  });

  test("a clean three-way dining tie picks one card and shows one tied fallback", () => {
    const recs = recommendAll({ wallet: FULL_WALLET });
    const dining = recs.find((r) => r.category === "dining")!;
    expect(dining.pick.card).toBe("savorone");
    expect(dining.tiedWith?.rate).toBe(dining.pick.rate);
  });
});

describe("everythingElse — dual pick", () => {
  test("full wallet: USBAR mobile-wallet pick and Freedom physical-card fallback", () => {
    const ee = everythingElse({ wallet: FULL_WALLET });
    expect(ee.mobileWallet?.card).toBe("usbar");
    expect(ee.mobileWallet?.rate).toBe(3);
    expect(ee.physicalCard?.card).toBe("freedom");
    expect(ee.physicalCard?.rate).toBe(1.5);
  });

  test("no USBAR: both picks fall to the best flat card", () => {
    const ee = everythingElse({
      wallet: ["amex", "savorone", "bofa", "freedom", "autograph"],
    });
    expect(ee.mobileWallet?.card).toBe("freedom");
    expect(ee.physicalCard?.card).toBe("freedom");
  });
});

describe("recommendAll — Wallet filtering", () => {
  test("no SavorOne: dining falls to the Autograph/CFU tie", () => {
    const recs = recommendAll({
      wallet: ["usbar", "amex", "bofa", "freedom", "autograph"],
    });
    const dining = recs.find((r) => r.category === "dining")!;
    expect(dining.pick.card).toBe("autograph");
    expect(dining.tiedWith?.card).toBe("freedom");
  });

  test("recommendations never name an off-hand card", () => {
    const wallet: typeof FULL_WALLET = ["usbar", "freedom"];
    const recs = recommendAll({ wallet });
    for (const r of recs) {
      expect(wallet).toContain(r.pick.card);
      if (r.tiedWith) expect(wallet).toContain(r.tiedWith.card);
    }
  });

  test("empty Wallet yields no recommendations and no catch-all picks", () => {
    expect(recommendAll({ wallet: [] })).toEqual([]);
    const ee = everythingElse({ wallet: [] });
    expect(ee.mobileWallet).toBeUndefined();
    expect(ee.physicalCard).toBeUndefined();
  });
});

describe("recommendAll — Abroad", () => {
  test("FTF cards (BofA, Freedom) are never recommended abroad", () => {
    const recs = recommendAll({ wallet: FULL_WALLET, abroad: true });
    for (const r of recs) {
      expect(["bofa", "freedom"]).not.toContain(r.pick.card);
      if (r.tiedWith) {
        expect(["bofa", "freedom"]).not.toContain(r.tiedWith.card);
      }
    }
  });

  test("drugstores re-ranks abroad: Freedom's 3% gives way to the USBAR wildcard", () => {
    const recs = recommendAll({ wallet: FULL_WALLET, abroad: true });
    const drugstores = recs.find((r) => r.category === "drugstores")!;
    expect(drugstores.pick.card).toBe("usbar");
  });

  test("physical-card catch-all abroad falls past Freedom to a no-FTF card", () => {
    const ee = everythingElse({ wallet: FULL_WALLET, abroad: true });
    expect(ee.mobileWallet?.card).toBe("usbar");
    expect(ee.physicalCard?.card).not.toBe("freedom");
    expect(ee.physicalCard?.card).not.toBe("bofa");
  });

  test("abroad composes with the Wallet, it does not modify it", () => {
    // Freedom stays in the Wallet; domestic answers are unchanged.
    const home = recommendAll({ wallet: FULL_WALLET, abroad: false });
    expect(home.find((r) => r.category === "drugstores")!.pick.card).toBe(
      "freedom"
    );
  });
});
