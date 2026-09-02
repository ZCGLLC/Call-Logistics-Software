"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Panel, Table, fieldClass } from "@/components/ui";
import { api } from "@/lib/api";

const VERTICALS = ["medicare", "aca", "final_expense", "auto", "home", "life", "solar", "legal", "debt", "health"];

export type PublisherRow = {
  id: string;
  publicId: string;
  company: string;
  status: string;
  verticals: string[];
  paymentTerms: string;
  email?: string | null;
  contactName?: string | null;
  _count?: { campaigns: number; calls: number };
};

export function PublisherDesk({ initial }: { initial: PublisherRow[] }) {
  const [rows, setRows] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function reload() {
    const r = await api<{ data: PublisherRow[] }>("/api/v1/publishers");
    setRows(r.data ?? []);
    router.refresh();
  }

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const verticals = VERTICALS.filter((v) => fd.get(`v_${v}`) === "on");
    try {
      await api("/api/v1/publishers", {
        method: "POST",
        body: JSON.stringify({
          company: fd.get("company"),
          contactName: fd.get("contactName") || undefined,
          email: fd.get("email") || undefined,
          phone: fd.get("phone") || undefined,
          paymentTerms: fd.get("paymentTerms"),
          status: fd.get("status"),
          verticals,
        }),
      });
      form.reset();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create publisher");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, company: string) {
    if (!confirm(`Remove ${company}? Publishers with call history are terminated instead of deleted.`)) return;
    setError(null);
    try {
      await api(`/api/v1/publishers/${id}`, { method: "DELETE" });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove publisher");
    }
  }

  return (
    <div className="space-y-4">
      <Panel title="Add publisher">
        <p className="mb-3 text-sm text-slate-400">
          After saving, open{" "}
          <Link href="/numbers" className="text-ice">
            Numbers
          </Link>{" "}
          (or the publisher record) to generate tracking DIDs to send out.
        </p>
        <form onSubmit={onCreate} className="grid gap-3 md:grid-cols-3">
          <label className="text-sm text-slate-400">
            Company
            <input name="company" required className={fieldClass} placeholder="Summit Media Partners" />
          </label>
          <label className="text-sm text-slate-400">
            Contact
            <input name="contactName" className={fieldClass} placeholder="Priya Shah" />
          </label>
          <label className="text-sm text-slate-400">
            Email
            <input name="email" type="email" className={fieldClass} placeholder="ops@publisher.test" />
          </label>
          <label className="text-sm text-slate-400">
            Phone
            <input name="phone" className={fieldClass} placeholder="+12145550100" />
          </label>
          <label className="text-sm text-slate-400">
            Payment terms
            <select name="paymentTerms" defaultValue="NET_15" className={fieldClass}>
              {["PREPAID", "NET_7", "NET_14", "NET_15", "NET_30"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-400">
            Status
            <select name="status" defaultValue="ACTIVE" className={fieldClass}>
              {["PROSPECT", "TESTING", "ACTIVE", "PAUSED"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <fieldset className="md:col-span-3">
            <legend className="text-sm text-slate-400">Verticals</legend>
            <div className="mt-2 flex flex-wrap gap-3 text-xs">
              {VERTICALS.map((v) => (
                <label key={v} className="flex items-center gap-1 text-slate-300">
                  <input type="checkbox" name={`v_${v}`} />
                  {v.replace("_", " ")}
                </label>
              ))}
            </div>
          </fieldset>
          <button disabled={busy} className="rounded-md bg-signal py-2 font-semibold text-ink-950 md:col-span-3">
            {busy ? "Saving…" : "Add publisher"}
          </button>
        </form>
        {error && <p className="mt-3 text-sm text-copper">{error}</p>}
      </Panel>
      <Panel title="Traffic sources">
        <Table headers={["ID", "Company", "Status", "Verticals", "Terms", "Campaigns", "Calls", ""]}>
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="px-3 py-4 text-slate-500">
                No publishers yet.
              </td>
            </tr>
          )}
          {rows.map((p) => (
            <tr key={p.id}>
              <td className="px-3 py-2 font-mono text-xs text-ice">
                <Link href={`/publishers/${p.publicId}`}>{p.publicId}</Link>
              </td>
              <td className="px-3 py-2">{p.company}</td>
              <td className="px-3 py-2 text-xs uppercase text-slate-400">{p.status}</td>
              <td className="px-3 py-2 text-xs">{p.verticals?.join(", ")}</td>
              <td className="px-3 py-2 text-xs">{p.paymentTerms}</td>
              <td className="px-3 py-2">{p._count?.campaigns ?? 0}</td>
              <td className="px-3 py-2">{p._count?.calls ?? 0}</td>
              <td className="px-3 py-2">
                <button className="text-xs text-copper" onClick={() => remove(p.publicId, p.company)}>
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
