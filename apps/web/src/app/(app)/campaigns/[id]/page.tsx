import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Panel } from "@/components/ui";
import { usd } from "@/lib/api";

const api = process.env.API_PUBLIC_URL ?? "http://localhost:4000";

export default async function CampaignDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const jar = await cookies();
  const token = jar.get(process.env.COOKIE_NAME ?? "zcg_session")?.value;
  const res = await fetch(`${api}/api/v1/campaigns/${id}`, {
    headers: { cookie: `${process.env.COOKIE_NAME ?? "zcg_session"}=${token}` },
    cache: "no-store",
  });
  const c = await res.json();
  if (!c?.id) notFound();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{c.name}</h1>
      <p className="text-sm text-slate-400">
        {c.vertical?.name} · {c.publisher?.company} · {c.routingStrategy}
      </p>
      <Panel title="Buyers">
        <ul className="space-y-2 text-sm">
          {c.buyers.map((l: { buyer: { company: string }; revenueOverride?: string; priority: number }) => (
            <li key={l.buyer.company}>
              P{l.priority} {l.buyer.company} · {usd(String(l.revenueOverride ?? c.buyerRevenueAmount))}
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Tracking numbers">
        <ul className="font-mono text-xs">
          {c.numbers.map((n: { e164: string; publicId: string }) => (
            <li key={n.publicId}>{n.e164}</li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
