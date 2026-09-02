import { describe, expect, it } from "vitest";
import { signWebhookBody, verifyWebhookSignature } from "./hmac.js";

describe("webhook HMAC", () => {
  it("round-trips a signature", () => {
    const body = JSON.stringify({ event: "call.completed" });
    const sig = signWebhookBody("whsec_test", body);
    expect(sig.startsWith("sha256=")).toBe(true);
    expect(verifyWebhookSignature("whsec_test", body, sig)).toBe(true);
    expect(verifyWebhookSignature("other", body, sig)).toBe(false);
  });
});
