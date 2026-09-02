"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<{ type: string; href: string; label: string; detail: string }[]>([]);
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => {
      if (q.trim().length < 2) {
        setRows([]);
        return;
      }
      api<{ data: typeof rows }>(`/api/v1/search?q=${encodeURIComponent(q)}`)
        .then((r) => setRows(r.data ?? []))
        .catch(() => setRows([]));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 p-8" onClick={onClose}>
      <div
        className="mx-auto max-w-lg rounded-xl border border-ink-600 bg-ink-800 shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search calls, campaigns, partners…"
          className="w-full rounded-t-xl border-b border-ink-600 bg-transparent px-4 py-3 outline-none"
        />
        <ul className="max-h-80 overflow-auto p-2 text-sm">
          {rows.map((r) => (
            <li key={`${r.type}-${r.href}-${r.label}`}>
              <button
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left hover:bg-ink-700"
                onClick={() => {
                  router.push(r.href);
                  onClose();
                }}
              >
                <span>
                  <span className="mr-2 text-[10px] uppercase text-slate-500">{r.type}</span>
                  {r.label}
                </span>
                <span className="font-mono text-xs text-slate-500">{r.detail}</span>
              </button>
            </li>
          ))}
          {q.length >= 2 && rows.length === 0 && <li className="px-3 py-4 text-slate-500">No matches</li>}
        </ul>
      </div>
    </div>
  );
}
