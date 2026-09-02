import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Panel } from "@/components/ui";
import { usd } from "@/lib/api";
import { NumberDesk } from "@/components/number-desk";

const api = process.env.API_PUBLIC_URL ?? "http://localhost:4000";

export default async function PublisherDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const jar = await cookies();
  const token = jar.get(process.env.COOKIE_NAME ?? "zcg_session")?.value;
  const res = await fetch(`${api}/api/v1/publishers/${id}`, {
    headers: { cookie: `${process.env.COOKIE_NAME ?? "zcg_session"}=${token}` },
    cache: "no-store",
  });
  const body = await res.json();
  if (body.error) notFound();
  const p = body.publisher;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{p.company}</h1>
      <p className="font-mono text-xs text-ice">{p.publicId}</p>
      <div className="grid gap-4 md:grid-cols-4">
        <Card k="Calls today" v={String(body.kpis.today)} />
        <Card k="Calls MTD" v={String(body.kpis.mtd)} />
        <Card k="Conversions MTD" v={String(body.kpis.conversions)} />
        <Card k="Payout MTD" v={usd(String(body.kpis.totals._sum.payout ?? 0))} />
      </div>
      <Panel title="Campaigns">
        <ul className="space-y-1 text-sm">
          {p.campaigns.map((c: { publicId: string; name: string; status: string }) => (
            <li key={c.publicId}>
              {c.name} <span className="text-slate-500">{c.status}</span>
            </li>
          ))}
        </ul>
      </Panel>
      <NumberDesk
        lockedPublisherId={p.publicId}
        publishers={[{ publicId: p.publicId, company: p.company }]}
        campaigns={p.campaigns.map((c: { publicId: string; name: string }) => ({
          publicId: c.publicId,
          name: c.name,
          publisher: { publicId: p.publicId },
        }))}
        initial={(p.numbers ?? []).map(
          (n: {
            id: string;
            publicId: string;
            e164: string;
            provider: string;
            numberType: string;
            status: string;
            campaignId?: string | null;
          }) => ({
            ...n,
            publisher: { company: p.company, publicId: p.publicId },
            campaign: p.campaigns.find((c: { id: string }) => c.id === n.campaignId) ?? null,
          }),
        )}
      />
    </div>
  );
}

function Card({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl border border-ink-600 bg-ink-800 p-4">
      <div className="text-[11px] uppercase text-slate-500">{k}</div>
      <div className="mt-1 font-mono text-xl">{v}</div>
    </div>
  );
}
