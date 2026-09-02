import { cookies } from "next/headers";
import { Panel, Table } from "@/components/ui";
import { usd, pct } from "@/lib/api";

const api = process.env.API_PUBLIC_URL ?? "http://localhost:4000";

export default async function FinancialsPage() {
  const jar = await cookies();
  const token = jar.get(process.env.COOKIE_NAME ?? "zcg_session")?.value;
  const res = await fetch(`${api}/api/v1/reports/profitability`, {
    headers: { cookie: `${process.env.COOKIE_NAME ?? "zcg_session"}=${token}` },
    cache: "no-store",
  });
  const { data } = await res.json();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Profitability</h1>
      <p className="text-sm text-slate-400">Negative-margin routes are highlighted. Ledger math is server-side DECIMAL.</p>
      <Panel title="MTD by publisher × buyer × campaign">
        <Table headers={["Publisher", "Buyer", "Campaign", "Calls", "Payout", "Revenue", "Carrier", "Profit", "Margin"]}>
          {(data ?? []).map((r: Record<string, unknown>, i: number) => (
            <tr key={i} className={r.negative ? "bg-copper/10" : ""}>
              <td className="px-3 py-2">{String(r.publisher)}</td>
              <td className="px-3 py-2">{String(r.buyer)}</td>
              <td className="px-3 py-2">{String(r.campaign)}</td>
              <td className="px-3 py-2 font-mono">{String(r.calls)}</td>
              <td className="px-3 py-2 font-mono">{usd(String(r.publisherCost))}</td>
              <td className="px-3 py-2 font-mono">{usd(String(r.buyerRevenue))}</td>
              <td className="px-3 py-2 font-mono">{usd(String(r.carrierCost))}</td>
              <td className={`px-3 py-2 font-mono ${r.negative ? "text-copper" : "text-signal"}`}>
                {usd(String(r.grossProfit))}
              </td>
              <td className="px-3 py-2 font-mono">{pct(Number(r.grossMargin))}</td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
