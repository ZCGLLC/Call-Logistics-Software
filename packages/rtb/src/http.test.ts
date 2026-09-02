import { describe, expect, it } from "vitest";
import { pingHttpBidder } from "./http.js";

describe("live HTTP bidder", () => {
  it("validates an accepted ping within timeout", async () => {
    const bid = await pingHttpBidder(
      { buyerId: "b", buyerName: "B", url: "https://buyer.example/ping", timeoutMs: 200 },
      { state: "TX" },
      async () =>
        new Response(JSON.stringify({ accept: true, bid: "45.00", destination: "+18005550102" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    expect(bid.accepted).toBe(true);
    expect(bid.bid?.toFixed(2)).toBe("45.00");
  });

  it("rejects when the fetch aborts as a timeout", async () => {
    const bid = await pingHttpBidder(
      { buyerId: "slow", buyerName: "Slow", url: "https://buyer.example/ping", timeoutMs: 20 },
      {},
      async (_url, init) => {
        await new Promise((_, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        });
        return new Response("nope");
      },
    );
    expect(bid.accepted).toBe(false);
  });
});
