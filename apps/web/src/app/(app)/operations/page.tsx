import { cookies } from "next/headers";
import { Panel, Table } from "@/components/ui";
import { usd } from "@/lib/api";

const api = process.env.API_PUBLIC_URL ?? "http://localhost:4000";

export default async function OperationsPage() {
  const jar = await cookies();
  const token = jar.get(process.env.COOKIE_NAME ?? "zcg_session")?.value;
  const res = await fetch(`${api}/api/v1/reports/operations`, {
    headers: { cookie: `${process.env.COOKIE_NAME ?? "zcg_session"}=${token}` },
    cache: "no-store",
  });
  const { data } = await res.json();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Operations matrix</h1>
      <p className="text-sm text-slate-400">Replaces spreadsheet boards: rates, buffers, caps, and DIDs in one place.</p>
      <Panel title="Active routes">
        <Table
          headers={[
            "Vertical",
            "Publisher",
            "Campaign",
            "Pub rate",
            "Pub buffer",
            "Buyer",
            "Buyer rate",
            "Buyer buffer",
            "Spread",
            "States",
            "Cap",
            "Today",
            "Remaining",
            "DID",
            "Status",
          ]}
        >
          {(data ?? []).map((r: Record<string, string | number | null>, i: number) => (
            <tr key={i}>
              <td className="px-3 py-2">{r.vertical}</td>
              <td className="px-3 py-2">{r.publisher}</td>
              <td className="px-3 py-2">{r.campaign}</td>
              <td className="px-3 py-2 font-mono">{usd(String(r.publisherRate))}</td>
              <td className="px-3 py-2 font-mono">{r.publisherBuffer}s</td>
              <td className="px-3 py-2">{r.buyer}</td>
              <td className="px-3 py-2 font-mono">{usd(String(r.buyerRate))}</td>
              <td className="px-3 py-2 font-mono">{r.buyerBuffer}s</td>
              <td className="px-3 py-2 font-mono text-signal">{usd(String(r.grossSpread))}</td>
              <td className="px-3 py-2 text-xs">{r.states}</td>
              <td className="px-3 py-2 font-mono">{r.cap ?? "—"}</td>
              <td className="px-3 py-2 font-mono">{r.deliveredToday}</td>
              <td className="px-3 py-2 font-mono">{r.remaining ?? "—"}</td>
              <td className="px-3 py-2 font-mono text-xs">{r.did}</td>
              <td className="px-3 py-2 text-xs uppercase">{r.status}</td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
