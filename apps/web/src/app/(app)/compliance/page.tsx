"use client";

import { FormEvent, useEffect, useState } from "react";
import { Panel, Table } from "@/components/ui";
import { api } from "@/lib/api";

export default function CompliancePage() {
  const [rows, setRows] = useState<Array<{ id: string; type: string; value: string; reason?: string | null; createdAt: string }>>([]);
  const [tags, setTags] = useState<Array<{ name: string; color: string }>>([]);

  async function reload() {
    const [s, t] = await Promise.all([
      api<{ data: typeof rows }>("/api/v1/ops/suppressions"),
      api<{ data: typeof tags }>("/api/v1/ops/tags"),
    ]);
    setRows(s.data ?? []);
    setTags(t.data ?? []);
  }
  useEffect(() => {
    reload().catch(() => undefined);
  }, []);

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api("/api/v1/ops/suppressions", {
      method: "POST",
      body: JSON.stringify({ value: fd.get("value"), reason: fd.get("reason") }),
    });
    await reload();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Compliance</h1>
      <p className="text-sm text-slate-400">Suppression list and tags. Recording disclosure lives on each campaign.</p>
      <Panel title="Tags">
        <div className="flex gap-2">
          {tags.map((t) => (
            <span key={t.name} className="rounded-full border border-ink-600 px-3 py-1 text-xs" style={{ color: t.color }}>
              {t.name}
            </span>
          ))}
        </div>
      </Panel>
      <Panel title="Add suppression">
        <form onSubmit={add} className="flex gap-3">
          <input name="value" required placeholder="+12145550999" className="flex-1 rounded-md border border-ink-600 bg-ink-900 px-3 py-2" />
          <input name="reason" placeholder="Reason" className="flex-1 rounded-md border border-ink-600 bg-ink-900 px-3 py-2" />
          <button className="rounded-md bg-signal px-4 font-semibold text-ink-950">Add</button>
        </form>
      </Panel>
      <Panel title="Suppression list">
        <Table headers={["Type", "Value", "Reason", "Added"]}>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-3 py-2 text-xs">{r.type}</td>
              <td className="px-3 py-2 font-mono text-xs">{r.value}</td>
              <td className="px-3 py-2">{r.reason}</td>
              <td className="px-3 py-2 text-xs">{r.createdAt.slice(0, 10)}</td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
