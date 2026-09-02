export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <div className="rounded-xl border border-ink-600 bg-ink-800 p-6 text-sm text-slate-300">
        <p className="mb-2 font-medium text-white">Environment</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Telephony provider is selected by TELEPHONY_PROVIDER (default: fake).</li>
          <li>JWT_SECRET and SEED_ADMIN_PASSWORD must be set outside git.</li>
          <li>Feature flags: RTB, AI, DIALER, TRANSCRIPTION, portals — stored per organization.</li>
          <li>Light/dark: Aperture ships dark-first; a light token set is reserved for P1.</li>
        </ul>
      </div>
    </div>
  );
}
