import { Panel, Table } from "@/components/ui";
import { serverApi } from "@/lib/server";
import { MfaPanel } from "@/components/mfa-panel";

type Live = {
  appEnv: string;
  publicBaseUrl: string | null;
  telephony: { id: string; configured: boolean };
  storage: string;
  email: string;
  payments: string;
  webhooks: { twilioInbound: string | null; twilioStatus: string | null; telnyxInbound: string | null };
};

export default async function SettingsPage() {
  const [flags, audit, live, me] = await Promise.all([
    serverApi<{ data: Array<{ key: string; enabled: boolean }> }>("/api/v1/ops/flags"),
    serverApi<{ data: Array<{ action: string; entity: string; createdAt: string }> }>("/api/v1/ops/audit?limit=15").catch(
      () => ({ data: [] as Array<{ action: string; entity: string; createdAt: string }> }),
    ),
    serverApi<Live>("/api/v1/ops/live"),
    serverApi<{ user: { email: string } }>("/api/v1/auth/me"),
  ]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <Panel title="Live cutover">
        <ul className="space-y-1 text-sm text-slate-300">
          <li>
            Environment <span className="font-mono text-ice">{live.appEnv}</span>
          </li>
          <li>
            Telephony <span className="font-mono text-ice">{live.telephony.id}</span>{" "}
            {live.telephony.configured ? "(credentials present)" : "(needs carrier keys)"}
          </li>
          <li>
            Storage <span className="font-mono text-ice">{live.storage}</span> · Email{" "}
            <span className="font-mono text-ice">{live.email}</span> · Payments{" "}
            <span className="font-mono text-ice">{live.payments}</span>
          </li>
          <li className="break-all text-xs text-slate-400">
            Twilio voice URL: {live.webhooks.twilioInbound ?? "Set PUBLIC_BASE_URL to generate webhook URLs"}
          </li>
          <li className="break-all text-xs text-slate-400">Twilio status URL: {live.webhooks.twilioStatus ?? "—"}</li>
          <li className="break-all text-xs text-slate-400">Telnyx inbound URL: {live.webhooks.telnyxInbound ?? "—"}</li>
        </ul>
        <p className="mt-3 text-sm text-slate-400">
          Point the carrier voice webhook at the Twilio or Telnyx inbound URL, generate DIDs, and send those numbers to
          publishers. Invoices settle buyer balances (mark paid after ACH).
        </p>
      </Panel>
      <Panel title="Authenticator (MFA)">
        <MfaPanel email={me.user.email} />
      </Panel>
      <Panel title="Feature flags">
        <Table headers={["Flag", "Enabled"]}>
          {(flags.data ?? []).map((f) => (
            <tr key={f.key}>
              <td className="px-3 py-2 font-mono text-xs">{f.key}</td>
              <td className="px-3 py-2">{f.enabled ? "on" : "off"}</td>
            </tr>
          ))}
        </Table>
      </Panel>
      <Panel title="Recent audit">
        <Table headers={["When", "Action", "Entity"]}>
          {(audit.data ?? []).map((a, i) => (
            <tr key={i}>
              <td className="px-3 py-2 text-xs">{a.createdAt.slice(0, 19)}</td>
              <td className="px-3 py-2 font-mono text-xs">{a.action}</td>
              <td className="px-3 py-2 text-xs">{a.entity}</td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
