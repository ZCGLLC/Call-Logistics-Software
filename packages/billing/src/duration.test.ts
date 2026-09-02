import { describe, expect, it } from "vitest";
import { Money } from "@zcg/shared";
import { evaluateDurationConversion } from "./duration.js";

describe("duration conversion", () => {
  it("does not convert below threshold (scenario 2a: 8s vs 10s)", () => {
    const r = evaluateDurationConversion({
      buyerConnectedSeconds: 8,
      buyer: { amount: Money.from("14"), thresholdSeconds: 10 },
      publisher: { amount: Money.from("10"), thresholdSeconds: 10 },
      telecom: Money.from("0.04"),
    });
    expect(r.converted).toBe(false);
    expect(r.revenue.toFixed(4)).toBe("0.0000");
    expect(r.payout.toFixed(4)).toBe("0.0000");
  });

  it("converts at/after threshold (scenario 2b: 14s vs 10s)", () => {
    const r = evaluateDurationConversion({
      buyerConnectedSeconds: 14,
      buyer: { amount: Money.from("14"), thresholdSeconds: 10 },
      publisher: { amount: Money.from("10"), thresholdSeconds: 10 },
      telecom: Money.from("0.04"),
    });
    expect(r.converted).toBe(true);
    expect(r.revenue.toFixed(4)).toBe("14.0000");
    expect(r.payout.toFixed(4)).toBe("10.0000");
    expect(r.profit.toFixed(4)).toBe("3.9600");
  });

  it("scenario 1: 130s vs 90s → $42 / $28", () => {
    const r = evaluateDurationConversion({
      buyerConnectedSeconds: 130,
      buyer: { amount: Money.from("42"), thresholdSeconds: 90 },
      publisher: { amount: Money.from("28"), thresholdSeconds: 90 },
      telecom: Money.from("0.04"),
    });
    expect(r.converted).toBe(true);
    expect(r.revenue.toFixed(4)).toBe("42.0000");
    expect(r.payout.toFixed(4)).toBe("28.0000");
    expect(r.profit.toFixed(4)).toBe("13.9600");
  });

  it("does not fire early at 89s for 90s rule", () => {
    const r = evaluateDurationConversion({
      buyerConnectedSeconds: 89,
      buyer: { amount: Money.from("42"), thresholdSeconds: 90 },
      publisher: { amount: Money.from("28"), thresholdSeconds: 90 },
      telecom: Money.from("0.04"),
    });
    expect(r.converted).toBe(false);
  });
});
