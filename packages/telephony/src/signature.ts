import { createHmac, timingSafeEqual } from "node:crypto";

/** Twilio request validation: HMAC-SHA1 of the full URL plus sorted POST params. */
export function twilioSignature(authToken: string, url: string, params: Record<string, string>): string {
  const data =
    url +
    Object.keys(params)
      .sort()
      .map((k) => k + params[k])
      .join("");
  return createHmac("sha1", authToken).update(data).digest("base64");
}

export function validTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
  header: string | undefined,
): boolean {
  if (!header) return false;
  const expected = twilioSignature(authToken, url, params);
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Telnyx ed25519 timestamps are verified in the adapter when TELNYX_PUBLIC_KEY is set. HMAC-SHA256 fallback. */
export function telnyxHmac(secret: string, timestamp: string, rawBody: string): string {
  return createHmac("sha256", secret).update(timestamp + rawBody).digest("base64");
}

export function validTelnyxHmac(
  secret: string,
  timestamp: string,
  rawBody: string,
  header: string | undefined,
): boolean {
  if (!header) return false;
  const expected = telnyxHmac(secret, timestamp, rawBody);
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
