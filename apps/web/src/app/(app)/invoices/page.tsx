import { Panel, Table } from "@/components/ui";
import { usd } from "@/lib/api";
import { serverApi } from "@/lib/server";
import { InvoiceActions } from "@/components/invoice-actions";

export default async function InvoicesPage() {
  const { data } = await serverApi<{
    data: Array<{
      publicId: string;
      status: string;
      periodStart: string;
      periodEnd: string;
      netAmount: string;
      buyer: { company: string };
    }>;
  }>("/api/v1/invoices");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Invoices</h1>
      <p className="text-sm text-slate-400">Buyer invoices for converted calls. CSV export is available per invoice.</p>
      <Panel title="Issued">
        <Table headers={["Invoice", "Buyer", "Period", "Net", "Status", ""]}>
          {(data ?? []).map((inv) => (
            <tr key={inv.publicId}>
              <td className="px-3 py-2 font-mono text-xs text-ice">{inv.publicId}</td>
              <td className="px-3 py-2">{inv.buyer.company}</td>
              <td className="px-3 py-2 text-xs">
                {inv.periodStart.slice(0, 10)} → {inv.periodEnd.slice(0, 10)}
              </td>
              <td className="px-3 py-2 font-mono">{usd(inv.netAmount)}</td>
              <td className="px-3 py-2 text-xs uppercase">{inv.status}</td>
              <td className="px-3 py-2">
                <InvoiceActions id={inv.publicId} status={inv.status} />
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
