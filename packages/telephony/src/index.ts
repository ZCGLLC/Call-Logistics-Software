import { FakeTelephonyProvider } from "./fake.js";
import { GenericSipAdapter, PlivoAdapter, TelnyxAdapter, TwilioAdapter } from "./stubs.js";
import type { TelephonyProvider } from "./types.js";

export function createTelephonyProvider(id: string, fake?: FakeTelephonyProvider): TelephonyProvider {
  switch (id) {
    case "fake":
      return fake ?? new FakeTelephonyProvider();
    case "twilio":
      return TwilioAdapter;
    case "telnyx":
      return TelnyxAdapter;
    case "plivo":
      return PlivoAdapter;
    case "sip":
      return GenericSipAdapter;
    default:
      throw new Error(`Unknown telephony provider: ${id}`);
  }
}

export * from "./types.js";
export * from "./fake.js";
export * from "./stubs.js";
