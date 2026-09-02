import { describe, expect, it } from "vitest";
import { runFakeAuction, selectWinner } from "./index.js";

describe("RTB fake auction (scenario 4)", () => {
  it("selects B at $45, D rejects", () => {
    const bids = runFakeAuction([
      {
        buyerId: "a",
        buyerName: "A",
        latencyMs: 40,
        response: { accept: true, bid: "32.00", destination: "+18005550101" },
      },
      {
        buyerId: "b",
        buyerName: "B",
        latencyMs: 55,
        response: { accept: true, bid: "45.00", destination: "+18005550102" },
      },
      {
        buyerId: "c",
        buyerName: "C",
        latencyMs: 80,
        response: { accept: true, bid: "39.00", destination: "+18005550103" },
      },
      { buyerId: "d", buyerName: "D", latencyMs: 20, response: { accept: false } },
    ]);
    expect(selectWinner(bids)?.buyerName).toBe("B");
    expect(bids.find((b) => b.buyerName === "D")?.rejectionReason).toBe("buyer rejected");
  });

  it("times out a slow bidder without blocking", () => {
    const bids = runFakeAuction(
      [
        {
          buyerId: "slow",
          buyerName: "Slow",
          latencyMs: 5000,
          response: { accept: true, bid: "99.00", destination: "+18005550999" },
        },
        {
          buyerId: "fast",
          buyerName: "Fast",
          latencyMs: 20,
          response: { accept: true, bid: "10.00", destination: "+18005550100" },
        },
      ],
      1200,
    );
    expect(selectWinner(bids)?.buyerName).toBe("Fast");
    expect(bids.find((b) => b.buyerName === "Slow")?.rejectionReason).toBe("timeout");
  });
});
