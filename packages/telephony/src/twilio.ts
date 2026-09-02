import { ProviderNotConfiguredError, type TelephonyProvider } from "./types.js";
import type {
  AddParticipantRequest,
  AvailableNumber,
  BridgeRequest,
  ConferenceRef,
  ConferenceRequest,
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
  TrackingNumberProvision,
  TransferRequest,
} from "./types.js";
import { basicForm, basicGet } from "./carrier-http.js";

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  publicBaseUrl: string;
}

export function twilioConfigFromEnv(): TwilioConfig | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return null;
  return {
    accountSid,
    authToken,
    publicBaseUrl: (process.env.PUBLIC_BASE_URL ?? "").replace(/\/$/, ""),
  };
}

export class TwilioTelephonyProvider implements TelephonyProvider {
  readonly id = "twilio";

  constructor(private readonly cfg: TwilioConfig) {}

  private acc(path: string): string {
    return `https://api.twilio.com/2010-04-01/Accounts/${this.cfg.accountSid}${path}`;
  }

  async searchNumbers(q: NumberSearch): Promise<AvailableNumber[]> {
    const country = (q.country ?? "US").toUpperCase();
    const kind = q.tollFree ? "TollFree" : "Local";
    const params = new URLSearchParams({ PageSize: String(Math.min(25, q.limit ?? 8)) });
    if (q.areaCode && !q.tollFree) params.set("AreaCode", q.areaCode);
    if (q.contains) params.set("Contains", q.contains);
    const json = await basicGet(
      `${this.acc(`/AvailablePhoneNumbers/${country}/${kind}.json`)}?${params}`,
      this.cfg.accountSid,
      this.cfg.authToken,
    );
    const list = (json.available_phone_numbers as Array<Record<string, unknown>> | undefined) ?? [];
    return list.map((n) => ({
      e164: String(n.phone_number ?? ""),
      monthlyCost: String(n.monthly_cost ?? "1.0000"),
      type: q.tollFree ? "TOLL_FREE" : "LOCAL",
      region: String(n.region ?? n.iso_country ?? country),
    }));
  }

  async purchaseNumber(req: PurchaseNumberRequest): Promise<TrackingNumberProvision> {
    const voice = this.cfg.publicBaseUrl
      ? `${this.cfg.publicBaseUrl}/api/v1/telephony/twilio/inbound`
      : undefined;
    const status = this.cfg.publicBaseUrl
      ? `${this.cfg.publicBaseUrl}/api/v1/telephony/twilio/status`
      : undefined;
    const body: Record<string, string> = { PhoneNumber: req.e164 };
    if (voice) {
      body.VoiceUrl = voice;
      body.VoiceMethod = "POST";
    }
    if (status) {
      body.StatusCallback = status;
      body.StatusCallbackMethod = "POST";
    }
    const json = await basicForm(this.acc("/IncomingPhoneNumbers.json"), this.cfg.accountSid, this.cfg.authToken, body);
    return {
      providerNumberId: String(json.sid ?? req.e164),
      e164: String(json.phone_number ?? req.e164),
    };
  }

  async releaseNumber(providerNumberId: string): Promise<void> {
    const auth = Buffer.from(`${this.cfg.accountSid}:${this.cfg.authToken}`).toString("base64");
    const res = await fetch(this.acc(`/IncomingPhoneNumbers/${providerNumberId}.json`), {
      method: "DELETE",
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!res.ok && res.status !== 404) {
      throw new Error(`Twilio release failed ${res.status}`);
    }
  }

  receiveCall(payload: unknown): InboundCallEvent {
    const p = payload as Record<string, string>;
    return {
      providerCallId: p.CallSid ?? p.providerCallId ?? `tw_${Date.now()}`,
      from: p.From ?? p.from ?? "",
      to: p.To ?? p.to ?? "",
      raw: payload,
    };
  }

  async makeCall(req: OutboundCallRequest): Promise<ProviderCallRef> {
    if (!this.cfg.publicBaseUrl) {
      throw new ProviderNotConfiguredError("twilio", "makeCall (PUBLIC_BASE_URL required)");
    }
    const json = await basicForm(this.acc("/Calls.json"), this.cfg.accountSid, this.cfg.authToken, {
      From: req.from,
      To: req.to,
      Url: `${this.cfg.publicBaseUrl}/api/v1/telephony/twilio/outbound?callId=${encodeURIComponent(req.callId)}`,
      StatusCallback: `${this.cfg.publicBaseUrl}/api/v1/telephony/twilio/status`,
      StatusCallbackMethod: "POST",
    });
    return { providerCallId: String(json.sid) };
  }

  async bridgeCall(_req: BridgeRequest): Promise<void> {
    return;
  }

  async transferCall(req: TransferRequest): Promise<void> {
    if (!this.cfg.publicBaseUrl) return;
    await basicForm(
      this.acc(`/Calls/${req.providerCallId}.json`),
      this.cfg.accountSid,
      this.cfg.authToken,
      {
        Url: `${this.cfg.publicBaseUrl}/api/v1/telephony/twilio/transfer?to=${encodeURIComponent(req.to)}`,
        Method: "POST",
      },
    );
  }

  async hangupCall(providerCallId: string): Promise<void> {
    await basicForm(this.acc(`/Calls/${providerCallId}.json`), this.cfg.accountSid, this.cfg.authToken, {
      Status: "completed",
    }).catch(() => undefined);
  }

  async recordCall(_req: RecordRequest): Promise<void> {
    return;
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
    return { providerConferenceId: `twconf_${req.callId}` };
  }

  async addConferenceParticipant(_req: AddParticipantRequest): Promise<void> {
    return;
  }

  async removeConferenceParticipant(_req: RemoveParticipantRequest): Promise<void> {
    return;
  }

  async getCallStatus(providerCallId: string): Promise<ProviderCallStatus> {
    const json = await basicGet(this.acc(`/Calls/${providerCallId}.json`), this.cfg.accountSid, this.cfg.authToken);
    const status = String(json.status ?? "unknown");
    const mapped =
      status === "in-progress" || status === "answered"
        ? "answered"
        : status === "no-answer"
          ? "no_answer"
          : status === "busy"
            ? "busy"
            : status === "failed" || status === "canceled"
              ? "reject"
              : status;
    return { providerCallId, status: mapped };
  }

  async createSipConnection(req: SipConnectionRequest): Promise<SipConnectionRef> {
    return { id: `twilio_sip_${req.name}` };
  }
}
