import { ProviderNotConfiguredError, type TelephonyProvider } from "./types.js";

function stub(name: string): TelephonyProvider {
  const fail = (m: string) => {
    throw new ProviderNotConfiguredError(name, m);
  };
  return {
    id: name,
    searchNumbers: async () => fail("searchNumbers"),
    purchaseNumber: async () => fail("purchaseNumber"),
    releaseNumber: async () => fail("releaseNumber"),
    receiveCall: () => fail("receiveCall"),
    makeCall: async () => fail("makeCall"),
    bridgeCall: async () => fail("bridgeCall"),
    transferCall: async () => fail("transferCall"),
    hangupCall: async () => fail("hangupCall"),
    recordCall: async () => fail("recordCall"),
    stopRecording: async () => fail("stopRecording"),
    playAudio: async () => fail("playAudio"),
    collectDigits: async () => fail("collectDigits"),
    createConference: async () => fail("createConference"),
    addConferenceParticipant: async () => fail("addConferenceParticipant"),
    removeConferenceParticipant: async () => fail("removeConferenceParticipant"),
    getCallStatus: async () => fail("getCallStatus"),
    createSipConnection: async () => fail("createSipConnection"),
  };
}

export const TwilioAdapter = stub("twilio");
export const TelnyxAdapter = stub("telnyx");
export const PlivoAdapter = stub("plivo");

/**
 * Future path to Asterisk / FreeSWITCH / Kamailio / OpenSIPS.
 * Signaling would use AMI/ARI, ESL, or SIP HTTP gateways — not implemented in MVP.
 */
export const GenericSipAdapter = stub("sip");
