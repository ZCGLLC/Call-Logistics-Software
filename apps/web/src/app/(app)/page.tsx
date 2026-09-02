import { cookies } from "next/headers";
import Link from "next/link";
import { Kpi, Panel, Table } from "@/components/ui";
import { usd, pct } from "@/lib/api";
import { DashboardCharts } from "@/components/charts";

const api = process.env.API_PUBLIC_URL ?? "http://localhost:4000";

async function load(path: string) {
  const jar = await cookies();
  const token = jar.get(process.env.COOKIE_NAME ?? "zcg_session")?.value;
  const res = await fetch(`${api}${path}`, {
    headers: { cookie: `${process.env.COOKIE_NAME ?? "zcg_session"}=${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default async function DashboardPage() {
  const [today, mtd, series, ops] = await Promise.all([
    load("/api/v1/reports/kpis?range=today"),
    load("/api/v1/reports/kpis?range=mtd"),
    load("/api/v1/reports/series"),
    load("/api/v1/reports/operations"),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Executive dashboard</h1>
          <p className="text-sm text-slate-400">Revenue, profit, and fill — UTC windows, displayed for ops.</p>
        </div>
        <Link href="/command-center" className="text-sm text-signal hover:underline">
          Open command center
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Revenue today" value={usd(today.revenue)} hint={`MTD ${usd(mtd.revenue)}`} tone="good" />
        <Kpi label="Gross profit today" value={usd(today.profit)} hint={`MTD ${usd(mtd.profit)}`} tone={Number(today.profit) < 0 ? "warn" : "good"} />
        <Kpi label="Calls today" value={String(today.calls)} hint={`${today.conversions} converted · ${pct(today.conversionPct)}`} />
        <Kpi label="Gross margin" value={pct(Number(today.margin))} hint={`Fill ${pct(today.fillRate)} · avg ${usd(today.avgRevenuePerCall)}`} />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Panel title="14-day revenue & profit">
            <DashboardCharts data={series.data ?? []} />
          </Panel>
        </div>
        <Panel title="Today snapshot">
          <dl className="space-y-3 text-sm">
            <Row k="Avg payout / call" v={usd(today.avgPayoutPerCall)} />
            <Row k="Avg duration" v={`${today.avgDurationSeconds}s`} />
            <Row k="Live / in-flight" v={String(today.live)} />
            <Row k="Telecom (est.)" v={usd(today.telecom)} />
            <Row k="Payout today" v={usd(today.payout)} />
          </dl>
        </Panel>
      </div>
      <Panel title="Operations matrix" action={<Link href="/operations" className="text-xs text-signal">Full board</Link>}>
        <Table
          headers={["Vertical", "Publisher", "Campaign", "Pub rate", "Buyer", "Buyer rate", "Spread", "Cap", "Today", "Status"]}
        >
          {(ops.data ?? []).slice(0, 12).map((r: Record<string, string | number | null>, i: number) => (
            <tr key={i} className="text-slate-200">
              <td className="px-3 py-2">{r.vertical}</td>
              <td className="px-3 py-2">{r.publisher}</td>
              <td className="px-3 py-2">{r.campaign}</td>
              <td className="px-3 py-2 font-mono tabular">{usd(String(r.publisherRate))}</td>
              <td className="px-3 py-2">{r.buyer}</td>
              <td className="px-3 py-2 font-mono tabular">{usd(String(r.buyerRate))}</td>
              <td className="px-3 py-2 font-mono tabular text-signal">{usd(String(r.grossSpread))}</td>
              <td className="px-3 py-2 font-mono">{r.cap ?? "—"}</td>
              <td className="px-3 py-2 font-mono">
                {r.deliveredToday}
                {r.remaining !== null ? ` / ${(r.deliveredToday as number) + (r.remaining as number)}` : ""}
              </td>
              <td className="px-3 py-2 text-xs uppercase text-slate-400">{r.status}</td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-500">{k}</dt>
      <dd className="font-mono tabular">{v}</dd>
    </div>
  );
}
