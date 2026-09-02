"use client";

import { FormEvent, useState } from "react";
import { api } from "@/lib/api";

export function CampaignEditor({
  id,
  status,
  dialMode,
  recordingEnabled,
  recordingDisclosure,
}: {
  id: string;
  status: string;
  dialMode: string;
  recordingEnabled: boolean;
  recordingDisclosure?: string | null;
}) {
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api(`/api/v1/campaigns/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: fd.get("status"),
        dialMode: fd.get("dialMode"),
        recordingEnabled: fd.get("recordingEnabled") === "on",
        recordingDisclosure: fd.get("recordingDisclosure") || null,
      }),
    });
    setMsg("Saved");
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
      <label className="text-sm text-slate-400">
        Status
        <select name="status" defaultValue={status} className="mt-1 w-full rounded-md border border-ink-600 bg-ink-900 px-3 py-2">
          {["DRAFT", "TESTING", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <label className="text-sm text-slate-400">
        Dial mode
        <select name="dialMode" defaultValue={dialMode} className="mt-1 w-full rounded-md border border-ink-600 bg-ink-900 px-3 py-2">
          <option value="WATERFALL">Waterfall</option>
          <option value="SIMULTANEOUS">Simultaneous ring</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-400">
        <input type="checkbox" name="recordingEnabled" defaultChecked={recordingEnabled} />
        Recording enabled (disclosure required)
      </label>
      <label className="text-sm text-slate-400 md:col-span-2">
        Recording disclosure
        <input
          name="recordingDisclosure"
          defaultValue={recordingDisclosure ?? ""}
          className="mt-1 w-full rounded-md border border-ink-600 bg-ink-900 px-3 py-2"
        />
      </label>
      <button className="rounded-md bg-signal py-2 font-semibold text-ink-950">Save campaign</button>
      {msg && <p className="text-sm text-signal">{msg}</p>}
    </form>
  );
}
