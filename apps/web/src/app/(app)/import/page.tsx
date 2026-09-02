"use client";

import { FormEvent, useState } from "react";
import { Panel, Table } from "@/components/ui";
import { api } from "@/lib/api";

export default function ImportPage() {
  const [preview, setPreview] = useState<{ headers: string[]; rows: Record<string, string>[]; count: number } | null>(null);
  const [entity, setEntity] = useState<"publishers" | "buyers" | "leads">("publishers");
  const [created, setCreated] = useState<number | null>(null);

  async function onPreview(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const csv = String(fd.get("csv") ?? "");
    const r = await api<{ headers: string[]; rows: Record<string, string>[]; count: number }>("/api/v1/ops/import/preview", {
      method: "POST",
      body: JSON.stringify({ entity, csv }),
    });
    setPreview(r);
    setCreated(null);
  }

  async function commit() {
    if (!preview) return;
    const r = await api<{ created: number }>("/api/v1/ops/import/commit", {
      method: "POST",
      body: JSON.stringify({ entity, rows: preview.rows }),
    });
    setCreated(r.created);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">CSV import</h1>
      <p className="text-sm text-slate-400">Preview up to 50 rows, then commit. Headers: company,email for publishers; company,states,revenuePerCall for buyers; phone,firstName,lastName,state for leads.</p>
      <Panel title="Paste CSV">
        <form onSubmit={onPreview} className="space-y-3">
          <select value={entity} onChange={(e) => setEntity(e.target.value as typeof entity)} className="rounded-md border border-ink-600 bg-ink-900 px-3 py-2">
            <option value="publishers">Publishers</option>
            <option value="buyers">Buyers</option>
            <option value="leads">Leads</option>
          </select>
          <textarea name="csv" rows={8} className="w-full rounded-md border border-ink-600 bg-ink-900 p-3 font-mono text-xs" defaultValue={"company,email\nExample Media,ops@example.test"} />
          <button className="rounded-md bg-signal px-4 py-2 font-semibold text-ink-950">Preview</button>
        </form>
      </Panel>
      {preview && (
        <Panel
          title={`${preview.count} rows`}
          action={
            <button onClick={commit} className="text-xs text-signal">
              Commit previewed rows
            </button>
          }
        >
          <Table headers={preview.headers}>
            {preview.rows.map((row, i) => (
              <tr key={i}>
                {preview.headers.map((h) => (
                  <td key={h} className="px-3 py-2 text-xs">
                    {row[h]}
                  </td>
                ))}
              </tr>
            ))}
          </Table>
          {created !== null && <p className="mt-3 text-sm text-signal">Created {created} records.</p>}
        </Panel>
      )}
    </div>
  );
}
