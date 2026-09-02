import { Body, Controller, Header, Inject, Post, Query, Req, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { hangupTwiml, validTelnyxHmac, validTwilioSignature, voiceTwiml } from "@zcg/telephony";
import { CallOrchestrator } from "../calls/call-orchestrator.service.js";

function form(body: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (body && typeof body === "object") {
    for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
      if (v !== undefined && v !== null) out[k] = String(v);
    }
  }
  return out;
}

function publicUrl(path: string): string {
  const base = (process.env.PUBLIC_BASE_URL ?? "").replace(/\/$/, "");
  return `${base}${path}`;
}

function assertTwilio(req: Request, params: Record<string, string>) {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) throw new UnauthorizedException("Twilio is not configured");
  if (process.env.TELEPHONY_SKIP_SIGNATURE === "true") return;
  const proto = String(req.headers["x-forwarded-proto"] ?? req.protocol ?? "https").replace(":", "");
  const host = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "");
  const url = process.env.PUBLIC_BASE_URL
    ? `${process.env.PUBLIC_BASE_URL.replace(/\/$/, "")}${req.originalUrl.split("?")[0]}`
    : `${proto}://${host}${req.originalUrl.split("?")[0]}`;
  const header = req.headers["x-twilio-signature"];
  if (!validTwilioSignature(token, url, params, Array.isArray(header) ? header[0] : header)) {
    throw new UnauthorizedException("Invalid Twilio signature");
  }
}

@Controller("telephony")
export class TelephonyWebhooksController {
  constructor(@Inject(CallOrchestrator) private readonly orchestrator: CallOrchestrator) {}

  @Post("twilio/inbound")
  @Header("Content-Type", "text/xml")
  async twilioInbound(@Req() req: Request, @Body() body: unknown) {
    const params = form(body);
    assertTwilio(req, params);
    try {
      const call = await this.orchestrator.acceptFromCarrier({
        from: params.From ?? "",
        to: params.To ?? "",
        providerCallId: params.CallSid ?? "",
      });
      return this.dialXml(call, params.CallSid ?? "");
    } catch (err) {
      return hangupTwiml(err instanceof Error ? err.message : "Unable to route call");
    }
  }

  @Post("twilio/dial")
  @Header("Content-Type", "text/xml")
  async twilioDial(@Req() req: Request, @Body() body: unknown, @Query("callSid") callSid?: string) {
    const params = form(body);
    assertTwilio(req, params);
    const sid = callSid || params.CallSid || "";
    const status = params.DialCallStatus ?? params.CallStatus ?? "no-answer";
    const advanced = await this.orchestrator.advanceLiveDial(sid, status);
    if (!advanced.call || !advanced.next) {
      const duration = Number(params.DialCallDuration ?? params.CallDuration ?? 0);
      if (advanced.call && duration > 0) {
        await this.orchestrator.completeLive(sid, duration, params.RecordingUrl);
      }
      return hangupTwiml();
    }
    return this.dialXml(advanced.call, sid);
  }

  @Post("twilio/status")
  async twilioStatus(@Req() req: Request, @Body() body: unknown) {
    const params = form(body);
    assertTwilio(req, params);
    const status = (params.CallStatus ?? "").toLowerCase();
    if (status === "completed") {
      await this.orchestrator.completeLive(
        params.CallSid ?? "",
        Number(params.CallDuration ?? params.DialCallDuration ?? 0),
        params.RecordingUrl,
      );
    }
    return { ok: true };
  }

  @Post("twilio/outbound")
  @Header("Content-Type", "text/xml")
  async twilioOutbound(@Req() req: Request, @Body() body: unknown) {
    const params = form(body);
    assertTwilio(req, params);
    return hangupTwiml();
  }

  @Post("telnyx/inbound")
  @Header("Content-Type", "text/xml")
  async telnyxInbound(@Req() req: Request, @Body() body: unknown) {
    this.assertTelnyx(req, body);
    const params = form(body);
    const from = params.From ?? params.from ?? "";
    const to = params.To ?? params.to ?? "";
    const sid = params.CallSid ?? params.call_control_id ?? "";
    try {
      const call = await this.orchestrator.acceptFromCarrier({ from, to, providerCallId: sid });
      return this.dialXml(call, sid);
    } catch (err) {
      return hangupTwiml(err instanceof Error ? err.message : "Unable to route call");
    }
  }

  @Post("telnyx/events")
  async telnyxEvents(@Req() req: Request, @Body() body: unknown) {
    this.assertTelnyx(req, body);
    const envelope = body as { data?: { event_type?: string; payload?: Record<string, unknown> } };
    const event = envelope.data?.event_type ?? "";
    const payload = envelope.data?.payload ?? {};
    const sid = String(payload.call_control_id ?? "");
    if (event === "call.hangup") {
      const duration = Number(payload.duration_secs ?? 0);
      await this.orchestrator.completeLive(sid, duration, payload.recording_urls as string | undefined);
    }
    return { ok: true };
  }

  private dialXml(
    call: Awaited<ReturnType<CallOrchestrator["inspector"]>>,
    callSid: string,
  ): string {
    const targets = this.orchestrator.liveTargets(call);
    const dest = targets.current;
    if (!dest) return hangupTwiml("No buyers available");
    return voiceTwiml({
      say: call.campaign.recordingEnabled ? (call.campaign.recordingDisclosure ?? "This call may be recorded.") : undefined,
      actionUrl: publicUrl(`/api/v1/telephony/twilio/dial?callSid=${encodeURIComponent(callSid)}`),
      statusCallbackUrl: publicUrl("/api/v1/telephony/twilio/status"),
      callerId: targets.callerId || dest.did || "",
      targets: [{ e164: dest.did, sipUri: dest.sipUri }],
      recordFromAnswer: Boolean(call.campaign.recordingEnabled),
    });
  }

  private assertTelnyx(req: Request, body: unknown) {
    const secret = process.env.TELNYX_WEBHOOK_SECRET;
    if (!secret || process.env.TELEPHONY_SKIP_SIGNATURE === "true") return;
    const ts = String(req.headers["telnyx-timestamp"] ?? "");
    const header = req.headers["telnyx-signature-ed25519"] ?? req.headers["telnyx-signature"];
    const raw = typeof body === "string" ? body : JSON.stringify(body ?? {});
    if (!validTelnyxHmac(secret, ts, raw, Array.isArray(header) ? header[0] : header)) {
      throw new UnauthorizedException("Invalid Telnyx signature");
    }
  }
}
