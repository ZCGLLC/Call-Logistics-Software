import { Decimal } from "decimal.js";

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_EVEN });

/**
 * Ledger-safe dollar amount with 4 decimal places.
 * Never use IEEE-754 number arithmetic for P&L.
 */
export class Money {
  private readonly value: Decimal;

  private constructor(value: Decimal) {
    this.value = value.toDecimalPlaces(4, Decimal.ROUND_HALF_EVEN);
  }

  static zero(): Money {
    return new Money(new Decimal(0));
  }

  static from(input: Decimal.Value | Money): Money {
    if (input instanceof Money) return input;
    if (input === null || input === undefined || input === "") {
      throw new Error("Money.from: empty value");
    }
    const d = new Decimal(input);
    if (!d.isFinite()) {
      throw new Error("Money.from: non-finite value");
    }
    return new Money(d);
  }

  static tryFrom(input: Decimal.Value | Money | null | undefined): Money | null {
    if (input === null || input === undefined || input === "") return null;
    try {
      return Money.from(input);
    } catch {
      return null;
    }
  }

  add(other: Money): Money {
    return new Money(this.value.plus(other.value));
  }

  sub(other: Money): Money {
    return new Money(this.value.minus(other.value));
  }

  mul(factor: Decimal.Value): Money {
    return new Money(this.value.times(factor));
  }

  neg(): Money {
    return new Money(this.value.negated());
  }

  abs(): Money {
    return new Money(this.value.abs());
  }

  cmp(other: Money): number {
    return this.value.comparedTo(other.value);
  }

  gt(other: Money): boolean {
    return this.value.greaterThan(other.value);
  }

  gte(other: Money): boolean {
    return this.value.greaterThanOrEqualTo(other.value);
  }

  lt(other: Money): boolean {
    return this.value.lessThan(other.value);
  }

  eq(other: Money): boolean {
    return this.value.equals(other.value);
  }

  isZero(): boolean {
    return this.value.isZero();
  }

  isNegative(): boolean {
    return this.value.isNegative() && !this.value.isZero();
  }

  toDecimal(): Decimal {
    return this.value;
  }

  toNumberUnsafe(): number {
    return this.value.toNumber();
  }

  toFixed(places = 4): string {
    return this.value.toFixed(places);
  }

  /** JSON / API wire format — always a string. */
  toJSON(): string {
    return this.toFixed(4);
  }

  toString(): string {
    return this.toFixed(4);
  }

  formatUsd(places = 2): string {
    const sign = this.isNegative() ? "-" : "";
    return `${sign}$${this.abs().value.toFixed(places)}`;
  }
}

export function grossProfit(input: {
  revenue: Money;
  payout: Money;
  telecom: Money;
  other?: Money;
}): Money {
  const other = input.other ?? Money.zero();
  return input.revenue.sub(input.payout).sub(input.telecom).sub(other);
}

/** Margin = profit / revenue. Zero revenue → 0 (not Infinity). */
export function marginRatio(profit: Money, revenue: Money): Decimal {
  if (revenue.isZero()) return new Decimal(0);
  return profit.toDecimal().div(revenue.toDecimal()).toDecimalPlaces(6);
}
