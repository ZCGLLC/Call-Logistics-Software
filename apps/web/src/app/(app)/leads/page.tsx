"use client";

import { FormEvent, useEffect, useState } from "react";
import { Panel, Table } from "@/components/ui";
import { api } from "@/lib/api";

type Lead = {
  publicId: string;
  phone: string;
  firstName?: string;
  lastName?: string;
  state?: string;
  status: string;
  campaign?: { name: string };
  publisher?: { company: string };
};

export default function LeadsPage() {
  const [data, setData] = useState<Lead[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const r = await api<{ data: Lead[] }>("/api/v1/leads");
    setData(r.data ?? []);
  }

  useEffect(() => {
    reload().catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api("/api/v1/leads", {
      method: "POST",
      body: JSON.stringify({
        phone: fd.get("phone"),
        firstName: fd.get("firstName"),
        lastName: fd.get("lastName"),
        state: fd.get("state"),
        email: fd.get("email") || undefined,
        consentAt: new Date().toISOString(),
        consentSourceUrl: "https://portal.zcg.local/lead",
        consentTextVer: "v1",
      }),
    });
    (e.currentTarget as HTMLFormElement).reset();
    await reload();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Leads</h1>
      <p className="text-sm text-slate-400">Ingest with TCPA consent fields. POST /api/v1/leads also accepts X-Api-Key.</p>
      <Panel title="New lead">
        <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-5">
          <input name="phone" required placeholder="+12145550100" className="rounded-md border border-ink-600 bg-ink-900 px-3 py-2" />
          <input name="firstName" placeholder="First" className="rounded-md border border-ink-600 bg-ink-900 px-3 py-2" />
          <input name="lastName" placeholder="Last" className="rounded-md border border-ink-600 bg-ink-900 px-3 py-2" />
          <input name="state" defaultValue="TX" className="rounded-md border border-ink-600 bg-ink-900 px-3 py-2" />
          <button className="rounded-md bg-signal font-semibold text-ink-950">Ingest</button>
        </form>
        {error && <p className="mt-2 text-sm text-copper">{error}</p>}
      </Panel>
      <Panel title="Recent">
        <Table headers={["Lead", "Name", "Phone", "State", "Campaign", "Status"]}>
          {data.map((l) => (
            <tr key={l.publicId}>
              <td className="px-3 py-2 font-mono text-xs text-ice">{l.publicId}</td>
              <td className="px-3 py-2">
                {l.firstName} {l.lastName}
              </td>
              <td className="px-3 py-2 font-mono text-xs">{l.phone}</td>
              <td className="px-3 py-2">{l.state}</td>
              <td className="px-3 py-2">{l.campaign?.name ?? "—"}</td>
              <td className="px-3 py-2 text-xs uppercase">{l.status}</td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
