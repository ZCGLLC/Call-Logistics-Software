import { describe, expect, it } from "vitest";
import { Money, grossProfit, marginRatio } from "./money.js";

describe("Money", () => {
  it("does not use floating-point for 0.1 + 0.2 style sums", () => {
    const a = Money.from("0.1000");
    const b = Money.from("0.2000");
    expect(a.add(b).toFixed(4)).toBe("0.3000");
  });

  it("computes scenario 1 P&L exactly", () => {
    const revenue = Money.from("42.00");
    const payout = Money.from("28.00");
    const telecom = Money.from("0.0400");
    const profit = grossProfit({ revenue, payout, telecom });
    expect(profit.toFixed(4)).toBe("13.9600");
    expect(marginRatio(profit, revenue).toFixed(6)).toBe("0.332381");
  });

  it("computes scenario 2 converted P&L", () => {
    const profit = grossProfit({
      revenue: Money.from("14"),
      payout: Money.from("10"),
      telecom: Money.from("0.04"),
    });
    expect(profit.toFixed(4)).toBe("3.9600");
  });

  it("serializes as string", () => {
    expect(JSON.stringify({ amount: Money.from("42") })).toBe('{"amount":"42.0000"}');
  });
});
