import { FakeTelephonyProvider } from "./fake.js";
import { GenericSipAdapter, PlivoAdapter } from "./stubs.js";
import { TelnyxTelephonyProvider, telnyxConfigFromEnv } from "./telnyx.js";
import { TwilioTelephonyProvider, twilioConfigFromEnv } from "./twilio.js";
import { ProviderNotConfiguredError, type TelephonyProvider } from "./types.js";

export function createTelephonyProvider(id: string, fake?: FakeTelephonyProvider): TelephonyProvider {
  switch (id) {
    case "fake":
      return fake ?? new FakeTelephonyProvider();
    case "twilio": {
      const cfg = twilioConfigFromEnv();
      if (!cfg) throw new ProviderNotConfiguredError("twilio", "TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN");
      return new TwilioTelephonyProvider(cfg);
    }
    case "telnyx": {
      const cfg = telnyxConfigFromEnv();
      if (!cfg) throw new ProviderNotConfiguredError("telnyx", "TELNYX_API_KEY");
      return new TelnyxTelephonyProvider(cfg);
    }
    case "plivo":
      return PlivoAdapter;
    case "sip":
      return GenericSipAdapter;
    default:
      throw new Error(`Unknown telephony provider: ${id}`);
  }
}

export function telephonyProviderId(): string {
  return process.env.TELEPHONY_PROVIDER ?? "fake";
}

export function telephonyConfigured(id = telephonyProviderId()): boolean {
  if (id === "fake") return true;
  if (id === "twilio") return Boolean(twilioConfigFromEnv());
  if (id === "telnyx") return Boolean(telnyxConfigFromEnv());
  return false;
}

export * from "./types.js";
export * from "./fake.js";
export * from "./stubs.js";
export * from "./twilio.js";
export * from "./telnyx.js";
export * from "./twiml.js";
export * from "./signature.js";
