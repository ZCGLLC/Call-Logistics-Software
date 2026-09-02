"use client";

import { FormEvent, useState } from "react";
import { Gauge } from "lucide-react";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [mfa, setMfa] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        email: fd.get("email"),
        password: fd.get("password"),
        mfaCode: fd.get("mfaCode") || undefined,
      }),
    });
    setPending(false);
    if (!res.ok) {
      setError("Invalid credentials");
      return;
    }
    const body = (await res.json()) as { mfaRequired?: boolean };
    if (body.mfaRequired) {
      setMfa(true);
      setError("Enter your authenticator code");
      return;
    }
    window.location.href = "/";
  }

  return (
    <div className="grid-overlay flex min-h-screen items-center justify-center">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-2xl border border-ink-600 bg-ink-800 p-8 shadow-panel"
      >
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-signal text-ink-950">
            <Gauge className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-signal">ZCG Call Intelligence</div>
            <h1 className="text-xl font-semibold">Sign in</h1>
          </div>
        </div>
        <label className="mb-4 block text-sm text-slate-400">
          Email
          <input
            name="email"
            type="email"
            required
            className="mt-1 w-full rounded-md border border-ink-600 bg-ink-900 px-3 py-2 text-white outline-none focus:border-signal"
            defaultValue="admin@zcg.local"
          />
        </label>
        <label className="mb-6 block text-sm text-slate-400">
          Password
          <input
            name="password"
            type="password"
            required
            defaultValue="ChangeMe_Admin_123!"
          />
        </label>
        {mfa && (
          <label className="mb-6 block text-sm text-slate-400">
            Authenticator code
            <input name="mfaCode" inputMode="numeric" className="mt-1 w-full rounded-md border border-ink-600 bg-ink-900 px-3 py-2 text-white" />
          </label>
        )}
        {error && <p className="mb-4 text-sm text-copper">{error}</p>}
        <button
          disabled={pending}
          className="w-full rounded-md bg-signal py-2.5 text-sm font-semibold text-ink-950 disabled:opacity-50"
        >
          {pending ? "Signing in…" : "Continue"}
        </button>
        <p className="mt-6 text-xs text-slate-500">
          Demo logins (same password): <span className="font-mono text-slate-300">admin@zcg.local</span> (ops),{" "}
          <span className="font-mono text-slate-300">publisher@zcg.local</span> (publisher portal),{" "}
          <span className="font-mono text-slate-300">buyer@zcg.local</span> (buyer portal) /{" "}
          <span className="font-mono text-slate-300">ChangeMe_Admin_123!</span>. This instance is a preview, not production.
        </p>
      </form>
    </div>
  );
}
