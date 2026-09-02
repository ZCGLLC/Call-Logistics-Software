/** Warehouse port. Postgres implements this in the API for MVP. */
export interface KpiRange {
  from: Date;
  to: Date;
}

export interface KpiTotals {
  calls: number;
  conversions: number;
  conversionPct: number;
  revenue: string;
  payout: string;
  telecom: string;
  profit: string;
  margin: string;
  avgRevenuePerCall: string;
  avgPayoutPerCall: string;
  fillRate: string;
  avgDurationSeconds: number;
}

export interface AnalyticsStore {
  kpis(organizationId: string, range: KpiRange): Promise<KpiTotals>;
}

export interface HealthInputs {
  calls: number;
  answered: number;
  conversions: number;
  capLimit: number | null;
  delivered: number;
}

/** Explainable 0–100 score. Not a financial figure. */
export function partnerHealthScore(input: HealthInputs): { score: number; breakdown: Record<string, number> } {
  const answerRate = input.calls ? input.answered / input.calls : 0;
  const conversionRate = input.calls ? input.conversions / input.calls : 0;
  const utilization =
    input.capLimit && input.capLimit > 0 ? Math.min(1, input.delivered / input.capLimit) : 0.5;
  const breakdown = {
    answer: Math.round(answerRate * 40),
    conversion: Math.round(conversionRate * 35),
    capacityHeadroom: Math.round((1 - utilization) * 25),
  };
  return { score: breakdown.answer + breakdown.conversion + breakdown.capacityHeadroom, breakdown };
}

export interface OpportunityRow {
  kind: "unused_capacity" | "low_fill" | "negative_margin";
  label: string;
  detail: string;
}

export function findOpportunities(rows: Array<{
  campaign: string;
  buyer: string;
  cap: number | null;
  delivered: number;
  fillRate: number;
  profit: number;
}>): OpportunityRow[] {
  const out: OpportunityRow[] = [];
  for (const r of rows) {
    if (r.cap && r.delivered < r.cap * 0.5 && r.fillRate >= 0.7) {
      out.push({
        kind: "unused_capacity",
        label: `${r.buyer} · ${r.campaign}`,
        detail: `${r.delivered}/${r.cap} used with ${Math.round(r.fillRate * 100)}% fill — headroom remains.`,
      });
    }
    if (r.fillRate < 0.4 && r.delivered > 5) {
      out.push({
        kind: "low_fill",
        label: `${r.buyer} · ${r.campaign}`,
        detail: `Fill ${Math.round(r.fillRate * 100)}% — check hours, numbers, or buyer answer rate.`,
      });
    }
    if (r.profit < 0) {
      out.push({
        kind: "negative_margin",
        label: `${r.buyer} · ${r.campaign}`,
        detail: "Route is losing money on a fully loaded basis.",
      });
    }
  }
  return out;
}
