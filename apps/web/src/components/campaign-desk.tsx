"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Panel, Table, fieldClass } from "@/components/ui";
import { api, usd } from "@/lib/api";

export type CampaignRow = {
  id: string;
  publicId: string;
  name: string;
  status: string;
  routingStrategy: string;
  buyerRevenueAmount: string;
  publisherPayoutAmount: string;
  buyerThresholdSeconds: number;
  publisherThresholdSeconds: number;
  vertical?: { name: string };
  publisher?: { company: string; publicId: string };
  _count?: { calls: number };
};

export function CampaignDesk({
  initial,
  publishers,
  buyers,
  verticals,
}: {
  initial: CampaignRow[];
  publishers: { publicId: string; company: string }[];
  buyers: { publicId: string; company: string }[];
  verticals: { id: string; slug: string; name: string }[];
}) {
  const [rows, setRows] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function reload() {
    const r = await api<{ data: CampaignRow[] }>("/api/v1/campaigns");
    setRows(r.data ?? []);
    router.refresh();
  }

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const buyerId = String(fd.get("buyerId") || "");
    try {
      await api("/api/v1/campaigns", {
        method: "POST",
        body: JSON.stringify({
          name: fd.get("name"),
          publisherId: fd.get("publisherId"),
          verticalId: fd.get("verticalId"),
          buyerIds: buyerId ? [buyerId] : [],
          buyerRevenueAmount: fd.get("buyerRevenueAmount") || "0",
          publisherPayoutAmount: fd.get("publisherPayoutAmount") || "0",
          buyerThresholdSeconds: Number(fd.get("buyerThresholdSeconds") || 90),
          publisherThresholdSeconds: Number(fd.get("publisherThresholdSeconds") || 90),
          status: fd.get("status"),
        }),
      });
      form.reset();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create campaign");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Remove ${name}? Campaigns with call history are archived instead of deleted.`)) return;
    setError(null);
    try {
      await api(`/api/v1/campaigns/${id}`, { method: "DELETE" });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove campaign");
    }
  }

  return (
    <div className="space-y-4">
      <Panel title="Add campaign">
        <form onSubmit={onCreate} className="grid gap-3 md:grid-cols-3">
          <label className="text-sm text-slate-400">
            Name
            <input name="name" required className={fieldClass} placeholder="Medicare TX cascade" />
          </label>
          <label className="text-sm text-slate-400">
            Publisher
            <select name="publisherId" required className={fieldClass} defaultValue={publishers[0]?.publicId ?? ""}>
              {publishers.map((p) => (
                <option key={p.publicId} value={p.publicId}>
                  {p.company}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-400">
            Vertical
            <select name="verticalId" required className={fieldClass} defaultValue={verticals[0]?.id ?? ""}>
              {verticals.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-400">
            Buyer (optional)
            <select name="buyerId" className={fieldClass} defaultValue="">
              <option value="">None yet</option>
              {buyers.map((b) => (
                <option key={b.publicId} value={b.publicId}>
                  {b.company}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-400">
            Buyer / call
            <input name="buyerRevenueAmount" className={fieldClass} defaultValue="42.00" />
          </label>
          <label className="text-sm text-slate-400">
            Publisher / call
            <input name="publisherPayoutAmount" className={fieldClass} defaultValue="28.00" />
          </label>
          <label className="text-sm text-slate-400">
            Buyer buffer (s)
            <input name="buyerThresholdSeconds" type="number" className={fieldClass} defaultValue={90} />
          </label>
          <label className="text-sm text-slate-400">
            Publisher buffer (s)
            <input name="publisherThresholdSeconds" type="number" className={fieldClass} defaultValue={90} />
          </label>
          <label className="text-sm text-slate-400">
            Status
            <select name="status" defaultValue="ACTIVE" className={fieldClass}>
              {["DRAFT", "TESTING", "ACTIVE", "PAUSED"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <button disabled={busy} className="rounded-md bg-signal py-2 font-semibold text-ink-950 md:col-span-3">
            {busy ? "Saving…" : "Add campaign"}
          </button>
        </form>
        {error && <p className="mt-3 text-sm text-copper">{error}</p>}
      </Panel>
      <Panel title="Active graph">
        <Table headers={["ID", "Name", "Vertical", "Publisher", "Strategy", "Buyer / Pub", "Buffer", "Status", ""]}>
          {rows.length === 0 && (
            <tr>
              <td colSpan={9} className="px-3 py-4 text-slate-500">
                No campaigns yet.
              </td>
            </tr>
          )}
          {rows.map((c) => (
            <tr key={c.id}>
              <td className="px-3 py-2 font-mono text-xs text-ice">
                <Link href={`/campaigns/${c.publicId}`}>{c.publicId}</Link>
              </td>
              <td className="px-3 py-2">{c.name}</td>
              <td className="px-3 py-2">{c.vertical?.name}</td>
              <td className="px-3 py-2">{c.publisher?.company}</td>
              <td className="px-3 py-2 text-xs">{c.routingStrategy}</td>
              <td className="px-3 py-2 font-mono text-xs">
                {usd(String(c.buyerRevenueAmount))} / {usd(String(c.publisherPayoutAmount))}
              </td>
              <td className="px-3 py-2 font-mono text-xs">
                {c.buyerThresholdSeconds}s / {c.publisherThresholdSeconds}s
              </td>
              <td className="px-3 py-2 text-xs uppercase">{c.status}</td>
              <td className="px-3 py-2">
                <button className="text-xs text-copper" onClick={() => remove(c.publicId, c.name)}>
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
