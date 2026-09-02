import { cookies } from "next/headers";
import { Panel, Table } from "@/components/ui";
import { usd } from "@/lib/api";

const api = process.env.API_PUBLIC_URL ?? "http://localhost:4000";

async function load() {
  const jar = await cookies();
  const token = jar.get(process.env.COOKIE_NAME ?? "zcg_session")?.value;
  const res = await fetch(`${api}/api/v1/live`, {
    headers: { cookie: `${process.env.COOKIE_NAME ?? "zcg_session"}=${token}` },
    cache: "no-store",
  });
  return res.json();
}

export default async function LivePage() {
  const { data } = await load();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Live calls</h1>
      <p className="text-sm text-slate-400">In-flight plus the last five minutes. WebSocket room org:live-calls is enabled on the API.</p>
      <Panel title="Active / recent">
        <Table headers={["Call ID", "Caller", "Publisher", "Campaign", "State", "Status", "Buyer", "Revenue"]}>
          {(data ?? []).map((c: Record<string, unknown>) => (
            <tr key={String(c.id)}>
              <td className="px-3 py-2 font-mono text-xs text-ice">{String((c as { publicId: string }).publicId)}</td>
              <td className="px-3 py-2 font-mono text-xs">{String(c.callerE164)}</td>
              <td className="px-3 py-2">{(c.publisher as { company: string })?.company}</td>
              <td className="px-3 py-2">{(c.campaign as { name: string })?.name}</td>
              <td className="px-3 py-2">{String(c.callerState ?? "")}</td>
              <td className="px-3 py-2 text-xs uppercase text-signal">{String(c.status)}</td>
              <td className="px-3 py-2">{(c.buyer as { company?: string })?.company ?? "—"}</td>
              <td className="px-3 py-2 font-mono">{usd(String(c.revenue))}</td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
