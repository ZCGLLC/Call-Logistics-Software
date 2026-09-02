export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export async function sendMail(msg: MailMessage): Promise<{ ok: boolean; provider: string }> {
  const provider = process.env.EMAIL_PROVIDER ?? "console";
  if (provider === "console" || provider === "none") {
    console.info({ to: msg.to, subject: msg.subject }, "email.console");
    return { ok: true, provider: "console" };
  }
  if (provider === "webhook") {
    const url = process.env.EMAIL_WEBHOOK_URL;
    if (!url) throw new Error("EMAIL_WEBHOOK_URL is required when EMAIL_PROVIDER=webhook");
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(process.env.EMAIL_WEBHOOK_TOKEN ? { Authorization: `Bearer ${process.env.EMAIL_WEBHOOK_TOKEN}` } : {}) },
      body: JSON.stringify({ from: process.env.SMTP_FROM ?? "zcg-ci@localhost", ...msg }),
    });
    if (!res.ok) throw new Error(`Email webhook failed ${res.status}`);
    return { ok: true, provider: "webhook" };
  }
  throw new Error(`Unknown EMAIL_PROVIDER ${provider}`);
}

export function emailProviderId(): string {
  return process.env.EMAIL_PROVIDER ?? "console";
}
