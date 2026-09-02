import { describe, expect, it } from "vitest";
import { FakeTelephonyProvider } from "./fake.js";
import { createTelephonyProvider } from "./index.js";

describe("FakeTelephonyProvider", () => {
  it("scripts no-answer vs answer", async () => {
    const p = new FakeTelephonyProvider();
    p.scriptDestination("+18005550111", { outcome: "no_answer", answerDelayMs: 0 });
    p.scriptDestination("+18005550122", { outcome: "reject", answerDelayMs: 0 });
    p.scriptDestination("+18005550133", { outcome: "answer", answerDelayMs: 0 });
    const a = await p.makeCall({ from: "+18005550000", to: "+18005550111", callId: "c" });
    const b = await p.makeCall({ from: "+18005550000", to: "+18005550122", callId: "c" });
    const c = await p.makeCall({ from: "+18005550000", to: "+18005550133", callId: "c" });
    expect((await p.getCallStatus(a.providerCallId)).status).toBe("no_answer");
    expect((await p.getCallStatus(b.providerCallId)).status).toBe("reject");
    expect((await p.getCallStatus(c.providerCallId)).status).toBe("answered");
  });

  it("factory returns fake", () => {
    expect(createTelephonyProvider("fake").id).toBe("fake");
  });
});
