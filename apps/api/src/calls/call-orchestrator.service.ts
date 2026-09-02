import { Inject, Injectable } from "@nestjs/common";
import { Money } from "@zcg/shared";
import { createPublicId } from "@zcg/shared";
import { evaluateDurationConversion } from "@zcg/billing";
import { detectDuplicate, isSuppressed } from "@zcg/compliance";
import { route, type DestinationSnapshot, type RoutingSnapshot } from "@zcg/routing-engine";
import { FakeTelephonyProvider, type DestinationOutcome, type TelephonyProvider } from "@zcg/telephony";
import { PrismaService } from "../prisma.service.js";
import { TELEPHONY } from "../telephony.token.js";
import { RealtimeGateway } from "../realtime/realtime.gateway.js";
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
}

@Injectable()
export class CallOrchestrator {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(TELEPHONY) private readonly telephony: TelephonyProvider,
    private readonly realtime: RealtimeGateway,
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

    await this.prisma.call.update({ where: { id: call.id }, data: { status: "ROUTING" } });
    await ev("ROUTING_STARTED", {});
    this.realtime.emitOrg(req.organizationId, "CALL_ROUTING", { callId: call.publicId });

    const snapshot = await this.buildSnapshot(campaign, call, req, dup.duplicate, suppressed);
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
        } as unknown as Prisma.InputJsonValue,
      },
    });

    for (const r of result.rejected) {
      await ev("BUYER_REJECTED", { buyer: r.destination.buyerName, reasons: r.reasons });
    }
    for (const e of result.eligible) {
      await ev("BUYER_ELIGIBLE", { buyer: e.destination.buyerName, revenue: e.destination.revenue.toFixed(4) });
    }

    const fake = this.telephony instanceof FakeTelephonyProvider ? this.telephony : null;
    if (fake && req.destinationScripts) {
      for (const [dest, outcome] of Object.entries(req.destinationScripts)) {
        fake.scriptDestination(dest, { outcome, answerDelayMs: 0 });
      }
    }

    let connectedBuyer: { id: string; name: string; destinationId: string; did?: string; revenue: Money; payout: Money } | null =
      null;

    for (const ranked of result.eligible) {
      const d = ranked.destination;
      const target = d.did ?? d.sipUri;
      if (!target) continue;
      await ev("BUYER_DIALED", { buyer: d.buyerName, to: target });
      const attemptStart = new Date();
      const outbound = await this.telephony.makeCall({
        from: number?.e164 ?? "+18005550000",
        to: target,
        callId: call.publicId,
      });
      const status = await this.telephony.getCallStatus(outbound.providerCallId);
      let attemptResult: "ANSWERED" | "NO_ANSWER" | "REJECTED" | "BUSY" | "FAILED" = "FAILED";
      if (status.status === "answered") attemptResult = "ANSWERED";
      else if (status.status === "no_answer") attemptResult = "NO_ANSWER";
      else if (status.status === "reject") attemptResult = "REJECTED";
      else if (status.status === "busy") attemptResult = "BUSY";

      await this.prisma.routingAttempt.create({
        data: {
          publicId: createPublicId("att"),
          callId: call.id,
          destinationId: d.destinationId,
          buyerId: d.buyerId,
          buyerName: d.buyerName,
          result: attemptResult,
          reason: attemptResult === "ANSWERED" ? null : status.status,
          startedAt: attemptStart,
          endedAt: new Date(),
        },
      });

      if (attemptResult === "NO_ANSWER") await ev("BUYER_NO_ANSWER", { buyer: d.buyerName });
      if (attemptResult === "REJECTED") await ev("BUYER_REJECTED_CALL", { buyer: d.buyerName });
      if (attemptResult === "BUSY") await ev("BUYER_BUSY", { buyer: d.buyerName });

      if (attemptResult === "ANSWERED") {
        await ev("BUYER_ANSWERED", { buyer: d.buyerName });
        await this.telephony.bridgeCall({
          callerProviderCallId: inbound.providerCallId,
          destinationProviderCallId: outbound.providerCallId,
          callId: call.publicId,
        });
        await ev("CALL_BRIDGED", { buyer: d.buyerName });
        await ev("BUYER_SELECTED", { buyer: d.buyerName });
        connectedBuyer = {
          id: d.buyerId,
          name: d.buyerName,
          destinationId: d.destinationId,
          did: d.did,
          revenue: d.revenue,
          payout: d.payout,
        };
        await this.prisma.call.update({
          where: { id: call.id },
          data: {
            status: "CONNECTED",
            buyerId: d.buyerId,
            answeredAt: new Date(),
            transferredAt: new Date(),
          },
        });
        this.realtime.emitOrg(req.organizationId, "CALL_CONNECTED", {
          callId: call.publicId,
          buyer: d.buyerName,
        });
        break;
      }
    }

    const duration = req.connectedDurationSeconds ?? 0;
    const telecom = Money.from(String(campaign.estimatedTelecomCost));

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

    await this.telephony.hangupCall(inbound.providerCallId);
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
          buyerId: connectedBuyer!.id,
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
    } else {
      await ev("CONVERSION_SKIPPED", { reason: evaln.reason });
    }

    if (campaign.recordingEnabled) {
      await this.telephony.recordCall({ providerCallId: inbound.providerCallId, callId: call.publicId });
      await this.prisma.recording.create({
        data: {
          publicId: createPublicId("rec"),
          callId: call.id,
          storageProvider: "fake",
          filePath: `s3://fake/recordings/${call.publicId}.wav`,
          durationSeconds: duration,
        },
      });
    }

    this.realtime.emitOrg(req.organizationId, "CALL_COMPLETED", {
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
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const destinations: DestinationSnapshot[] = [];
    for (const link of campaign.buyers) {
      if (!link.active) continue;
      const buyer = link.buyer;
      const dest = buyer.destinations.find((d) => d.active) ?? buyer.destinations[0];
      if (!dest) continue;
      const dailyUsed = await this.prisma.call.count({
        where: { buyerId: buyer.id, startedAt: { gte: start }, status: { not: "FAILED" } },
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
        hours: null,
        caps: {
          concurrent: 0,
          concurrentLimit: buyer.concurrentCap,
          hourly: 0,
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
