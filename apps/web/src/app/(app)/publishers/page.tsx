import { cookies } from "next/headers";
import Link from "next/link";
import { Panel, Table } from "@/components/ui";

const api = process.env.API_PUBLIC_URL ?? "http://localhost:4000";

async function list(path: string) {
  const jar = await cookies();
  const token = jar.get(process.env.COOKIE_NAME ?? "zcg_session")?.value;
  const res = await fetch(`${api}${path}`, {
    headers: { cookie: `${process.env.COOKIE_NAME ?? "zcg_session"}=${token}` },
    cache: "no-store",
  });
  return res.json();
}

export default async function PublishersPage() {
  const { data } = await list("/api/v1/publishers");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Publishers</h1>
      <Panel title="Traffic sources">
        <Table headers={["ID", "Company", "Status", "Verticals", "Terms", "Campaigns", "Calls"]}>
          {(data ?? []).map((p: Record<string, unknown>) => (
            <tr key={String(p.id)}>
              <td className="px-3 py-2 font-mono text-xs text-ice">
                <Link href={`/publishers/${p.publicId}`}>{String(p.publicId)}</Link>
              </td>
              <td className="px-3 py-2">{String(p.company)}</td>
              <td className="px-3 py-2 text-xs uppercase text-slate-400">{String(p.status)}</td>
              <td className="px-3 py-2 text-xs">{(p.verticals as string[])?.join(", ")}</td>
              <td className="px-3 py-2 text-xs">{String(p.paymentTerms)}</td>
              <td className="px-3 py-2">{(p._count as { campaigns: number })?.campaigns}</td>
              <td className="px-3 py-2">{(p._count as { calls: number })?.calls}</td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
