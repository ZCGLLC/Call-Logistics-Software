import { validateBidResponse, type ValidatedBid } from "./validate.js";
import { Money } from "@zcg/shared";

export interface HttpPingTarget {
  buyerId: string;
  buyerName: string;
  url: string;
  timeoutMs: number;
  maxBid?: Money;
}

export async function pingHttpBidder(
  target: HttpPingTarget,
  payload: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<ValidatedBid> {
  const started = Date.now();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), target.timeoutMs);
  try {
    const res = await fetchImpl(target.url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(payload),
      signal: ac.signal,
    });
    const raw = await res.json().catch(() => null);
    return validateBidResponse({
      buyerId: target.buyerId,
      buyerName: target.buyerName,
      raw,
      latencyMs: Date.now() - started,
      timeoutMs: target.timeoutMs,
      maxBid: target.maxBid,
    });
  } catch {
    return validateBidResponse({
      buyerId: target.buyerId,
      buyerName: target.buyerName,
      raw: null,
      latencyMs: Date.now() - started,
      timeoutMs: target.timeoutMs,
      maxBid: target.maxBid,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function pingHttpBidders(
  targets: HttpPingTarget[],
  payload: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<ValidatedBid[]> {
  return Promise.all(targets.map((t) => pingHttpBidder(t, payload, fetchImpl)));
}
