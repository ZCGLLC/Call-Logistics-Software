import { Kpi, Panel } from "@/components/ui";
import { serverApi } from "@/lib/server";

export default async function HealthPage() {
  const [health, scores, opportunities] = await Promise.all([
    serverApi<{
      api: string;
      database: string;
      redis: string;
      telephony: string;
      lastCall: { publicId: string; startedAt: string; status: string } | null;
      webhooks: { pending: number; dlq: number };
    }>("/api/v1/ops/health"),
    serverApi<{ data: Array<{ company: string; score: number; breakdown: Record<string, number> }> }>("/api/v1/ops/health-scores"),
    serverApi<{ data: Array<{ kind: string; label: string; detail: string }> }>("/api/v1/ops/opportunities"),
  ]);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">System health</h1>
      <div className="grid gap-4 md:grid-cols-4">
        <Kpi label="API" value={health.api} tone="good" />
        <Kpi label="Database" value={health.database} tone="good" />
        <Kpi label="Redis caps" value={health.redis} tone={health.redis === "down" ? "warn" : "default"} />
        <Kpi label="Telephony" value={health.telephony} />
      </div>
      <Panel title="Queues">
        <p className="text-sm text-slate-400">
          Webhook pending {health.webhooks.pending} · DLQ {health.webhooks.dlq}
          {health.lastCall ? ` · last call ${health.lastCall.publicId} (${health.lastCall.status})` : ""}
        </p>
      </Panel>
      <Panel title="Buyer health scores">
        <ul className="space-y-2 text-sm">
          {(scores.data ?? []).map((s) => (
            <li key={s.company} className="flex justify-between">
              <span>{s.company}</span>
              <span className="font-mono">
                {s.score} · ans {s.breakdown.answer} / conv {s.breakdown.conversion} / cap {s.breakdown.capacityHeadroom}
              </span>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Opportunity finder">
        <ul className="space-y-2 text-sm">
          {(opportunities.data ?? []).length === 0 && <li className="text-slate-500">No flags on current routes.</li>}
          {(opportunities.data ?? []).map((o, i) => (
            <li key={i}>
              <span className="mr-2 text-[10px] uppercase text-slate-500">{o.kind.replace("_", " ")}</span>
              <strong>{o.label}</strong> — {o.detail}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
