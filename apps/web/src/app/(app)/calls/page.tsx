import { cookies } from "next/headers";
import Link from "next/link";
import { Panel, Table } from "@/components/ui";
import { usd } from "@/lib/api";

const api = process.env.API_PUBLIC_URL ?? "http://localhost:4000";

async function load() {
  const jar = await cookies();
  const token = jar.get(process.env.COOKIE_NAME ?? "zcg_session")?.value;
  const res = await fetch(`${api}/api/v1/calls?limit=80`, {
    headers: { cookie: `${process.env.COOKIE_NAME ?? "zcg_session"}=${token}` },
    cache: "no-store",
  });
  return res.json();
}

export default async function CallsPage() {
  const { data } = await load();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Call log</h1>
        <a className="text-sm text-signal" href="/api/v1/calls/export.csv">
          Export CSV
        </a>
      </div>
      <Panel title="Recent">
        <Table headers={["Call ID", "When", "Publisher", "Campaign", "Buyer", "State", "Dur", "Conv", "Revenue", "Profit"]}>
          {(data ?? []).map((c: Record<string, unknown>) => (
            <tr key={String(c.id)} className="hover:bg-ink-700/50">
              <td className="px-3 py-2">
                <Link className="font-mono text-xs text-ice hover:underline" href={`/calls/${c.publicId}`}>
                  {String(c.publicId)}
                </Link>
              </td>
              <td className="px-3 py-2 text-xs text-slate-400">
                {new Date(String(c.startedAt)).toISOString().replace("T", " ").slice(0, 19)}
              </td>
              <td className="px-3 py-2">{(c.publisher as { company: string })?.company}</td>
              <td className="px-3 py-2">{(c.campaign as { name: string })?.name}</td>
              <td className="px-3 py-2">{(c.buyer as { company?: string })?.company ?? "—"}</td>
              <td className="px-3 py-2">{String(c.callerState ?? "")}</td>
              <td className="px-3 py-2 font-mono">{String(c.talkDurationSeconds)}s</td>
              <td className="px-3 py-2">{c.converted ? "Yes" : "No"}</td>
              <td className="px-3 py-2 font-mono">{usd(String(c.revenue))}</td>
              <td className={`px-3 py-2 font-mono ${Number(c.profit) < 0 ? "text-copper" : "text-signal"}`}>
                {usd(String(c.profit))}
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
