"use client";

import { api } from "@/lib/api";

export function InvoiceActions({ id, status }: { id: string; status: string }) {
  async function mark(next: string) {
    await api(`/api/v1/invoices/${id}`, { method: "PATCH", body: JSON.stringify({ status: next }) });
    window.location.reload();
  }
  return (
    <span className="flex gap-2">
      <a className="text-xs text-signal" href={`/api/v1/invoices/${id}/export.csv`}>
        CSV
      </a>
      {status !== "PAID" && (
        <button className="text-xs text-ice" onClick={() => mark("PAID")}>
          Mark paid
        </button>
      )}
      {status === "DRAFT" && (
        <button className="text-xs text-ice" onClick={() => mark("SENT")}>
          Mark sent
        </button>
      )}
    </span>
  );
}
