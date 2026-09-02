import { cookies } from "next/headers";
import { Kpi, Panel } from "@/components/ui";
import { usd } from "@/lib/api";
import { DemoPanel } from "@/components/demo-panel";

const api = process.env.API_PUBLIC_URL ?? "http://localhost:4000";

export default async function CommandCenterPage() {
  const jar = await cookies();
  const token = jar.get(process.env.COOKIE_NAME ?? "zcg_session")?.value;
  const headers = { cookie: `${process.env.COOKIE_NAME ?? "zcg_session"}=${token}` };
  const [kpis, live, ops] = await Promise.all([
    fetch(`${api}/api/v1/reports/kpis?range=today`, { headers, cache: "no-store" }).then((r) => r.json()),
    fetch(`${api}/api/v1/live`, { headers, cache: "no-store" }).then((r) => r.json()),
    fetch(`${api}/api/v1/reports/operations`, { headers, cache: "no-store" }).then((r) => r.json()),
  ]);
  const nearCap = (ops.data ?? []).filter(
    (r: { cap: number | null; remaining: number | null }) => r.cap && r.remaining !== null && r.remaining < r.cap * 0.2,
  );
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Command center</h1>
      <p className="text-sm text-slate-400">Realtime ops board — capacity, live traffic, and demo inbound without PSTN.</p>
      <div className="grid gap-4 md:grid-cols-4">
        <Kpi label="Live / recent" value={String((live.data ?? []).length)} />
        <Kpi label="Revenue today" value={usd(kpis.revenue)} tone="good" />
        <Kpi label="Profit today" value={usd(kpis.profit)} />
        <Kpi label="Routes near cap" value={String(nearCap.length)} tone={nearCap.length ? "warn" : "default"} />
      </div>
      <DemoPanel />
      <Panel title="Capacity">
        <ul className="space-y-2 text-sm">
          {(ops.data ?? []).map((r: Record<string, string | number | null>, i: number) => (
            <li key={i} className="flex justify-between">
              <span>
                {r.buyer} · {r.campaign}
              </span>
              <span className="font-mono text-slate-400">
                {r.deliveredToday} / {r.cap ?? "∞"}
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
