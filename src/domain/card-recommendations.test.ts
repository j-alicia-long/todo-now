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
  test("full wallet: USBAR tap-to-pay pick and Freedom no-tap fallback", () => {
    const ee = everythingElse({ wallet: FULL_WALLET });
    expect(ee.tap?.card).toBe("usbar");
    expect(ee.tap?.rate).toBe(3);
    expect(ee.noTap?.card).toBe("freedom");
    expect(ee.noTap?.rate).toBe(1.5);
  });

  test("no USBAR: both picks fall to the best flat card", () => {
    const ee = everythingElse({
      wallet: ["amex", "savorone", "bofa", "freedom", "autograph"],
    });
    expect(ee.tap?.card).toBe("freedom");
    expect(ee.noTap?.card).toBe("freedom");
  });
});
