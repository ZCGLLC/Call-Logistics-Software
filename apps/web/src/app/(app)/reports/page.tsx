import { cookies } from "next/headers";
import { Kpi, Panel } from "@/components/ui";
import { usd, pct } from "@/lib/api";
import { DashboardCharts } from "@/components/charts";

const api = process.env.API_PUBLIC_URL ?? "http://localhost:4000";

export default async function ReportsPage() {
  const jar = await cookies();
  const token = jar.get(process.env.COOKIE_NAME ?? "zcg_session")?.value;
  const headers = { cookie: `${process.env.COOKIE_NAME ?? "zcg_session"}=${token}` };
  const [kpis, series] = await Promise.all([
    fetch(`${api}/api/v1/reports/kpis?range=mtd`, { headers, cache: "no-store" }).then((r) => r.json()),
    fetch(`${api}/api/v1/reports/series`, { headers, cache: "no-store" }).then((r) => r.json()),
  ]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Reports</h1>
      <div className="grid gap-4 md:grid-cols-4">
        <Kpi label="MTD revenue" value={usd(kpis.revenue)} />
        <Kpi label="MTD profit" value={usd(kpis.profit)} tone="good" />
        <Kpi label="Conversion" value={pct(kpis.conversionPct)} />
        <Kpi label="Fill rate" value={pct(kpis.fillRate)} />
      </div>
      <Panel title="Daily series">
        <DashboardCharts data={series.data ?? []} />
      </Panel>
    </div>
  );
}
