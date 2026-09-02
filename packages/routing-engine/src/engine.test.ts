import { describe, expect, it } from "vitest";
import { Money } from "@zcg/shared";
import { route } from "./engine.js";
import { dest, snapshot } from "./test-helpers.js";

describe("routing engine", () => {
  it("excludes inactive destinations", () => {
    const r = route(
      snapshot([
        dest({ id: "a", buyerId: "ba", buyerName: "Buyer A", active: false, revenue: Money.from("50") }),
        dest({ id: "b", buyerId: "bb", buyerName: "Buyer B", revenue: Money.from("40") }),
      ]),
    );
    expect(r.selected?.destination.buyerName).toBe("Buyer B");
    expect(r.rejected.some((x) => x.reasons.includes("destination inactive"))).toBe(true);
  });

  it("excludes capped buyers", () => {
    const r = route(
      snapshot([
        dest({
          id: "a",
          buyerId: "ba",
          buyerName: "Buyer A",
          revenue: Money.from("50"),
          caps: {
            concurrent: 0,
            concurrentLimit: null,
            hourly: 0,
            hourlyLimit: null,
            daily: 200,
            dailyLimit: 200,
            weekly: 0,
            weeklyLimit: null,
            monthly: 0,
            monthlyLimit: null,
          },
        }),
        dest({ id: "b", buyerId: "bb", buyerName: "Buyer B", revenue: Money.from("40") }),
      ]),
    );
    expect(r.selected?.destination.buyerName).toBe("Buyer B");
    expect(r.explanation).toMatch(/daily cap reached/);
  });

  it("excludes wrong state", () => {
    const r = route(
      snapshot([
        dest({ id: "a", buyerId: "ba", buyerName: "Buyer A", allowedStates: ["CA"], revenue: Money.from("50") }),
        dest({ id: "b", buyerId: "bb", buyerName: "Buyer B", allowedStates: ["TX"], revenue: Money.from("40") }),
      ]),
    );
    expect(r.selected?.destination.buyerName).toBe("Buyer B");
    expect(r.explanation).toMatch(/TX not accepted/);
  });

  it("highest revenue selects Buyer B at $42 over $35 (MVP scenario 1)", () => {
    const r = route(
      snapshot([
        dest({
          id: "a",
          buyerId: "ba",
          buyerName: "Buyer A",
          bid: Money.from("35"),
          revenue: Money.from("35"),
        }),
        dest({
          id: "b",
          buyerId: "bb",
          buyerName: "Buyer B",
          bid: Money.from("42"),
          revenue: Money.from("42"),
        }),
      ]),
    );
    expect(r.selected?.destination.buyerName).toBe("Buyer B");
    expect(r.explanation).toMatch(/highest eligible revenue/);
  });

  it("higher priority wins", () => {
    const r = route(
      snapshot(
        [
          dest({ id: "a", buyerId: "ba", buyerName: "Buyer A", priority: 10, revenue: Money.from("40") }),
          dest({ id: "b", buyerId: "bb", buyerName: "Buyer B", priority: 1, revenue: Money.from("40") }),
        ],
        { campaign: { id: "c", verticalId: "vert_medicare", routingStrategy: "PRIORITY", timezone: "UTC" } },
      ),
    );
    expect(r.selected?.destination.buyerName).toBe("Buyer B");
  });

  it("weighted selection is deterministic for a call id", () => {
    const dests = [
      dest({ id: "a", buyerId: "ba", buyerName: "Buyer A", weight: 1, revenue: Money.from("10") }),
      dest({ id: "b", buyerId: "bb", buyerName: "Buyer B", weight: 99, revenue: Money.from("10") }),
    ];
    const s = snapshot(dests, {
      campaign: { id: "c", verticalId: "vert_medicare", routingStrategy: "WEIGHTED", timezone: "UTC" },
    });
    const first = route(s).selected?.destination.buyerName;
    const second = route(s).selected?.destination.buyerName;
    expect(first).toBe(second);
    expect(first).toBe("Buyer B");
  });

  it("duplicate REJECT blocks all", () => {
    const r = route(
      snapshot([dest({ id: "a", buyerId: "ba", buyerName: "Buyer A" })], {
        call: {
          id: "call_dup",
          callerE164: "+12145551234",
          state: "TX",
          attributes: {},
          ivr: {},
          publisherId: "pub_a",
          campaignId: "cam_med_tx",
          isDuplicate: true,
          duplicateAction: "REJECT",
          isSuppressed: false,
        },
      }),
    );
    expect(r.selected).toBeUndefined();
    expect(r.explanation).toMatch(/Duplicate/);
  });

  it("MAX_GROSS_PROFIT prefers lower revenue with better spread", () => {
    const r = route(
      snapshot(
        [
          dest({
            id: "a",
            buyerId: "ba",
            buyerName: "High rev thin",
            revenue: Money.from("50"),
            payout: Money.from("48"),
            estimatedTelecom: Money.from("0.04"),
          }),
          dest({
            id: "b",
            buyerId: "bb",
            buyerName: "Lower rev fat",
            revenue: Money.from("40"),
            payout: Money.from("20"),
            estimatedTelecom: Money.from("0.04"),
          }),
        ],
        {
          campaign: {
            id: "c",
            verticalId: "vert_medicare",
            routingStrategy: "MAX_GROSS_PROFIT",
            timezone: "UTC",
          },
        },
      ),
    );
    expect(r.selected?.destination.buyerName).toBe("Lower rev fat");
  });

  it("closed hours exclude destination", () => {
    const r = route(
      snapshot([
        dest({
          id: "a",
          buyerId: "ba",
          buyerName: "Buyer A",
          revenue: Money.from("90"),
          hours: {
            timezone: "America/Chicago",
            days: [1, 2, 3, 4, 5],
            openMinutes: 8 * 60,
            closeMinutes: 9 * 60,
            holidays: [],
            blackoutDates: [],
          },
        }),
        dest({ id: "b", buyerId: "bb", buyerName: "Buyer B", revenue: Money.from("10") }),
      ]),
    );
    expect(r.selected?.destination.buyerName).toBe("Buyer B");
    expect(r.explanation).toMatch(/outside hours|holiday|closed/);
  });

  it("waterfall order is ranked list (scenario 3 order)", () => {
    const r = route(
      snapshot([
        dest({ id: "a", buyerId: "ba", buyerName: "Buyer A", revenue: Money.from("45") }),
        dest({ id: "b", buyerId: "bb", buyerName: "Buyer B", revenue: Money.from("40") }),
        dest({ id: "c", buyerId: "bc", buyerName: "Buyer C", revenue: Money.from("36") }),
      ]),
    );
    expect(r.eligible.map((e) => e.destination.buyerName)).toEqual(["Buyer A", "Buyer B", "Buyer C"]);
  });
});
