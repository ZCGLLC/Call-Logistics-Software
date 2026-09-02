"use client";

import { useEffect, useState } from "react";
import { Panel, Table } from "@/components/ui";
import { api, usd } from "@/lib/api";

type LiveCall = {
  id: string;
  publicId: string;
  callerE164: string;
  callerState?: string;
  status: string;
  revenue: string;
  publisher?: { company: string };
  campaign?: { name: string };
  buyer?: { company?: string };
};

export function LiveCallsClient({ initial }: { initial: LiveCall[] }) {
  const [rows, setRows] = useState(initial);

  useEffect(() => {
    const tick = async () => {
      try {
        const r = await api<{ data: LiveCall[] }>("/api/v1/live");
        setRows(r.data ?? []);
      } catch {
        /* keep last */
      }
    };
    const id = setInterval(tick, 2500);
    return () => clearInterval(id);
  }, []);

  return (
    <Panel title="Active / recent" action={<span className="text-[10px] uppercase tracking-widest text-signal">live poll 2.5s</span>}>
      <Table headers={["Call ID", "Caller", "Publisher", "Campaign", "State", "Status", "Buyer", "Revenue"]}>
        {rows.map((c) => (
          <tr key={c.id}>
            <td className="px-3 py-2 font-mono text-xs text-ice">{c.publicId}</td>
            <td className="px-3 py-2 font-mono text-xs">{c.callerE164}</td>
            <td className="px-3 py-2">{c.publisher?.company}</td>
            <td className="px-3 py-2">{c.campaign?.name}</td>
            <td className="px-3 py-2">{c.callerState ?? ""}</td>
            <td className="px-3 py-2 text-xs uppercase text-signal">{c.status}</td>
            <td className="px-3 py-2">{c.buyer?.company ?? "—"}</td>
            <td className="px-3 py-2 font-mono">{usd(c.revenue)}</td>
          </tr>
        ))}
      </Table>
    </Panel>
  );
}
