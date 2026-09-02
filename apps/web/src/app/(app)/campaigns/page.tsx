import { cookies } from "next/headers";
import Link from "next/link";
import { Panel, Table } from "@/components/ui";
import { usd } from "@/lib/api";

const api = process.env.API_PUBLIC_URL ?? "http://localhost:4000";

export default async function CampaignsPage() {
  const jar = await cookies();
  const token = jar.get(process.env.COOKIE_NAME ?? "zcg_session")?.value;
  const res = await fetch(`${api}/api/v1/campaigns`, {
    headers: { cookie: `${process.env.COOKIE_NAME ?? "zcg_session"}=${token}` },
    cache: "no-store",
  });
  const { data } = await res.json();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Campaigns</h1>
      <Panel title="Active graph">
        <Table headers={["ID", "Name", "Vertical", "Publisher", "Strategy", "Buyer / Pub", "Buffer", "Status"]}>
          {(data ?? []).map((c: Record<string, unknown>) => (
            <tr key={String(c.id)}>
              <td className="px-3 py-2 font-mono text-xs text-ice">
                <Link href={`/campaigns/${c.publicId}`}>{String(c.publicId)}</Link>
              </td>
              <td className="px-3 py-2">{String(c.name)}</td>
              <td className="px-3 py-2">{(c.vertical as { name: string })?.name}</td>
              <td className="px-3 py-2">{(c.publisher as { company: string })?.company}</td>
              <td className="px-3 py-2 text-xs">{String(c.routingStrategy)}</td>
              <td className="px-3 py-2 font-mono text-xs">
                {usd(String(c.buyerRevenueAmount))} / {usd(String(c.publisherPayoutAmount))}
              </td>
              <td className="px-3 py-2 font-mono text-xs">
                {String(c.buyerThresholdSeconds)}s / {String(c.publisherThresholdSeconds)}s
              </td>
              <td className="px-3 py-2 text-xs uppercase">{String(c.status)}</td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
