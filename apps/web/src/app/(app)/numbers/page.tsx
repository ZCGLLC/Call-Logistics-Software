import { cookies } from "next/headers";
import { Panel, Table } from "@/components/ui";

const api = process.env.API_PUBLIC_URL ?? "http://localhost:4000";

export default async function NumbersPage() {
  const jar = await cookies();
  const token = jar.get(process.env.COOKIE_NAME ?? "zcg_session")?.value;
  const res = await fetch(`${api}/api/v1/numbers`, {
    headers: { cookie: `${process.env.COOKIE_NAME ?? "zcg_session"}=${token}` },
    cache: "no-store",
  });
  const { data } = await res.json();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Number inventory</h1>
      <Panel title="DIDs">
        <Table headers={["DID", "Provider", "Type", "Status", "Campaign", "Publisher"]}>
          {(data ?? []).map((n: Record<string, unknown>) => (
            <tr key={String(n.id)}>
              <td className="px-3 py-2 font-mono">{String(n.e164)}</td>
              <td className="px-3 py-2 text-xs uppercase">{String(n.provider)}</td>
              <td className="px-3 py-2 text-xs">{String(n.numberType)}</td>
              <td className="px-3 py-2 text-xs">{String(n.status)}</td>
              <td className="px-3 py-2">{(n.campaign as { name?: string })?.name ?? "—"}</td>
              <td className="px-3 py-2">{(n.publisher as { company?: string })?.company ?? "—"}</td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
