import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Panel } from "@/components/ui";
import { usd } from "@/lib/api";

const api = process.env.API_PUBLIC_URL ?? "http://localhost:4000";

export default async function BuyerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const jar = await cookies();
  const token = jar.get(process.env.COOKIE_NAME ?? "zcg_session")?.value;
  const res = await fetch(`${api}/api/v1/buyers/${id}`, {
    headers: { cookie: `${process.env.COOKIE_NAME ?? "zcg_session"}=${token}` },
    cache: "no-store",
  });
  const body = await res.json();
  if (body.error) notFound();
  const b = body.buyer;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{b.company}</h1>
      <p className="font-mono text-xs text-ice">{b.publicId}</p>
      <div className="grid gap-4 md:grid-cols-3">
        <Card k="Calls MTD" v={String(body.kpis._count._all)} />
        <Card k="Conversions" v={String(body.kpis.conversions)} />
        <Card k="Revenue MTD" v={usd(String(body.kpis._sum.revenue ?? 0))} />
      </div>
      <Panel title="Destinations">
        <ul className="text-sm">
          {b.destinations.map((d: { publicId: string; label: string; did?: string; sipUri?: string }) => (
            <li key={d.publicId} className="font-mono text-xs">
              {d.label} · {d.did ?? d.sipUri}
            </li>
          ))}
        </ul>
      </Panel>
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
