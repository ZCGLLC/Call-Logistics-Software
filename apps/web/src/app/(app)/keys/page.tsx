"use client";

import { FormEvent, useEffect, useState } from "react";
import { Panel, Table } from "@/components/ui";
import { api } from "@/lib/api";

type KeyRow = { id: string; prefix: string; name: string; scopes: string[]; lastUsedAt: string | null; createdAt: string };

export default function KeysPage() {
  const [data, setData] = useState<KeyRow[]>([]);
  const [token, setToken] = useState<string | null>(null);

  async function reload() {
    const r = await api<{ data: KeyRow[] }>("/api/v1/keys");
    setData(r.data ?? []);
  }
  useEffect(() => {
    reload().catch(() => undefined);
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const created = await api<{ token: string }>("/api/v1/keys", {
      method: "POST",
      body: JSON.stringify({ name: fd.get("name") }),
    });
    setToken(created.token);
    await reload();
  }

  async function revoke(id: string) {
    await api(`/api/v1/keys/${id}`, { method: "DELETE" });
    await reload();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">API keys</h1>
      <p className="text-sm text-slate-400">
        Send as <span className="font-mono">X-Api-Key</span>. Use for lead ingest and RTB ping/post. The full token is shown once.
      </p>
      <Panel title="Issue key">
        <form onSubmit={onSubmit} className="flex gap-3">
          <input name="name" required placeholder="Publisher production" className="flex-1 rounded-md border border-ink-600 bg-ink-900 px-3 py-2" />
          <button className="rounded-md bg-signal px-4 font-semibold text-ink-950">Create</button>
        </form>
        {token && (
          <p className="mt-3 break-all font-mono text-xs text-signal">{token}</p>
        )}
      </Panel>
      <Panel title="Active">
        <Table headers={["Prefix", "Name", "Scopes", "Last used", ""]}>
          {data.map((k) => (
            <tr key={k.id}>
              <td className="px-3 py-2 font-mono text-xs">{k.prefix}</td>
              <td className="px-3 py-2">{k.name}</td>
              <td className="px-3 py-2 text-xs">{k.scopes.join(", ")}</td>
              <td className="px-3 py-2 text-xs">{k.lastUsedAt ? k.lastUsedAt.slice(0, 19) : "—"}</td>
              <td className="px-3 py-2">
                <button className="text-xs text-copper" onClick={() => revoke(k.id)}>
                  Revoke
                </button>
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
