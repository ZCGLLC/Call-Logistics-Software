export type DialTarget = { e164?: string; sipUri?: string; timeoutSeconds?: number };

export function voiceTwiml(opts: {
  say?: string;
  recordFromAnswer?: boolean;
  actionUrl: string;
  statusCallbackUrl?: string;
  callerId: string;
  targets: DialTarget[];
  simultaneous?: boolean;
}): string {
  const say = opts.say ? `<Say>${escapeXml(opts.say)}</Say>` : "";
  const record = opts.recordFromAnswer ? ` record="record-from-answer"` : "";
  const timeout = opts.targets[0]?.timeoutSeconds ?? 25;
  const status = opts.statusCallbackUrl
    ? ` statusCallback="${escapeXml(opts.statusCallbackUrl)}" statusCallbackEvent="completed"`
    : "";
  const numbers = opts.targets
    .map((t) => {
      if (t.sipUri) return `<Sip>${escapeXml(t.sipUri)}</Sip>`;
      if (t.e164) return `<Number>${escapeXml(t.e164)}</Number>`;
      return "";
    })
    .filter(Boolean)
    .join("");
  const hangup = opts.targets.length === 0 ? "<Hangup/>" : "";
  const dial =
    opts.targets.length === 0
      ? ""
      : `<Dial callerId="${escapeXml(opts.callerId)}" action="${escapeXml(opts.actionUrl)}" timeout="${timeout}"${record}${status}>${numbers}</Dial>`;
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${say}${dial}${hangup}</Response>`;
}

export function hangupTwiml(say?: string): string {
  const speech = say ? `<Say>${escapeXml(say)}</Say>` : "";
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${speech}<Hangup/></Response>`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
