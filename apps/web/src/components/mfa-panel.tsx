"use client";

import { FormEvent, useState } from "react";
import { api } from "@/lib/api";

export function MfaPanel({ email }: { email: string }) {
  const [otpauth, setOtpauth] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function start() {
    const r = await api<{ secret: string; otpauth: string }>("/api/v1/auth/mfa/start", { method: "POST" });
    setSecret(r.secret);
    setOtpauth(r.otpauth);
    setMsg(null);
  }

  async function enable(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api("/api/v1/auth/mfa/enable", { method: "POST", body: JSON.stringify({ code: fd.get("code") }) });
    setMsg("Authenticator enabled");
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="text-slate-400">
        Enroll an authenticator app for {email}. Production operators should turn this on before taking live traffic.
      </p>
      <button type="button" className="rounded-md bg-signal px-3 py-2 font-semibold text-ink-950" onClick={start}>
        Generate secret
      </button>
      {secret && (
        <div className="rounded-md border border-ink-600 bg-ink-950 p-3 font-mono text-xs">
          <div className="text-slate-500">Secret</div>
          <div className="break-all text-ice">{secret}</div>
          {otpauth && (
            <a className="mt-2 inline-block text-signal" href={otpauth}>
              Open in authenticator
            </a>
          )}
        </div>
      )}
      {secret && (
        <form onSubmit={enable} className="flex gap-2">
          <input name="code" required placeholder="123456" className="rounded-md border border-ink-600 bg-ink-900 px-3 py-2" />
          <button className="rounded-md bg-signal px-3 py-2 font-semibold text-ink-950">Enable</button>
        </form>
      )}
      {msg && <p className="text-signal">{msg}</p>}
    </div>
  );
}
