import { createHmac, timingSafeEqual } from "node:crypto";

export function signWebhookBody(secret: string, body: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

export function verifyWebhookSignature(secret: string, body: string, header: string): boolean {
  const expected = signWebhookBody(secret, body);
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
