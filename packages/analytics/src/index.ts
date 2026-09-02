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
