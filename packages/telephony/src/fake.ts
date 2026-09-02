import type {
  AddParticipantRequest,
  AvailableNumber,
  BridgeRequest,
  ConferenceRef,
  ConferenceRequest,
  DestinationOutcome,
  DialSimulation,
  GatherRequest,
  InboundCallEvent,
  NumberSearch,
  OutboundCallRequest,
  PlayAudioRequest,
  ProviderCallRef,
  ProviderCallStatus,
  PurchaseNumberRequest,
  RecordRequest,
  RemoveParticipantRequest,
  SipConnectionRef,
  SipConnectionRequest,
  TelephonyProvider,
  TrackingNumberProvision,
  TransferRequest,
} from "./types.js";

export interface FakeCallLeg {
  providerCallId: string;
  from: string;
  to: string;
  status: string;
  outcome?: DestinationOutcome;
}

/**
 * In-memory carrier. Used for local/demo/tests. Never used in production
 * if TELEPHONY_PROVIDER is not explicitly `fake`.
 */
export class FakeTelephonyProvider implements TelephonyProvider {
  readonly id = "fake";
  readonly legs = new Map<string, FakeCallLeg>();
  readonly recordings = new Map<string, { path: string }>();
  scriptedOutcomes = new Map<string, DialSimulation>();
  defaultOutcome: DialSimulation = { outcome: "answer", answerDelayMs: 0 };
  private seq = 0;

  nextId(prefix: string): string {
    this.seq += 1;
    return `${prefix}_${this.seq}`;
  }

  scriptDestination(e164OrSip: string, sim: DialSimulation): void {
    this.scriptedOutcomes.set(e164OrSip, sim);
  }

  async searchNumbers(q: NumberSearch): Promise<AvailableNumber[]> {
    const area = q.areaCode ?? "214";
    return [
      {
        e164: `+1${area}5550100`,
        monthlyCost: "1.0000",
        type: q.tollFree ? "TOLL_FREE" : "LOCAL",
        region: "TX",
      },
    ];
  }

  async purchaseNumber(req: PurchaseNumberRequest): Promise<TrackingNumberProvision> {
    return { providerNumberId: this.nextId("pn"), e164: req.e164 };
  }

  async releaseNumber(_providerNumberId: string): Promise<void> {
    return;
  }

  receiveCall(payload: unknown): InboundCallEvent {
    const p = payload as { from?: string; to?: string; providerCallId?: string };
    const providerCallId = p.providerCallId ?? this.nextId("in");
    this.legs.set(providerCallId, {
      providerCallId,
      from: p.from ?? "+10000000000",
      to: p.to ?? "+18005550100",
      status: "ringing",
    });
    return { providerCallId, from: p.from ?? "", to: p.to ?? "", raw: payload };
  }

  async makeCall(req: OutboundCallRequest): Promise<ProviderCallRef> {
    const sim = this.scriptedOutcomes.get(req.to) ?? this.defaultOutcome;
    const providerCallId = this.nextId("out");
    this.legs.set(providerCallId, {
      providerCallId,
      from: req.from,
      to: req.to,
      status: sim.outcome === "answer" ? "answered" : sim.outcome,
      outcome: sim.outcome,
    });
    return { providerCallId };
  }

  async bridgeCall(_req: BridgeRequest): Promise<void> {
    return;
  }

  async transferCall(_req: TransferRequest): Promise<void> {
    return;
  }

  async hangupCall(providerCallId: string): Promise<void> {
    const leg = this.legs.get(providerCallId);
    if (leg) leg.status = "completed";
  }

  async recordCall(req: RecordRequest): Promise<void> {
    this.recordings.set(req.providerCallId, { path: `s3://fake/recordings/${req.callId}.wav` });
  }

  async stopRecording(_providerCallId: string): Promise<void> {
    return;
  }

  async playAudio(_req: PlayAudioRequest): Promise<void> {
    return;
  }

  async collectDigits(_req: GatherRequest): Promise<void> {
    return;
  }

  async createConference(req: ConferenceRequest): Promise<ConferenceRef> {
    return { providerConferenceId: `conf_${req.callId}` };
  }

  async addConferenceParticipant(_req: AddParticipantRequest): Promise<void> {
    return;
  }

  async removeConferenceParticipant(_req: RemoveParticipantRequest): Promise<void> {
    return;
  }

  async getCallStatus(providerCallId: string): Promise<ProviderCallStatus> {
    const leg = this.legs.get(providerCallId);
    return { providerCallId, status: leg?.status ?? "unknown" };
  }

  async createSipConnection(req: SipConnectionRequest): Promise<SipConnectionRef> {
    return { id: `sip_${req.name}` };
  }

  getOutcome(to: string): DialSimulation {
    return this.scriptedOutcomes.get(to) ?? this.defaultOutcome;
  }
}
