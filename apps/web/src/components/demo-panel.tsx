"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Panel } from "./ui";

export function DemoPanel() {
  const [out, setOut] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const r = await api("/api/v1/demo/mvp-scenarios", { method: "POST", body: "{}" });
      setOut(r);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title="MVP scenario runner"
      action={
        <button onClick={run} disabled={busy} className="rounded-md bg-signal px-3 py-1 text-xs font-semibold text-ink-950">
          {busy ? "Running…" : "Run scenarios 1–4"}
        </button>
      }
    >
      <p className="mb-3 text-sm text-slate-400">
        Executes Medicare highest-revenue, Final Expense buffer (8s / 14s), waterfall, and in-process RTB against FakeTelephonyProvider.
      </p>
      {out ? (
        <pre className="max-h-96 overflow-auto rounded-md bg-ink-950 p-3 font-mono text-[11px] text-slate-300">
          {JSON.stringify(out, null, 2)}
        </pre>
      ) : (
        <p className="text-sm text-slate-500">No run yet.</p>
      )}
    </Panel>
  );
}
