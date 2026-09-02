"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Panel, Table, fieldClass } from "@/components/ui";
import { api, usd } from "@/lib/api";

export type BuyerRow = {
  id: string;
  publicId: string;
  company: string;
  status: string;
  states: string[];
  revenuePerCall: string;
  conversionThresholdSeconds: number;
  dailyCap?: number | null;
  destinations?: { did?: string }[];
};

export function BuyerDesk({ initial }: { initial: BuyerRow[] }) {
  const [rows, setRows] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function reload() {
    const r = await api<{ data: BuyerRow[] }>("/api/v1/buyers");
    setRows(r.data ?? []);
    router.refresh();
  }

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const states = String(fd.get("states") ?? "")
      .split(/[,\s]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    try {
      await api("/api/v1/buyers", {
        method: "POST",
        body: JSON.stringify({
          company: fd.get("company"),
          contactName: fd.get("contactName") || undefined,
          email: fd.get("email") || undefined,
          vertical: fd.get("vertical") || undefined,
          states,
          revenuePerCall: fd.get("revenuePerCall") || "0",
          conversionThresholdSeconds: Number(fd.get("conversionThresholdSeconds") || 90),
          dailyCap: fd.get("dailyCap") ? Number(fd.get("dailyCap")) : undefined,
          did: fd.get("did") || undefined,
          status: fd.get("status"),
        }),
      });
      form.reset();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create buyer");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, company: string) {
    if (!confirm(`Remove ${company}? Buyers with call history are terminated instead of deleted.`)) return;
    setError(null);
    try {
      await api(`/api/v1/buyers/${id}`, { method: "DELETE" });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove buyer");
    }
  }

  return (
    <div className="space-y-4">
      <Panel title="Add buyer">
        <form onSubmit={onCreate} className="grid gap-3 md:grid-cols-3">
          <label className="text-sm text-slate-400">
            Company
            <input name="company" required className={fieldClass} placeholder="Lone Star Health Connect" />
          </label>
          <label className="text-sm text-slate-400">
            Contact
            <input name="contactName" className={fieldClass} />
          </label>
          <label className="text-sm text-slate-400">
            Email
            <input name="email" type="email" className={fieldClass} />
          </label>
          <label className="text-sm text-slate-400">
            Vertical
            <input name="vertical" className={fieldClass} placeholder="medicare" />
          </label>
          <label className="text-sm text-slate-400">
            States
            <input name="states" className={fieldClass} placeholder="TX, OK, LA" />
          </label>
          <label className="text-sm text-slate-400">
            Revenue / call
            <input name="revenuePerCall" className={fieldClass} placeholder="42.00" defaultValue="42.00" />
          </label>
          <label className="text-sm text-slate-400">
            Buffer (seconds)
            <input name="conversionThresholdSeconds" type="number" className={fieldClass} defaultValue={90} />
          </label>
          <label className="text-sm text-slate-400">
            Daily cap
            <input name="dailyCap" type="number" className={fieldClass} placeholder="500" />
          </label>
          <label className="text-sm text-slate-400">
            Destination DID
            <input name="did" className={fieldClass} placeholder="+18005551001" />
          </label>
          <label className="text-sm text-slate-400">
            Status
            <select name="status" defaultValue="ACTIVE" className={fieldClass}>
              {["PROSPECT", "TESTING", "ACTIVE", "PAUSED"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <button disabled={busy} className="rounded-md bg-signal py-2 font-semibold text-ink-950 md:col-span-3">
            {busy ? "Saving…" : "Add buyer"}
          </button>
        </form>
        {error && <p className="mt-3 text-sm text-copper">{error}</p>}
      </Panel>
      <Panel title="Destinations">
        <Table headers={["ID", "Company", "Status", "States", "Rate", "Buffer", "Daily cap", "DID", ""]}>
          {rows.length === 0 && (
            <tr>
              <td colSpan={9} className="px-3 py-4 text-slate-500">
                No buyers yet.
              </td>
            </tr>
          )}
          {rows.map((b) => (
            <tr key={b.id}>
              <td className="px-3 py-2 font-mono text-xs text-ice">
                <Link href={`/buyers/${b.publicId}`}>{b.publicId}</Link>
              </td>
              <td className="px-3 py-2">{b.company}</td>
              <td className="px-3 py-2 text-xs uppercase">{b.status}</td>
              <td className="px-3 py-2 text-xs">{b.states?.join(", ")}</td>
              <td className="px-3 py-2 font-mono">{usd(String(b.revenuePerCall))}</td>
              <td className="px-3 py-2 font-mono">{b.conversionThresholdSeconds}s</td>
              <td className="px-3 py-2 font-mono">{b.dailyCap ?? "—"}</td>
              <td className="px-3 py-2 font-mono text-xs">{b.destinations?.[0]?.did ?? "—"}</td>
              <td className="px-3 py-2">
                <button className="text-xs text-copper" onClick={() => remove(b.publicId, b.company)}>
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
