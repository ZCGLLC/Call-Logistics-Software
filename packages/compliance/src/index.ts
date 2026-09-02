import type { DuplicateAction, DuplicateScope } from "@zcg/shared";

export interface DuplicatePolicy {
  windowSeconds: number;
  scope: DuplicateScope;
  action: DuplicateAction;
}

export const WINDOW_PRESETS: Record<string, number> = {
  "1h": 3600,
  "24h": 86400,
  "7d": 604800,
  "30d": 2592000,
  "90d": 7776000,
  lifetime: 0,
};

export interface HistoricalCall {
  callerE164: string;
  campaignId: string;
  verticalId: string;
  buyerId?: string | null;
  publisherId: string;
  startedAt: Date;
}

export function detectDuplicate(input: {
  callerE164: string;
  now: Date;
  campaignId: string;
  verticalId: string;
  publisherId: string;
  buyerId?: string;
  policy: DuplicatePolicy;
  history: HistoricalCall[];
}): { duplicate: boolean; matchedCallStartedAt?: Date } {
  const windowMs = input.policy.windowSeconds === 0 ? Number.POSITIVE_INFINITY : input.policy.windowSeconds * 1000;
  for (const h of input.history) {
    if (h.callerE164 !== input.callerE164) continue;
    const age = input.now.getTime() - h.startedAt.getTime();
    if (age < 0 || age > windowMs) continue;
    switch (input.policy.scope) {
      case "CAMPAIGN":
        if (h.campaignId !== input.campaignId) continue;
        break;
      case "VERTICAL":
        if (h.verticalId !== input.verticalId) continue;
        break;
      case "BUYER":
        if (!input.buyerId || h.buyerId !== input.buyerId) continue;
        break;
      case "PUBLISHER":
        if (h.publisherId !== input.publisherId) continue;
        break;
      case "PLATFORM":
        break;
    }
    return { duplicate: true, matchedCallStartedAt: h.startedAt };
  }
  return { duplicate: false };
}

export function isSuppressed(
  value: string,
  lists: { value: string; type: string }[],
  type = "PHONE",
): boolean {
  const needle = value.replace(/\D/g, "");
  return lists.some((e) => e.type === type && e.value.replace(/\D/g, "") === needle);
}
