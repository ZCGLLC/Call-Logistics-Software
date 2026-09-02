# Telephony Abstraction

Package: `@zcg/telephony`

The application **never** imports a carrier SDK outside adapter files.

## Interface (P0 subset + full surface)

```ts
interface TelephonyProvider {
  readonly id: string;
  searchNumbers(q: NumberSearch): Promise<AvailableNumber[]>;
  purchaseNumber(req: PurchaseNumberRequest): Promise<TrackingNumberProvision>;
  releaseNumber(providerNumberId: string): Promise<void>;
  receiveCall(payload: unknown): InboundCallEvent; // parse webhook
  makeCall(req: OutboundCallRequest): Promise<ProviderCallRef>;
  bridgeCall(req: BridgeRequest): Promise<void>;
  transferCall(req: TransferRequest): Promise<void>;
  hangupCall(providerCallId: string): Promise<void>;
  recordCall(req: RecordRequest): Promise<void>;
  stopRecording(providerCallId: string): Promise<void>;
  playAudio(req: PlayAudioRequest): Promise<void>;
  collectDigits(req: GatherRequest): Promise<void>;
  createConference(req: ConferenceRequest): Promise<ConferenceRef>;
  addConferenceParticipant(req: AddParticipantRequest): Promise<void>;
  removeConferenceParticipant(req: RemoveParticipantRequest): Promise<void>;
  getCallStatus(providerCallId: string): Promise<ProviderCallStatus>;
  createSipConnection(req: SipConnectionRequest): Promise<SipConnectionRef>;
}
```

## Adapters

| Adapter | Status |
| --- | --- |
| `FakeTelephonyProvider` | Full MVP simulation |
| `TwilioAdapter` | Interface + not-implemented errors until credentials |
| `TelnyxAdapter` | Same |
| `PlivoAdapter` | Same |
| `GenericSipAdapter` | Documents future Asterisk/FreeSWITCH/Kamailio/OpenSIPS signaling via SIP over HTTP/AMI/ESL — not in MVP |

## Fake provider behavior

- `POST /api/v1/demo/inbound` starts a call with supplied ANI/DNIS/state/duration plan.
- Simulates RINGING → ANSWER / NO_ANSWER / REJECT / BUSY per destination script.
- Emits the same internal events as a real adapter.
- Writes recording **metadata** (URL `s3://fake/...`) without audio bytes.

## Provider failover (P2)

`ProviderRouter` tries `TELEPHONY_PRIMARY` then `TELEPHONY_SECONDARY`. Number inventory stores `provider` per DID so the inbound webhook selects the owning adapter.

## Self-hosted SIP (P3)

`GenericSipAdapter` would:

1. Own DIDs in `TrackingNumber.provider = sip`
2. Receive CDR/call events from the SBC (HTTP or AMQP)
3. Issue originate/bridge via ESL (FreeSWITCH) or AMI/ARI (Asterisk) or SIP REFER through Kamailio

ZCG CI still owns routing, billing, and portals. The SIP stack remains a utility.
