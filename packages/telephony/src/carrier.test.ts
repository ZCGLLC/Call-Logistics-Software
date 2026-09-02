import { describe, expect, it } from "vitest";
import { hangupTwiml, voiceTwiml } from "./twiml.js";
import { twilioSignature, validTwilioSignature } from "./signature.js";
import { TwilioTelephonyProvider } from "./twilio.js";
import { createTelephonyProvider, telephonyConfigured } from "./index.js";

describe("TwiML", () => {
  it("builds a Dial document for a buyer DID", () => {
    const xml = voiceTwiml({
      say: "This call may be recorded",
      actionUrl: "https://app.example/api/v1/telephony/twilio/dial",
      callerId: "+18005550100",
      targets: [{ e164: "+18005550999" }],
      recordFromAnswer: true,
    });
    expect(xml).toContain("<Dial");
    expect(xml).toContain("+18005550999");
    expect(xml).toContain("record-from-answer");
    expect(xml).toContain("This call may be recorded");
  });

  it("hangs up when no targets remain", () => {
    expect(hangupTwiml("No buyers available")).toContain("<Hangup/>");
  });
});

describe("Twilio signature", () => {
  it("accepts a matching HMAC", () => {
    const token = "testtoken";
    const url = "https://app.example/api/v1/telephony/twilio/inbound";
    const params = { CallSid: "CA123", From: "+15551112222", To: "+18005550100" };
    const header = twilioSignature(token, url, params);
    expect(validTwilioSignature(token, url, params, header)).toBe(true);
    expect(validTwilioSignature(token, url, params, "nope")).toBe(false);
  });
});

describe("Twilio provider parse", () => {
  it("maps inbound webhook fields", () => {
    const p = new TwilioTelephonyProvider({
      accountSid: "ACxxx",
      authToken: "tok",
      publicBaseUrl: "https://app.example",
    });
    const ev = p.receiveCall({ CallSid: "CA9", From: "+12145550000", To: "+18005550100" });
    expect(ev.providerCallId).toBe("CA9");
    expect(ev.from).toBe("+12145550000");
    expect(ev.to).toBe("+18005550100");
  });
});

describe("factory", () => {
  it("still returns fake by default", () => {
    expect(createTelephonyProvider("fake").id).toBe("fake");
    expect(telephonyConfigured("fake")).toBe(true);
    expect(telephonyConfigured("twilio")).toBe(false);
  });

  it("throws when twilio env is missing", () => {
    expect(() => createTelephonyProvider("twilio")).toThrow(/TWILIO_ACCOUNT_SID/);
  });
});
