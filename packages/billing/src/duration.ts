import { Money, grossProfit, marginRatio } from "@zcg/shared";
import { Decimal } from "decimal.js";

export interface DurationRule {
  amount: Money;
  thresholdSeconds: number;
}

export interface ConversionEvaluation {
  converted: boolean;
  reason: string;
  revenue: Money;
  payout: Money;
  telecom: Money;
  other: Money;
  profit: Money;
  margin: string;
  buyerConnectedSeconds: number;
}

export function evaluateDurationConversion(input: {
  buyerConnectedSeconds: number;
  buyer: DurationRule;
  publisher: DurationRule;
  telecom: Money;
  other?: Money;
}): ConversionEvaluation {
  const other = input.other ?? Money.zero();
  const buyerOk = input.buyerConnectedSeconds >= input.buyer.thresholdSeconds;
  const pubOk = input.buyerConnectedSeconds >= input.publisher.thresholdSeconds;

  if (!buyerOk) {
    const zero = Money.zero();
    return {
      converted: false,
      reason: `buyer-connected duration ${input.buyerConnectedSeconds}s < ${input.buyer.thresholdSeconds}s threshold`,
      revenue: zero,
      payout: zero,
      telecom: input.telecom,
      other,
      profit: grossProfit({ revenue: zero, payout: zero, telecom: input.telecom, other }),
      margin: "0.000000",
      buyerConnectedSeconds: input.buyerConnectedSeconds,
    };
  }

  const revenue = input.buyer.amount;
  const payout = pubOk ? input.publisher.amount : Money.zero();
  const profit = grossProfit({ revenue, payout, telecom: input.telecom, other });
  return {
    converted: true,
    reason: `duration ${input.buyerConnectedSeconds}s >= buyer ${input.buyer.thresholdSeconds}s`,
    revenue,
    payout,
    telecom: input.telecom,
    other,
    profit,
    margin: marginRatio(profit, revenue).toFixed(6),
    buyerConnectedSeconds: input.buyerConnectedSeconds,
  };
}

export { grossProfit, marginRatio, Money, Decimal };
