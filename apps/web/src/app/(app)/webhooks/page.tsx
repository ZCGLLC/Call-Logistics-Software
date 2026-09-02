"use client";

import { FormEvent, useEffect, useState } from "react";
import { Panel, Table } from "@/components/ui";
import { api } from "@/lib/api";

type Endpoint = {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  deliveries: { id: string; event: string; status: string; attempts: number; lastError?: string | null }[];
};

export default function WebhooksPage() {
  const [data, setData] = useState<Endpoint[]>([]);
  const [secret, setSecret] = useState<string | null>(null);

  async function reload() {
    const r = await api<{ data: Endpoint[] }>("/api/v1/webhooks");
    setData(r.data ?? []);
  }
  useEffect(() => {
    reload().catch(() => undefined);
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const created = await api<{ secret: string }>("/api/v1/webhooks", {
      method: "POST",
      body: JSON.stringify({ url: fd.get("url"), events: ["*"] }),
    });
    setSecret(created.secret);
    await reload();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Webhooks</h1>
      <p className="text-sm text-slate-400">
        HMAC header <span className="font-mono text-slate-300">X-ZCG-Signature: sha256=…</span>. Failed deliveries retry then land in DLQ.
      </p>
      <Panel title="Add endpoint">
        <form onSubmit={onSubmit} className="flex gap-3">
          <input name="url" required type="url" placeholder="https://example.com/hooks/zcg" className="flex-1 rounded-md border border-ink-600 bg-ink-900 px-3 py-2" />
          <button className="rounded-md bg-signal px-4 font-semibold text-ink-950">Create</button>
        </form>
        {secret && (
          <p className="mt-3 text-xs text-slate-400">
            Signing secret (shown once): <span className="font-mono text-signal">{secret}</span>
          </p>
        )}
      </Panel>
      <Panel title="Endpoints">
        <Table headers={["URL", "Events", "Active", "Last delivery"]}>
          {data.map((e) => (
            <tr key={e.id}>
              <td className="px-3 py-2 font-mono text-xs">{e.url}</td>
              <td className="px-3 py-2 text-xs">{e.events.join(", ")}</td>
              <td className="px-3 py-2">{e.active ? "yes" : "paused"}</td>
              <td className="px-3 py-2 text-xs">
                {e.deliveries[0] ? `${e.deliveries[0].event} · ${e.deliveries[0].status}` : "—"}
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
