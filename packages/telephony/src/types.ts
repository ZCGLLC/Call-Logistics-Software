export type DestinationOutcome = "answer" | "no_answer" | "reject" | "busy" | "fail";

export interface NumberSearch {
  country?: string;
  areaCode?: string;
  tollFree?: boolean;
  contains?: string;
  limit?: number;
}

export interface AvailableNumber {
  e164: string;
  monthlyCost: string;
  type: "LOCAL" | "TOLL_FREE" | "MOBILE";
  region?: string;
}

export interface PurchaseNumberRequest {
  e164: string;
}

export interface TrackingNumberProvision {
  providerNumberId: string;
  e164: string;
}

export interface InboundCallEvent {
  providerCallId: string;
  from: string;
  to: string;
  raw: unknown;
}

export interface OutboundCallRequest {
  from: string;
  to: string;
  callId: string;
}

export interface ProviderCallRef {
  providerCallId: string;
}

export interface BridgeRequest {
  callerProviderCallId: string;
  destinationProviderCallId: string;
  callId: string;
}

export interface TransferRequest {
  providerCallId: string;
  to: string;
}

export interface RecordRequest {
  providerCallId: string;
  callId: string;
}

export interface PlayAudioRequest {
  providerCallId: string;
  url: string;
}

export interface GatherRequest {
  providerCallId: string;
  timeoutMs: number;
  numDigits: number;
}

export interface ConferenceRequest {
  name: string;
  callId: string;
}

export interface ConferenceRef {
  providerConferenceId: string;
}

export interface AddParticipantRequest {
  conferenceId: string;
  providerCallId: string;
}

export interface RemoveParticipantRequest {
  conferenceId: string;
  providerCallId: string;
}

export interface ProviderCallStatus {
  providerCallId: string;
  status: string;
}

export interface SipConnectionRequest {
  name: string;
  signalingAddress: string;
}

export interface SipConnectionRef {
  id: string;
}

export interface DialSimulation {
  outcome: DestinationOutcome;
  answerDelayMs: number;
}

export interface TelephonyProvider {
  readonly id: string;
  searchNumbers(q: NumberSearch): Promise<AvailableNumber[]>;
  purchaseNumber(req: PurchaseNumberRequest): Promise<TrackingNumberProvision>;
  releaseNumber(providerNumberId: string): Promise<void>;
  receiveCall(payload: unknown): InboundCallEvent;
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

export class ProviderNotConfiguredError extends Error {
  constructor(adapter: string, method: string) {
    super(`${adapter} adapter is not configured: ${method}`);
    this.name = "ProviderNotConfiguredError";
  }
}
