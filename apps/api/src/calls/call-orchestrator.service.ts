import { Inject, Injectable } from "@nestjs/common";
import { Money } from "@zcg/shared";
import { createPublicId } from "@zcg/shared";
import { evaluateDurationConversion } from "@zcg/billing";
import { detectDuplicate, isSuppressed } from "@zcg/compliance";
import { route, type DestinationSnapshot, type RankedDestination, type RoutingSnapshot } from "@zcg/routing-engine";
import { walkIvr, type IvrDocument } from "@zcg/ivr";
import { FakeTelephonyProvider, type DestinationOutcome, type TelephonyProvider } from "@zcg/telephony";
import { PrismaService } from "../prisma.service.js";
import { TELEPHONY } from "../telephony.token.js";
import { RealtimeGateway } from "../realtime/realtime.gateway.js";
import { CapsService } from "../caps/caps.service.js";
import { WebhookService } from "../webhooks/webhooks.service.js";
import { AuctionService } from "../rtb/auction.service.js";
import { withCall } from "../logger.js";
import type { DuplicateAction, DuplicateScope, RoutingStrategy } from "@zcg/shared";
import { Prisma } from "@prisma/client";

export interface InboundRequest {
  organizationId: string;
  campaignId?: string;
  trackingE164?: string;
  callerE164: string;
  state?: string;
  zip?: string;
  connectedDurationSeconds?: number;
  destinationScripts?: Record<string, DestinationOutcome>;
  idempotencyKey?: string;
  providerCallId?: string;
  /** Carrier-bridged call: route only, do not simulate duration. */
  live?: boolean;
}

@Injectable()
export class CallOrchestrator {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TELEPHONY) private readonly telephony: TelephonyProvider,
    @Inject(RealtimeGateway) private readonly realtime: RealtimeGateway,
    @Inject(CapsService) private readonly caps: CapsService,
    @Inject(WebhookService) private readonly webhooks: WebhookService,
    @Inject(AuctionService) private readonly auctions: AuctionService,
  ) {}

  async ingest(req: InboundRequest) {
    if (req.idempotencyKey) {
      const existing = await this.prisma.call.findUnique({ where: { idempotencyKey: req.idempotencyKey } });
      if (existing) return this.inspector(existing.id);
    }

    const campaign = await this.loadCampaign(req);
    const number = req.trackingE164
      ? await this.prisma.trackingNumber.findUnique({ where: { e164: req.trackingE164 } })
      : await this.prisma.trackingNumber.findFirst({ where: { campaignId: campaign.id } });

    const inbound = this.telephony.receiveCall({
      from: req.callerE164,
      to: number?.e164 ?? "+18005550000",
      CallSid: req.providerCallId,
      providerCallId: req.providerCallId,
    });

    const call = await this.prisma.call.create({
      data: {
        publicId: createPublicId("call"),
        organizationId: req.organizationId,
        providerCallId: inbound.providerCallId,
        campaignId: campaign.id,
        publisherId: campaign.publisherId,
        trackingNumberId: number?.id,
        callerE164: req.callerE164,
        callerState: req.state,
        callerZip: req.zip,
        status: "INCOMING",
        idempotencyKey: req.idempotencyKey,
      },
    });

    const log = withCall(call.publicId, { campaign_id: campaign.publicId });
    let seq = 0;
    const ev = async (type: string, payload: unknown = {}) => {
      seq += 1;
      await this.prisma.callEvent.create({
        data: { callId: call.id, seq, type, payload: payload as Prisma.InputJsonValue },
      });
    };

    await ev("CALL_RECEIVED", { from: req.callerE164, to: number?.e164 });
    await ev("CALLER_IDENTIFIED", { e164: req.callerE164 });
    await ev("GEO_RESOLVED", { state: req.state, zip: req.zip });
    this.realtime.emitOrg(req.organizationId, "CALL_STARTED", { callId: call.publicId, status: "INCOMING" });
    await this.webhooks.emit(req.organizationId, "call.started", { callId: call.publicId });

    if (campaign.recordingEnabled && campaign.recordingDisclosure) {
      await ev("RECORDING_DISCLOSURE", { text: campaign.recordingDisclosure });
    }

    const suppressions = await this.prisma.suppressionEntry.findMany({
      where: { organizationId: req.organizationId, type: "PHONE" },
    });
    const suppressed = isSuppressed(req.callerE164, suppressions);
    if (suppressed) await ev("SUPPRESSION_HIT", {});

    const history = await this.prisma.call.findMany({
      where: {
        organizationId: req.organizationId,
        callerE164: req.callerE164,
        id: { not: call.id },
      },
      take: 50,
      orderBy: { startedAt: "desc" },
      include: { campaign: true },
    });
    const dup = detectDuplicate({
      callerE164: req.callerE164,
      now: new Date(),
      campaignId: campaign.id,
      verticalId: campaign.verticalId,
      publisherId: campaign.publisherId,
      policy: {
        windowSeconds: campaign.duplicateWindowSeconds,
        scope: campaign.duplicateScope as DuplicateScope,
        action: campaign.duplicateAction as DuplicateAction,
      },
      history: history.map((h) => ({
        callerE164: h.callerE164,
        campaignId: h.campaignId,
        verticalId: h.campaign.verticalId,
        buyerId: h.buyerId,
        publisherId: h.publisherId,
        startedAt: h.startedAt,
      })),
    });
    if (dup.duplicate) await ev("DUPLICATE_DETECTED", { matched: dup.matchedCallStartedAt });

    if (campaign.ivrDefinitionId) {
      const def = await this.prisma.ivrDefinition.findUnique({ where: { id: campaign.ivrDefinitionId } });
      if (def && def.status === "published") {
        await this.prisma.call.update({ where: { id: call.id }, data: { status: "IVR" } });
        await ev("IVR_STARTED", { name: def.name, version: def.version });
        const walked = walkIvr(def.document as unknown as IvrDocument, { attributes: { state: req.state, zip: req.zip } });
        await ev("IVR_COMPLETED", { outcome: walked.outcome, path: walked.path, variables: walked.variables });
        if (walked.outcome === "hangup" || walked.outcome === "voicemail") {
          await ev("CALL_FAILED", { reason: `ivr_${walked.outcome}` });
          await this.prisma.call.update({
            where: { id: call.id },
            data: { status: "FAILED", endedAt: new Date() },
          });
          await this.webhooks.emit(req.organizationId, "call.failed", { callId: call.publicId, reason: walked.outcome });
          return this.inspector(call.id);
        }
      }
    }

    await this.prisma.call.update({ where: { id: call.id }, data: { status: "ROUTING" } });
    await ev("ROUTING_STARTED", {});
    this.realtime.emitOrg(req.organizationId, "CALL_ROUTING", { callId: call.publicId });

    const snapshot = await this.buildSnapshot(campaign, call, req, dup.duplicate, suppressed);

    if (campaign.routingStrategy === "HIGHEST_BID") {
      await this.prisma.call.update({ where: { id: call.id }, data: { status: "AUCTIONING" } });
      await ev("AUCTION_STARTED", {});
      const auction = await this.auctions.runBuyerAuction({
        organizationId: req.organizationId,
        campaignId: campaign.id,
        callId: call.id,
        state: req.state,
        zip: req.zip,
      });
      for (const d of snapshot.destinations) {
        const bid = auction.bids.find((b) => b.buyerId === d.buyerId);
        if (!bid?.accepted || !bid.bid) {
          d.active = false;
        } else {
          d.bid = bid.bid;
          d.revenue = bid.bid;
          if (bid.destination) d.did = bid.destination;
        }
      }
      await ev("AUCTION_COMPLETED", {
        winner: auction.winner?.buyerName,
        bid: auction.winner?.bid?.toFixed(4),
      });
    }

    const result = route(snapshot);
    await this.prisma.call.update({
      where: { id: call.id },
      data: {
        routingExplanation: result.explanation,
        routingSnapshot: {
          strategy: result.strategy,
          explanation: result.explanation,
          traces: result.traces,
          eligible: result.eligible.map((e) => e.destination.buyerName),
          rejected: result.rejected.map((r) => ({ name: r.destination.buyerName, reasons: r.reasons })),
          liveQueue: result.eligible.map((e) => ({
            buyerId: e.destination.buyerId,
            buyerName: e.destination.buyerName,
            destinationId: e.destination.destinationId,
            did: e.destination.did,
            sipUri: e.destination.sipUri,
            revenue: e.destination.revenue.toFixed(4),
            payout: e.destination.payout.toFixed(4),
          })),
          liveIndex: 0,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    for (const r of result.rejected) {
      await ev("BUYER_REJECTED", { buyer: r.destination.buyerName, reasons: r.reasons });
    }
    for (const e of result.eligible) {
      await ev("BUYER_ELIGIBLE", { buyer: e.destination.buyerName, revenue: e.destination.revenue.toFixed(4) });
    }

    if (req.live) {
      await this.prisma.call.update({ where: { id: call.id }, data: { status: "RINGING" } });
      this.realtime.emitOrg(req.organizationId, "CALL_STARTED", { callId: call.publicId, status: "RINGING" });
      return this.inspector(call.id);
    }

    const simulator =
      this.telephony instanceof FakeTelephonyProvider ? this.telephony : new FakeTelephonyProvider();
    simulator.scriptedOutcomes.clear();
    simulator.defaultOutcome = { outcome: "answer", answerDelayMs: 0 };
    if (req.destinationScripts) {
      for (const [dest, outcome] of Object.entries(req.destinationScripts)) {
        simulator.scriptDestination(dest, { outcome, answerDelayMs: 0 });
      }
    }

    const connectedBuyer = await this.dialEligible({
      campaign,
      call,
      inboundProviderCallId: inbound.providerCallId,
      numberE164: number?.e164 ?? "+18005550000",
      eligible: result.eligible,
      ev,
      organizationId: req.organizationId,
      dialer: simulator,
    });

    const duration = req.connectedDurationSeconds ?? 0;
    const telecom = Money.from(String(campaign.estimatedTelecomCost));

    if (connectedBuyer) {
      await this.caps.leaveConcurrent(req.organizationId, connectedBuyer.id);
    }

    if (!connectedBuyer) {
      await ev("CALL_FAILED", { reason: "no buyer answered" });
      await this.prisma.call.update({
        where: { id: call.id },
        data: {
          status: "FAILED",
          endedAt: new Date(),
          telecomCost: telecom.toFixed(4),
          profit: telecom.neg().toFixed(4),
        },
      });
      this.realtime.emitOrg(req.organizationId, "CALL_COMPLETED", { callId: call.publicId, status: "FAILED" });
      await this.webhooks.emit(req.organizationId, "call.failed", { callId: call.publicId });
      return this.inspector(call.id);
    }

    const evaln = evaluateDurationConversion({
      buyerConnectedSeconds: duration,
      buyer: {
        amount: connectedBuyer.revenue,
        thresholdSeconds: campaign.buyerThresholdSeconds,
      },
      publisher: {
        amount: connectedBuyer.payout,
        thresholdSeconds: campaign.publisherThresholdSeconds,
      },
      telecom,
    });

    await simulator.hangupCall(inbound.providerCallId);
    await ev("CALL_ENDED", { talk: duration });

    await this.prisma.$transaction(async (tx) => {
      await tx.call.update({
        where: { id: call.id },
        data: {
          status: "COMPLETED",
          endedAt: new Date(),
          talkDurationSeconds: duration,
          totalDurationSeconds: duration + 8,
          revenue: evaln.revenue.toFixed(4),
          payout: evaln.payout.toFixed(4),
          telecomCost: evaln.telecom.toFixed(4),
          profit: evaln.profit.toFixed(4),
          margin: evaln.margin,
          converted: evaln.converted,
          convertedAt: evaln.converted ? new Date() : null,
          conversionReason: evaln.reason,
          buyerId: connectedBuyer.id,
        },
      });
      if (evaln.converted) {
        const exists = await tx.conversion.findUnique({ where: { callId: call.id } });
        if (!exists) {
          await tx.conversion.create({
            data: {
              publicId: createPublicId("conv"),
              callId: call.id,
              model: "DURATION",
              revenue: evaln.revenue.toFixed(4),
              payout: evaln.payout.toFixed(4),
              telecom: evaln.telecom.toFixed(4),
              profit: evaln.profit.toFixed(4),
              reason: evaln.reason,
            },
          });
        }
      }
    });

    if (evaln.converted) {
      await ev("CONVERSION_CREATED", {
        revenue: evaln.revenue.toFixed(4),
        payout: evaln.payout.toFixed(4),
        profit: evaln.profit.toFixed(4),
      });
      this.realtime.emitOrg(req.organizationId, "CONVERSION_CREATED", { callId: call.publicId });
      await this.webhooks.emit(req.organizationId, "call.converted", {
        callId: call.publicId,
        revenue: evaln.revenue.toFixed(4),
      });
    } else {
      await ev("CONVERSION_SKIPPED", { reason: evaln.reason });
    }

    if (campaign.recordingEnabled) {
      await simulator.recordCall({ providerCallId: inbound.providerCallId, callId: call.publicId });
      await this.prisma.recording.create({
        data: {
          publicId: createPublicId("rec"),
          callId: call.id,
          storageProvider: process.env.STORAGE_PROVIDER ?? "fake",
          filePath: `s3://fake/recordings/${call.publicId}.wav`,
          durationSeconds: duration,
        },
      });
    }

    this.realtime.emitOrg(req.organizationId, "CALL_COMPLETED", {
      callId: call.publicId,
      converted: evaln.converted,
    });
    await this.webhooks.emit(req.organizationId, "call.completed", {
      callId: call.publicId,
      converted: evaln.converted,
    });
    log.info({ converted: evaln.converted, duration }, "call completed");
    return this.inspector(call.id);
  }

  async inspector(callId: string) {
    return this.prisma.call.findUniqueOrThrow({
      where: { id: callId },
      include: {
        campaign: { include: { vertical: true, publisher: true } },
        publisher: true,
        buyer: true,
        trackingNumber: true,
        events: { orderBy: { seq: "asc" } },
        attempts: { orderBy: { startedAt: "asc" } },
        conversions: true,
        auctions: { include: { bids: true } },
        recordings: true,
        disputes: true,
      },
    });
  }

  async acceptFromCarrier(input: { from: string; to: string; providerCallId: string }) {
    const to = normalizeE164(input.to);
    const from = normalizeE164(input.from);
    const number = await this.prisma.trackingNumber.findFirst({
      where: { OR: [{ e164: to }, { e164: input.to }] },
    });
    if (!number) throw new Error(`Unknown tracking DID ${input.to}`);
    return this.ingest({
      organizationId: number.organizationId,
      trackingE164: number.e164,
      callerE164: from,
      providerCallId: input.providerCallId,
      idempotencyKey: input.providerCallId,
      live: true,
    });
  }

  liveTargets(call: { routingSnapshot: unknown; trackingNumber?: { e164?: string | null } | null }) {
    const snap = (call.routingSnapshot ?? {}) as {
      liveQueue?: Array<{
        buyerId: string;
        buyerName: string;
        destinationId: string;
        did?: string;
        sipUri?: string;
        revenue: string;
        payout: string;
      }>;
      liveIndex?: number;
    };
    const queue = snap.liveQueue ?? [];
    const index = snap.liveIndex ?? 0;
    return { current: queue[index], rest: queue.slice(index), index, queue, callerId: call.trackingNumber?.e164 ?? "" };
  }

  async advanceLiveDial(providerCallId: string, dialStatus: string) {
    const call = await this.prisma.call.findFirst({
      where: { providerCallId },
      include: { campaign: true, trackingNumber: true },
    });
    if (!call) return { call: null, next: undefined };
    const answered = ["completed", "answered", "in-progress"].includes(dialStatus.toLowerCase());
    const snap = (call.routingSnapshot ?? {}) as {
      liveQueue?: Array<{ buyerId: string; did?: string; sipUri?: string }>;
      liveIndex?: number;
    };
    const index = snap.liveIndex ?? 0;
    const current = snap.liveQueue?.[index];
    if (answered && current) {
      await this.prisma.call.update({
        where: { id: call.id },
        data: { status: "CONNECTED", buyerId: current.buyerId, answeredAt: new Date(), transferredAt: new Date() },
      });
      return { call: await this.inspector(call.id), next: undefined };
    }
    const nextIndex = index + 1;
    await this.prisma.call.update({
      where: { id: call.id },
      data: { routingSnapshot: { ...(snap as object), liveIndex: nextIndex } as Prisma.InputJsonValue },
    });
    const refreshed = await this.prisma.call.findFirstOrThrow({
      where: { id: call.id },
      include: { trackingNumber: true },
    });
    const targets = this.liveTargets(refreshed);
    if (!targets.current) {
      await this.prisma.call.update({ where: { id: call.id }, data: { status: "FAILED", endedAt: new Date() } });
    }
    return { call: await this.inspector(call.id), next: targets.current };
  }

  async completeLive(providerCallId: string, durationSeconds: number, recordingUrl?: string) {
    const call = await this.prisma.call.findFirst({
      where: { providerCallId },
      include: { campaign: true, buyer: true },
    });
    if (!call) return null;
    if (call.status === "COMPLETED" || call.status === "FAILED") return this.inspector(call.id);
    const duration = Math.max(0, Math.round(durationSeconds));
    const telecom = Money.from(String(call.campaign.estimatedTelecomCost));
    const payout = Money.from(String(call.campaign.publisherPayoutAmount));
    const buyerRevenue = call.buyer
      ? Money.from(String(call.buyer.revenuePerCall))
      : Money.from(String(call.campaign.buyerRevenueAmount));
    const evaln = evaluateDurationConversion({
      buyerConnectedSeconds: duration,
      buyer: { amount: buyerRevenue, thresholdSeconds: call.campaign.buyerThresholdSeconds },
      publisher: { amount: payout, thresholdSeconds: call.campaign.publisherThresholdSeconds },
      telecom,
    });
    await this.prisma.call.update({
      where: { id: call.id },
      data: {
        status: "COMPLETED",
        endedAt: new Date(),
        talkDurationSeconds: duration,
        totalDurationSeconds: duration + 8,
        revenue: evaln.revenue.toFixed(4),
        payout: evaln.payout.toFixed(4),
        telecomCost: evaln.telecom.toFixed(4),
        profit: evaln.profit.toFixed(4),
        margin: evaln.margin,
        converted: evaln.converted,
        convertedAt: evaln.converted ? new Date() : null,
        conversionReason: evaln.reason,
      },
    });
    if (evaln.converted) {
      const exists = await this.prisma.conversion.findUnique({ where: { callId: call.id } });
      if (!exists) {
        await this.prisma.conversion.create({
          data: {
            publicId: createPublicId("conv"),
            callId: call.id,
            model: "DURATION",
            revenue: evaln.revenue.toFixed(4),
            payout: evaln.payout.toFixed(4),
            telecom: evaln.telecom.toFixed(4),
            profit: evaln.profit.toFixed(4),
            reason: evaln.reason,
          },
        });
      }
    }
    if (recordingUrl) {
      await this.prisma.recording.create({
        data: {
          publicId: createPublicId("rec"),
          callId: call.id,
          storageProvider: process.env.STORAGE_PROVIDER ?? "carrier",
          filePath: recordingUrl,
          durationSeconds: duration,
        },
      });
    }
    this.realtime.emitOrg(call.organizationId, "CALL_COMPLETED", {
      callId: call.publicId,
      converted: evaln.converted,
    });
    await this.webhooks.emit(call.organizationId, "call.completed", {
      callId: call.publicId,
      converted: evaln.converted,
    });
    return this.inspector(call.id);
  }

  private async dialEligible(input: {
    campaign: Awaited<ReturnType<CallOrchestrator["loadCampaign"]>>;
    call: { id: string; publicId: string };
    inboundProviderCallId: string;
    numberE164: string;
    eligible: RankedDestination[];
    ev: (type: string, payload?: unknown) => Promise<void>;
    organizationId: string;
    dialer: TelephonyProvider;
  }) {
    type Connected = { id: string; name: string; destinationId: string; did?: string; revenue: Money; payout: Money };
    const dialOne = async (ranked: RankedDestination) => {
      const d = ranked.destination;
      const target = d.did ?? d.sipUri;
      if (!target) return { ranked, attemptResult: "FAILED" as const, outboundId: null as string | null, target };
      await input.ev("BUYER_DIALED", { buyer: d.buyerName, to: target });
      const attemptStart = new Date();
      const outbound = await input.dialer.makeCall({
        from: input.numberE164,
        to: target,
        callId: input.call.publicId,
      });
      const status = await input.dialer.getCallStatus(outbound.providerCallId);
      let attemptResult: "ANSWERED" | "NO_ANSWER" | "REJECTED" | "BUSY" | "FAILED" = "FAILED";
      if (status.status === "answered") attemptResult = "ANSWERED";
      else if (status.status === "no_answer") attemptResult = "NO_ANSWER";
      else if (status.status === "reject") attemptResult = "REJECTED";
      else if (status.status === "busy") attemptResult = "BUSY";
      return { ranked, attemptResult, outboundId: outbound.providerCallId, target, attemptStart };
    };

    const persistAttempt = async (
      ranked: RankedDestination,
      attemptResult: "ANSWERED" | "NO_ANSWER" | "REJECTED" | "BUSY" | "FAILED",
      attemptStart: Date,
    ) => {
      const d = ranked.destination;
      await this.prisma.routingAttempt.create({
        data: {
          publicId: createPublicId("att"),
          callId: input.call.id,
          destinationId: d.destinationId,
          buyerId: d.buyerId,
          buyerName: d.buyerName,
          result: attemptResult,
          reason: attemptResult === "ANSWERED" ? null : attemptResult.toLowerCase(),
          startedAt: attemptStart,
          endedAt: new Date(),
        },
      });
      if (attemptResult === "NO_ANSWER") await input.ev("BUYER_NO_ANSWER", { buyer: d.buyerName });
      if (attemptResult === "REJECTED") await input.ev("BUYER_REJECTED_CALL", { buyer: d.buyerName });
      if (attemptResult === "BUSY") await input.ev("BUYER_BUSY", { buyer: d.buyerName });
    };

    const connect = async (ranked: RankedDestination, outboundId: string): Promise<Connected> => {
      const d = ranked.destination;
      await input.ev("BUYER_ANSWERED", { buyer: d.buyerName });
      await input.dialer.bridgeCall({
        callerProviderCallId: input.inboundProviderCallId,
        destinationProviderCallId: outboundId,
        callId: input.call.publicId,
      });
      await input.ev("CALL_BRIDGED", { buyer: d.buyerName });
      await input.ev("BUYER_SELECTED", { buyer: d.buyerName });
      await this.caps.enterConcurrent(input.organizationId, d.buyerId);
      await this.caps.incrementDaily(input.organizationId, d.buyerId, input.campaign.id);
      await this.prisma.call.update({
        where: { id: input.call.id },
        data: {
          status: "CONNECTED",
          buyerId: d.buyerId,
          answeredAt: new Date(),
          transferredAt: new Date(),
        },
      });
      this.realtime.emitOrg(input.organizationId, "CALL_CONNECTED", {
        callId: input.call.publicId,
        buyer: d.buyerName,
      });
      return {
        id: d.buyerId,
        name: d.buyerName,
        destinationId: d.destinationId,
        did: d.did,
        revenue: d.revenue,
        payout: d.payout,
      };
    };

    if (input.campaign.dialMode === "SIMULTANEOUS") {
      await input.ev("SIMULTANEOUS_RING", { count: input.eligible.length });
      const results = await Promise.all(input.eligible.map((r) => dialOne(r)));
      const winner = results.find((r) => r.attemptResult === "ANSWERED" && r.outboundId);
      for (const r of results) {
        await persistAttempt(r.ranked, r.attemptResult, r.attemptStart ?? new Date());
        if (winner && r !== winner && r.outboundId) {
          await input.dialer.hangupCall(r.outboundId);
          await input.ev("BUYER_CANCELLED", { buyer: r.ranked.destination.buyerName });
        }
      }
      if (winner?.outboundId) return connect(winner.ranked, winner.outboundId);
      return null;
    }

    for (const ranked of input.eligible) {
      const r = await dialOne(ranked);
      await persistAttempt(ranked, r.attemptResult, r.attemptStart ?? new Date());
      if (r.attemptResult === "ANSWERED" && r.outboundId) {
        return connect(ranked, r.outboundId);
      }
    }
    return null;
  }

  private async loadCampaign(req: InboundRequest) {
    if (req.campaignId) {
      return this.prisma.campaign.findFirstOrThrow({
        where: {
          organizationId: req.organizationId,
          OR: [{ id: req.campaignId }, { publicId: req.campaignId }, { name: req.campaignId }],
        },
        include: { buyers: { include: { buyer: { include: { destinations: true } } } }, publisher: true },
      });
    }
    if (req.trackingE164) {
      const n = await this.prisma.trackingNumber.findUniqueOrThrow({
        where: { e164: req.trackingE164 },
        include: {
          campaign: {
            include: { buyers: { include: { buyer: { include: { destinations: true } } } }, publisher: true },
          },
        },
      });
      if (!n.campaign) throw new Error("Tracking number is not assigned to a campaign");
      return n.campaign;
    }
    throw new Error("campaignId or trackingE164 required");
  }

  private async buildSnapshot(
    campaign: Awaited<ReturnType<CallOrchestrator["loadCampaign"]>>,
    call: { id: string; publicId: string; publisherId: string; campaignId: string },
    req: InboundRequest,
    isDuplicate: boolean,
    isSuppressed: boolean,
  ): Promise<RoutingSnapshot> {
    const destinations: DestinationSnapshot[] = [];
    for (const link of campaign.buyers) {
      if (!link.active) continue;
      const buyer = link.buyer;
      const dest = buyer.destinations.find((d) => d.active) ?? buyer.destinations[0];
      if (!dest) continue;
      const dailyUsed = await this.caps.hydrateDailyBuyer(req.organizationId, buyer.id);
      const hourlyUsed = await this.caps.get(this.caps.hourlyBuyerKey(req.organizationId, buyer.id));
      const concurrentUsed = await this.caps.get(this.caps.concurrentBuyerKey(req.organizationId, buyer.id));
      const campaignDaily = await this.caps.hydrateDailyCampaign(req.organizationId, campaign.id);
      if (campaign.dailyCap && campaignDaily >= campaign.dailyCap) {
        continue;
      }
      const hours = await this.prisma.schedule.findFirst({
        where: { OR: [{ campaignId: campaign.id }, { buyerId: buyer.id }] },
      });
      const revenue = Money.from(String(link.revenueOverride ?? buyer.revenuePerCall ?? campaign.buyerRevenueAmount));
      const payout = Money.from(String(link.payoutOverride ?? campaign.publisherPayoutAmount));
      destinations.push({
        id: dest.id,
        buyerId: buyer.id,
        buyerName: buyer.company,
        destinationId: dest.id,
        destinationLabel: dest.label,
        did: dest.did ?? undefined,
        sipUri: dest.sipUri ?? undefined,
        active: buyer.status === "ACTIVE" && dest.active,
        verticalId: campaign.verticalId,
        allowedStates: (link.allowedStates.length ? link.allowedStates : buyer.states) as string[],
        allowedZips: [],
        allowedAreaCodes: [],
        allowedPublisherIds: [],
        allowedCampaignIds: [],
        allowedTrafficSourceIds: [],
        hours: hours
          ? {
              timezone: hours.timezone,
              days: hours.days,
              openMinutes: hours.openMinutes,
              closeMinutes: hours.closeMinutes,
              holidays: hours.holidays,
              blackoutDates: hours.blackoutDates,
            }
          : null,
        caps: {
          concurrent: concurrentUsed,
          concurrentLimit: buyer.concurrentCap,
          hourly: hourlyUsed,
          hourlyLimit: buyer.hourlyCap,
          daily: dailyUsed,
          dailyLimit: link.dailyCap ?? buyer.dailyCap,
          weekly: 0,
          weeklyLimit: buyer.weeklyCap,
          monthly: 0,
          monthlyLimit: buyer.monthlyCap,
        },
        bid: revenue,
        revenue,
        payout,
        estimatedTelecom: Money.from(String(campaign.estimatedTelecomCost)),
        conversionProbability: 0.75,
        epc: revenue.mul(0.7),
        conversionRate: 0.7,
        answerRate: 0.8,
        priority: link.priority,
        weight: link.weight,
        lastConnectedAt: null,
        utilization: buyer.dailyCap ? dailyUsed / buyer.dailyCap : 0,
        minBid: null,
        maxBid: null,
        ivrPredicates: {},
      });
    }

    return {
      now: new Date(),
      call: {
        id: call.publicId,
        callerE164: req.callerE164,
        state: req.state,
        zip: req.zip,
        areaCode: req.callerE164.replace(/\D/g, "").slice(-10, -7),
        attributes: {},
        ivr: {},
        publisherId: call.publisherId,
        campaignId: call.campaignId,
        isDuplicate,
        duplicateAction: campaign.duplicateAction as DuplicateAction,
        isSuppressed,
      },
      campaign: {
        id: campaign.id,
        verticalId: campaign.verticalId,
        routingStrategy: campaign.routingStrategy as RoutingStrategy,
        timezone: campaign.timezone,
        allowedStates: campaign.allowedStates,
      },
      estimatedTelecomCost: Money.from(String(campaign.estimatedTelecomCost)),
      publisherPayout: Money.from(String(campaign.publisherPayoutAmount)),
      destinations,
    };
  }
}

export function normalizeE164(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (value.startsWith("+")) return `+${digits}`;
  return value;
}
