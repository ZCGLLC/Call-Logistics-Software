import { cookies } from "next/headers";
import Link from "next/link";
import { Panel, Table } from "@/components/ui";
import { usd } from "@/lib/api";

const api = process.env.API_PUBLIC_URL ?? "http://localhost:4000";

export default async function BuyersPage() {
  const jar = await cookies();
  const token = jar.get(process.env.COOKIE_NAME ?? "zcg_session")?.value;
  const res = await fetch(`${api}/api/v1/buyers`, {
    headers: { cookie: `${process.env.COOKIE_NAME ?? "zcg_session"}=${token}` },
    cache: "no-store",
  });
  const { data } = await res.json();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Buyers</h1>
      <Panel title="Destinations">
        <Table headers={["ID", "Company", "Status", "States", "Rate", "Buffer", "Daily cap", "DID"]}>
          {(data ?? []).map((b: Record<string, unknown>) => (
            <tr key={String(b.id)}>
              <td className="px-3 py-2 font-mono text-xs text-ice">
                <Link href={`/buyers/${b.publicId}`}>{String(b.publicId)}</Link>
              </td>
              <td className="px-3 py-2">{String(b.company)}</td>
              <td className="px-3 py-2 text-xs uppercase">{String(b.status)}</td>
              <td className="px-3 py-2 text-xs">{(b.states as string[])?.join(", ")}</td>
              <td className="px-3 py-2 font-mono">{usd(String(b.revenuePerCall))}</td>
              <td className="px-3 py-2 font-mono">{String(b.conversionThresholdSeconds)}s</td>
              <td className="px-3 py-2 font-mono">{String(b.dailyCap ?? "—")}</td>
              <td className="px-3 py-2 font-mono text-xs">
                {(b.destinations as { did?: string }[])?.[0]?.did ?? "—"}
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
