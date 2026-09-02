"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Panel, Table, fieldClass } from "@/components/ui";
import { api } from "@/lib/api";

export type NumberRow = {
  id: string;
  publicId: string;
  e164: string;
  provider: string;
  numberType: string;
  status: string;
  campaign?: { name?: string; publicId?: string } | null;
  publisher?: { company?: string; publicId?: string } | null;
};

export function NumberDesk({
  initial,
  publishers,
  campaigns,
  lockedPublisherId,
}: {
  initial: NumberRow[];
  publishers: { publicId: string; company: string }[];
  campaigns: { publicId: string; name: string; publisher?: { publicId?: string } }[];
  lockedPublisherId?: string;
}) {
  const [rows, setRows] = useState(initial);
  const [created, setCreated] = useState<NumberRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [publisherId, setPublisherId] = useState(lockedPublisherId ?? publishers[0]?.publicId ?? "");
  const router = useRouter();

  const publisherCampaigns = useMemo(
    () => campaigns.filter((c) => !publisherId || c.publisher?.publicId === publisherId),
    [campaigns, publisherId],
  );

  async function reload() {
    const r = await api<{ data: NumberRow[] }>("/api/v1/numbers");
    setRows(r.data ?? []);
    router.refresh();
  }

  async function onGenerate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const r = await api<{ data: NumberRow[] }>("/api/v1/numbers/provision", {
        method: "POST",
        body: JSON.stringify({
          publisherId: fd.get("publisherId"),
          campaignId: fd.get("campaignId") || undefined,
          quantity: Number(fd.get("quantity") || 1),
          numberType: fd.get("numberType"),
          areaCode: fd.get("areaCode") || undefined,
        }),
      });
      setCreated(r.data ?? []);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not provision DIDs");
    } finally {
      setBusy(false);
    }
  }

  async function release(id: string, e164: string) {
    if (!confirm(`Release ${e164}? It will be removed from inventory and cannot be used for routing.`)) return;
    try {
      await api(`/api/v1/numbers/${id}`, { method: "DELETE" });
      setCreated((c) => c.filter((n) => n.publicId !== id && n.id !== id));
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not release DID");
    }
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
  }

  return (
    <div className="space-y-4">
      <Panel title="Generate DIDs for a publisher">
        <p className="mb-3 text-sm text-slate-400">
          Allocates unique tracking numbers from the active telephony provider (fake inventory in demo) and assigns
          them to the publisher so you can send the list out.
        </p>
        {publishers.length === 0 ? (
          <p className="text-sm text-copper">
            Add a publisher first, then return here to generate DIDs assigned to them.
          </p>
        ) : (
          <form onSubmit={onGenerate} className="grid gap-3 md:grid-cols-3">
            {!lockedPublisherId && (
              <label className="text-sm text-slate-400">
                Publisher
                <select
                  name="publisherId"
                  required
                  className={fieldClass}
                  value={publisherId}
                  onChange={(e) => setPublisherId(e.target.value)}
                >
                  {publishers.map((p) => (
                    <option key={p.publicId} value={p.publicId}>
                      {p.company}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {lockedPublisherId && <input type="hidden" name="publisherId" value={lockedPublisherId} />}
            <label className="text-sm text-slate-400">
              Campaign (optional)
              <select name="campaignId" className={fieldClass} defaultValue="">
                <option value="">Unassigned — send to publisher</option>
                {publisherCampaigns.map((c) => (
                  <option key={c.publicId} value={c.publicId}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-400">
              Type
              <select name="numberType" defaultValue="TOLL_FREE" className={fieldClass}>
                <option value="TOLL_FREE">Toll-free</option>
                <option value="LOCAL">Local</option>
              </select>
            </label>
            <label className="text-sm text-slate-400">
              Area code (local)
              <input name="areaCode" className={fieldClass} placeholder="214" defaultValue="214" />
            </label>
            <label className="text-sm text-slate-400">
              Quantity
              <input name="quantity" type="number" min={1} max={25} defaultValue={5} className={fieldClass} />
            </label>
            <button disabled={busy} className="rounded-md bg-signal py-2 font-semibold text-ink-950 md:col-span-3">
              {busy ? "Provisioning…" : "Generate DIDs"}
            </button>
          </form>
        )}
        {error && <p className="mt-3 text-sm text-copper">{error}</p>}
        {created.length > 0 && (
          <div className="mt-4 rounded-md border border-ink-600 bg-ink-950 p-3">
            <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
              <span>Send these numbers to the publisher</span>
              <button className="text-signal" onClick={() => copy(created.map((n) => n.e164).join("\n"))}>
                Copy all
              </button>
            </div>
            <ul className="space-y-1 font-mono text-sm">
              {created.map((n) => (
                <li key={n.publicId} className="flex justify-between">
                  <span>{n.e164}</span>
                  <button className="text-xs text-ice" onClick={() => copy(n.e164)}>
                    Copy
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Panel>
      <Panel title="Inventory">
        <Table headers={["DID", "Provider", "Type", "Status", "Campaign", "Publisher", ""]}>
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-4 text-slate-500">
                No tracking numbers yet.
              </td>
            </tr>
          )}
          {rows.map((n) => (
            <tr key={n.id}>
              <td className="px-3 py-2 font-mono">{n.e164}</td>
              <td className="px-3 py-2 text-xs uppercase">{n.provider}</td>
              <td className="px-3 py-2 text-xs">{n.numberType}</td>
              <td className="px-3 py-2 text-xs">{n.status}</td>
              <td className="px-3 py-2">{n.campaign?.name ?? "—"}</td>
              <td className="px-3 py-2">{n.publisher?.company ?? "—"}</td>
              <td className="px-3 py-2">
                <button className="text-xs text-copper" onClick={() => release(n.publicId, n.e164)}>
                  Release
                </button>
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
