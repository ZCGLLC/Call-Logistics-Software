"use client";

import { FormEvent, useEffect, useState } from "react";
import { Panel, Table } from "@/components/ui";
import { api, usd } from "@/lib/api";

type Dispute = {
  publicId: string;
  reason: string;
  status: string;
  credit?: string | null;
  call: { publicId: string; revenue: string };
};

export default function DisputesPage() {
  const [data, setData] = useState<Dispute[]>([]);
  const [calls, setCalls] = useState<{ publicId: string }[]>([]);

  async function reload() {
    const [d, c] = await Promise.all([
      api<{ data: Dispute[] }>("/api/v1/disputes"),
      api<{ data: { publicId: string }[] }>("/api/v1/calls?limit=20"),
    ]);
    setData(d.data ?? []);
    setCalls(c.data ?? []);
  }

  useEffect(() => {
    reload().catch(() => undefined);
  }, []);

  async function open(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api("/api/v1/disputes", {
      method: "POST",
      body: JSON.stringify({ callId: fd.get("callId"), reason: fd.get("reason") }),
    });
    await reload();
  }

  async function resolve(id: string, status: "CREDITED" | "DENIED") {
    await api(`/api/v1/disputes/${id}/resolve`, {
      method: "POST",
      body: JSON.stringify({ status }),
    });
    await reload();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Disputes</h1>
      <p className="text-sm text-slate-400">Credits reverse conversion money on the call ledger. They do not silently overwrite history.</p>
      <Panel title="Open a dispute">
        <form onSubmit={open} className="grid gap-3 md:grid-cols-3">
          <select name="callId" className="rounded-md border border-ink-600 bg-ink-900 px-3 py-2">
            {calls.map((c) => (
              <option key={c.publicId} value={c.publicId}>
                {c.publicId}
              </option>
            ))}
          </select>
          <input name="reason" required placeholder="Reason" className="rounded-md border border-ink-600 bg-ink-900 px-3 py-2" />
          <button className="rounded-md bg-signal font-semibold text-ink-950">File</button>
        </form>
      </Panel>
      <Panel title="Queue">
        <Table headers={["Dispute", "Call", "Reason", "Credit", "Status", ""]}>
          {data.map((d) => (
            <tr key={d.publicId}>
              <td className="px-3 py-2 font-mono text-xs text-ice">{d.publicId}</td>
              <td className="px-3 py-2 font-mono text-xs">{d.call.publicId}</td>
              <td className="px-3 py-2">{d.reason}</td>
              <td className="px-3 py-2 font-mono">{usd(d.credit)}</td>
              <td className="px-3 py-2 text-xs uppercase">{d.status}</td>
              <td className="px-3 py-2 space-x-2">
                {d.status === "OPEN" && (
                  <>
                    <button className="text-xs text-signal" onClick={() => resolve(d.publicId, "CREDITED")}>
                      Credit
                    </button>
                    <button className="text-xs text-copper" onClick={() => resolve(d.publicId, "DENIED")}>
                      Deny
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
