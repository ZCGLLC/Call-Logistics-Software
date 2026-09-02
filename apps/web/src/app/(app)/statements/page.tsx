import { Panel, Table } from "@/components/ui";
import { usd } from "@/lib/api";
import { serverApi } from "@/lib/server";

export default async function StatementsPage() {
  const { data } = await serverApi<{
    data: Array<{
      publicId: string;
      status: string;
      periodStart: string;
      periodEnd: string;
      payout: string;
      acceptedCalls: number;
      rejectedCalls: number;
      publisher: { company: string };
    }>;
  }>("/api/v1/statements");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Publisher statements</h1>
      <p className="text-sm text-slate-400">Payout for accepted conversions. Buyer identity is never included.</p>
      <Panel title="Periods">
        <Table headers={["Statement", "Publisher", "Accepted", "Rejected", "Payout", "Status", ""]}>
          {(data ?? []).map((s) => (
            <tr key={s.publicId}>
              <td className="px-3 py-2 font-mono text-xs text-ice">{s.publicId}</td>
              <td className="px-3 py-2">{s.publisher.company}</td>
              <td className="px-3 py-2 font-mono">{s.acceptedCalls}</td>
              <td className="px-3 py-2 font-mono">{s.rejectedCalls}</td>
              <td className="px-3 py-2 font-mono">{usd(s.payout)}</td>
              <td className="px-3 py-2 text-xs uppercase">{s.status}</td>
              <td className="px-3 py-2">
                <a className="text-xs text-signal" href={`/api/v1/statements/${s.publicId}/export.csv`}>
                  CSV
                </a>
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
