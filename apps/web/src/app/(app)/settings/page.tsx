import { Panel, Table } from "@/components/ui";
import { serverApi } from "@/lib/server";

export default async function SettingsPage() {
  const [flags, audit] = await Promise.all([
    serverApi<{ data: Array<{ key: string; enabled: boolean }> }>("/api/v1/ops/flags"),
    serverApi<{ data: Array<{ action: string; entity: string; createdAt: string }> }>("/api/v1/ops/audit?limit=15").catch(
      () => ({ data: [] as Array<{ action: string; entity: string; createdAt: string }> }),
    ),
  ]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <Panel title="Environment">
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
          <li>Telephony provider is selected by TELEPHONY_PROVIDER (default: fake).</li>
          <li>JWT_SECRET and SEED_ADMIN_PASSWORD must be set outside git.</li>
          <li>API keys use X-Api-Key. Cookie sessions stay httpOnly.</li>
          <li>Caps use Redis when REDIS_URL is reachable; Postgres remains the source of truth.</li>
        </ul>
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
