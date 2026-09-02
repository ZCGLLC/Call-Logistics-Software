import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Panel } from "@/components/ui";
import { usd } from "@/lib/api";

const api = process.env.API_PUBLIC_URL ?? "http://localhost:4000";

export default async function InspectorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const jar = await cookies();
  const token = jar.get(process.env.COOKIE_NAME ?? "zcg_session")?.value;
  const res = await fetch(`${api}/api/v1/calls/${id}`, {
    headers: { cookie: `${process.env.COOKIE_NAME ?? "zcg_session"}=${token}` },
    cache: "no-store",
  });
  if (!res.ok) notFound();
  const c = await res.json();
  if (c.error) notFound();

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] uppercase tracking-[0.16em] text-signal">Call inspector</div>
        <h1 className="font-mono text-2xl">{c.publicId}</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Stat k="Revenue" v={usd(c.revenue)} />
        <Stat k="Payout" v={usd(c.payout)} />
        <Stat k="Telecom" v={usd(c.telecomCost)} />
        <Stat k="Profit" v={usd(c.profit)} good={Number(c.profit) >= 0} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Context">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Item k="Caller" v={c.callerE164} />
            <Item k="State / ZIP" v={`${c.callerState ?? "—"} ${c.callerZip ?? ""}`} />
            <Item k="Publisher" v={c.publisher?.company} />
            <Item k="Campaign" v={c.campaign?.name} />
            <Item k="Vertical" v={c.campaign?.vertical?.name} />
            <Item k="Buyer" v={c.buyer?.company ?? "—"} />
            <Item k="Status" v={c.status} />
            <Item k="Converted" v={c.converted ? "Yes" : "No"} />
            <Item k="Talk" v={`${c.talkDurationSeconds}s`} />
            <Item k="Tracking #" v={c.trackingNumber?.e164 ?? "—"} />
          </dl>
        </Panel>
        <Panel title="Routing explanation">
          <pre className="whitespace-pre-wrap font-mono text-xs text-slate-300">{c.routingExplanation ?? "—"}</pre>
        </Panel>
      </div>
      <Panel title="Timeline">
        <ol className="space-y-2">
          {(c.events ?? []).map((e: { seq: number; type: string; at: string; payload?: unknown }) => (
            <li key={e.seq} className="flex gap-4 font-mono text-xs">
              <span className="w-8 text-slate-500">{String(e.seq).padStart(2, "0")}</span>
              <span className="w-40 text-slate-500">{new Date(e.at).toISOString().slice(11, 19)}</span>
              <span className="text-signal">{e.type}</span>
              <span className="text-slate-500">{JSON.stringify(e.payload ?? {})}</span>
            </li>
          ))}
        </ol>
      </Panel>
      <Panel title="Routing attempts">
        <ul className="space-y-1 text-sm">
          {(c.attempts ?? []).map((a: { publicId: string; buyerName: string; result: string; reason?: string }) => (
            <li key={a.publicId} className="flex gap-4">
              <span>{a.buyerName}</span>
              <span className="font-mono text-xs uppercase text-ice">{a.result}</span>
              <span className="text-slate-500">{a.reason}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function Stat({ k, v, good }: { k: string; v: string; good?: boolean }) {
  return (
    <div className="rounded-xl border border-ink-600 bg-ink-800 p-4">
      <div className="text-[11px] uppercase tracking-wider text-slate-500">{k}</div>
      <div className={`mt-1 font-mono text-xl ${good === false ? "text-copper" : good ? "text-signal" : ""}`}>{v}</div>
    </div>
  );
}

function Item({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase text-slate-500">{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}
