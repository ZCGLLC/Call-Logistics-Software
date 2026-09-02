import { describe, expect, it } from "vitest";
import { detectDuplicate } from "./index.js";

describe("duplicate detection", () => {
  const base = {
    callerE164: "+12145551234",
    now: new Date("2026-03-15T16:00:00Z"),
    campaignId: "c1",
    verticalId: "v1",
    publisherId: "p1",
    policy: { windowSeconds: 86400, scope: "CAMPAIGN" as const, action: "REJECT" as const },
    history: [
      {
        callerE164: "+12145551234",
        campaignId: "c1",
        verticalId: "v1",
        publisherId: "p1",
        startedAt: new Date("2026-03-15T10:00:00Z"),
      },
    ],
  };

  it("flags duplicate in 24h campaign window", () => {
    expect(detectDuplicate(base).duplicate).toBe(true);
  });

  it("ignores other campaigns when scope is CAMPAIGN", () => {
    expect(detectDuplicate({ ...base, campaignId: "c2" }).duplicate).toBe(false);
  });
});
