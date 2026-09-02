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
import { bearerJson } from "./carrier-http.js";

export interface TelnyxConfig {
  apiKey: string;
  publicBaseUrl: string;
  connectionId?: string;
}

export function telnyxConfigFromEnv(): TelnyxConfig | null {
  const apiKey = process.env.TELNYX_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    publicBaseUrl: (process.env.PUBLIC_BASE_URL ?? "").replace(/\/$/, ""),
    connectionId: process.env.TELNYX_CONNECTION_ID,
  };
}

export class TelnyxTelephonyProvider implements TelephonyProvider {
  readonly id = "telnyx";

  constructor(private readonly cfg: TelnyxConfig) {}

  async searchNumbers(q: NumberSearch): Promise<AvailableNumber[]> {
    const params = new URLSearchParams();
    params.set("filter[country_code]", (q.country ?? "US").toUpperCase());
    params.set("filter[limit]", String(Math.min(25, q.limit ?? 8)));
    params.append("filter[features][]", "voice");
    if (q.tollFree) params.set("filter[phone_number_type]", "toll_free");
    else params.set("filter[phone_number_type]", "local");
    if (q.areaCode && !q.tollFree) params.set("filter[national_destination_code]", q.areaCode);
    const json = await bearerJson(`https://api.telnyx.com/v2/available_phone_numbers?${params}`, this.cfg.apiKey);
    const list = (json.data as Array<{ phone_number?: string; cost_information?: { monthly_cost?: string } }> | undefined) ?? [];
    return list.map((n) => ({
      e164: String(n.phone_number ?? ""),
      monthlyCost: String(n.cost_information?.monthly_cost ?? "1.0000"),
      type: q.tollFree ? "TOLL_FREE" : "LOCAL",
      region: q.country ?? "US",
    }));
  }

  async purchaseNumber(req: PurchaseNumberRequest): Promise<TrackingNumberProvision> {
    const json = await bearerJson("https://api.telnyx.com/v2/number_orders", this.cfg.apiKey, {
      method: "POST",
      body: {
        phone_numbers: [{ phone_number: req.e164 }],
        connection_id: this.cfg.connectionId,
      },
    });
    const data = json.data as { id?: string; phone_numbers?: Array<{ phone_number?: string; id?: string }> };
    const first = data?.phone_numbers?.[0];
    return {
      providerNumberId: String(first?.id ?? data?.id ?? req.e164),
      e164: String(first?.phone_number ?? req.e164),
    };
  }

  async releaseNumber(providerNumberId: string): Promise<void> {
    await bearerJson(`https://api.telnyx.com/v2/phone_numbers/${providerNumberId}`, this.cfg.apiKey, {
      method: "DELETE",
    }).catch(() => undefined);
  }

  receiveCall(payload: unknown): InboundCallEvent {
    const p = payload as Record<string, unknown>;
    const data = (p.data as Record<string, unknown> | undefined) ?? p;
    const payloadObj = (data.payload as Record<string, unknown> | undefined) ?? data;
    return {
      providerCallId: String(payloadObj.call_control_id ?? payloadObj.CallSid ?? p.providerCallId ?? `tx_${Date.now()}`),
      from: String(payloadObj.from ?? p.From ?? p.from ?? ""),
      to: String(payloadObj.to ?? p.To ?? p.to ?? ""),
      raw: payload,
    };
  }

  async makeCall(req: OutboundCallRequest): Promise<ProviderCallRef> {
    if (!this.cfg.connectionId) {
      throw new ProviderNotConfiguredError("telnyx", "makeCall (TELNYX_CONNECTION_ID required)");
    }
    const json = await bearerJson("https://api.telnyx.com/v2/calls", this.cfg.apiKey, {
      method: "POST",
      body: {
        connection_id: this.cfg.connectionId,
        to: req.to,
        from: req.from,
        webhook_url: this.cfg.publicBaseUrl
          ? `${this.cfg.publicBaseUrl}/api/v1/telephony/telnyx/events`
          : undefined,
      },
    });
    const data = json.data as { call_control_id?: string };
    return { providerCallId: String(data?.call_control_id) };
  }

  async bridgeCall(_req: BridgeRequest): Promise<void> {
    return;
  }

  async transferCall(req: TransferRequest): Promise<void> {
    await bearerJson(`https://api.telnyx.com/v2/calls/${req.providerCallId}/actions/transfer`, this.cfg.apiKey, {
      method: "POST",
      body: { to: req.to },
    }).catch(() => undefined);
  }

  async hangupCall(providerCallId: string): Promise<void> {
    await bearerJson(`https://api.telnyx.com/v2/calls/${providerCallId}/actions/hangup`, this.cfg.apiKey, {
      method: "POST",
      body: {},
    }).catch(() => undefined);
  }

  async recordCall(req: RecordRequest): Promise<void> {
    await bearerJson(`https://api.telnyx.com/v2/calls/${req.providerCallId}/actions/record_start`, this.cfg.apiKey, {
      method: "POST",
      body: { format: "mp3", channels: "single" },
    }).catch(() => undefined);
  }

  async stopRecording(providerCallId: string): Promise<void> {
    await bearerJson(`https://api.telnyx.com/v2/calls/${providerCallId}/actions/record_stop`, this.cfg.apiKey, {
      method: "POST",
      body: {},
    }).catch(() => undefined);
  }

  async playAudio(req: PlayAudioRequest): Promise<void> {
    await bearerJson(`https://api.telnyx.com/v2/calls/${req.providerCallId}/actions/playback_start`, this.cfg.apiKey, {
      method: "POST",
      body: { audio_url: req.url },
    }).catch(() => undefined);
  }

  async collectDigits(req: GatherRequest): Promise<void> {
    await bearerJson(`https://api.telnyx.com/v2/calls/${req.providerCallId}/actions/gather_using_audio`, this.cfg.apiKey, {
      method: "POST",
      body: { minimum_digits: req.numDigits, maximum_digits: req.numDigits, timeout_millis: req.timeoutMs },
    }).catch(() => undefined);
  }

  async createConference(req: ConferenceRequest): Promise<ConferenceRef> {
    return { providerConferenceId: `txconf_${req.callId}` };
  }

  async addConferenceParticipant(_req: AddParticipantRequest): Promise<void> {
    return;
  }

  async removeConferenceParticipant(_req: RemoveParticipantRequest): Promise<void> {
    return;
  }

  async getCallStatus(providerCallId: string): Promise<ProviderCallStatus> {
    const json = await bearerJson(`https://api.telnyx.com/v2/calls/${providerCallId}`, this.cfg.apiKey);
    const data = json.data as { is_alive?: boolean; state?: string };
    const state = String(data?.state ?? (data?.is_alive ? "answered" : "unknown"));
    return { providerCallId, status: state };
  }

  async createSipConnection(req: SipConnectionRequest): Promise<SipConnectionRef> {
    return { id: `telnyx_sip_${req.name}` };
  }
}
