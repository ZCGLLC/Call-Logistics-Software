"use client";

import { FormEvent, useEffect, useState } from "react";
import { Panel } from "@/components/ui";
import { api } from "@/lib/api";

interface SimResult {
  strategy: string;
  explanation: string;
  selected: { buyer: string; revenue: string; payout: string; expectedProfit: string } | null;
  eligible: { buyer: string; revenue: string; rank: number }[];
  rejected: { buyer: string; reasons: string[] }[];
  traces: { buyerName: string; rule: string; input: string; expected: string; pass: boolean }[];
}

export default function SimulatorPage() {
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [result, setResult] = useState<SimResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ data: { id: string; name: string }[] }>("/api/v1/campaigns").then((r) => setCampaigns(r.data));
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const r = await api<SimResult>("/api/v1/routing/simulate", {
        method: "POST",
        body: JSON.stringify({
          campaignId: fd.get("campaignId"),
          state: fd.get("state"),
          zip: fd.get("zip"),
          callerE164: fd.get("callerE164"),
        }),
      });
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Call flow simulator</h1>
      <p className="text-sm text-slate-400">Runs the production routing engine without placing a PSTN call.</p>
      <Panel title="Scenario">
        <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
          <label className="text-sm text-slate-400">
            Campaign
            <select name="campaignId" className="mt-1 w-full rounded-md border border-ink-600 bg-ink-900 px-3 py-2">
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-400">
            State
            <input name="state" defaultValue="TX" className="mt-1 w-full rounded-md border border-ink-600 bg-ink-900 px-3 py-2" />
          </label>
          <label className="text-sm text-slate-400">
            ZIP
            <input name="zip" defaultValue="75201" className="mt-1 w-full rounded-md border border-ink-600 bg-ink-900 px-3 py-2" />
          </label>
          <label className="text-sm text-slate-400">
            Caller
            <input name="callerE164" defaultValue="+12145551234" className="mt-1 w-full rounded-md border border-ink-600 bg-ink-900 px-3 py-2" />
          </label>
          <button className="md:col-span-2 rounded-md bg-signal py-2 font-semibold text-ink-950">Simulate routing</button>
        </form>
        {error && <p className="mt-3 text-sm text-copper">{error}</p>}
      </Panel>
      {result && (
        <>
          <Panel title="Explanation">
            <pre className="whitespace-pre-wrap font-mono text-xs text-slate-300">{result.explanation}</pre>
            {result.selected && (
              <p className="mt-3 text-sm">
                Selected <strong>{result.selected.buyer}</strong> · revenue {result.selected.revenue} · expected profit{" "}
                {result.selected.expectedProfit}
              </p>
            )}
          </Panel>
          <Panel title="Debugger traces">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-1">Buyer</th>
                  <th>Rule</th>
                  <th>Input</th>
                  <th>Expected</th>
                  <th>Pass</th>
                </tr>
              </thead>
              <tbody>
                {result.traces.map((t, i) => (
                  <tr key={i}>
                    <td className="py-1">{t.buyerName}</td>
                    <td>{t.rule}</td>
                    <td className="font-mono">{t.input}</td>
                    <td className="font-mono">{t.expected}</td>
                    <td className={t.pass ? "text-signal" : "text-copper"}>{t.pass ? "PASS" : "FAIL"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </>
      )}
    </div>
  );
}
