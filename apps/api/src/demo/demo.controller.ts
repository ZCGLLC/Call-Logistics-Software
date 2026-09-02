import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { createPublicId } from "@zcg/shared";
import { runFakeAuction, selectWinner } from "@zcg/rtb";
import { PrismaService } from "../prisma.service.js";
import { AuthGuard, CurrentUser, type AuthPrincipal } from "../auth/auth.guard.js";
import { CallOrchestrator } from "../calls/call-orchestrator.service.js";

@Controller("demo")
@UseGuards(AuthGuard)
export class DemoController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orchestrator: CallOrchestrator,
  ) {}

  @Post("inbound")
  async inbound(@CurrentUser() user: AuthPrincipal, @Body() body: unknown) {
    const dto = z
      .object({
        campaignId: z.string().optional(),
        trackingE164: z.string().optional(),
        callerE164: z.string(),
        state: z.string().optional(),
        zip: z.string().optional(),
        connectedDurationSeconds: z.number().int().min(0).default(90),
        destinationScripts: z.record(z.enum(["answer", "no_answer", "reject", "busy", "fail"])).optional(),
        idempotencyKey: z.string().optional(),
      })
      .parse(body);
    return this.orchestrator.ingest({
      organizationId: user.organizationId,
      ...dto,
    });
  }

  @Get("mvp-scenarios")
  async mvpGet(@CurrentUser() user: AuthPrincipal) {
    return this.mvp(user);
  }

  @Post("mvp-scenarios")
  async mvp(@CurrentUser() user: AuthPrincipal) {
    const s1 = await this.scenario1(user.organizationId);
    const s2a = await this.scenario2(user.organizationId, 8);
    const s2b = await this.scenario2(user.organizationId, 14);
    const s3 = await this.scenario3(user.organizationId);
    const s4 = this.scenario4();
    return {
      scenario1_medicareHighestRevenue: summarize(s1),
      scenario2a_buffer8s: summarize(s2a),
      scenario2b_buffer14s: summarize(s2b),
      scenario3_waterfall: summarize(s3),
      scenario4_rtb: s4,
    };
  }

  private async scenario1(organizationId: string) {
    const campaign = await this.prisma.campaign.findFirstOrThrow({
      where: { organizationId, name: "Medicare TX — Highest Revenue" },
    });
    return this.orchestrator.ingest({
      organizationId,
      campaignId: campaign.id,
      callerE164: "+12145551234",
      state: "TX",
      zip: "75201",
      connectedDurationSeconds: 130,
      idempotencyKey: `mvp1-${Date.now()}`,
    });
  }

  private async scenario2(organizationId: string, seconds: number) {
    const campaign = await this.prisma.campaign.findFirstOrThrow({
      where: { organizationId, name: "Final Expense Buffer" },
    });
    return this.orchestrator.ingest({
      organizationId,
      campaignId: campaign.id,
      callerE164: `+1214555${seconds === 8 ? "2008" : "2014"}`,
      state: "TX",
      connectedDurationSeconds: seconds,
      idempotencyKey: `mvp2-${seconds}-${Date.now()}`,
    });
  }

  private async scenario3(organizationId: string) {
    const campaign = await this.prisma.campaign.findFirstOrThrow({
      where: { organizationId, name: "Medicare Waterfall" },
      include: { buyers: { include: { buyer: { include: { destinations: true } } } } },
    });

    let third = await this.prisma.buyer.findFirst({
      where: { organizationId, company: "Hill Country Intake" },
    });
    if (!third) {
      third = await this.prisma.buyer.create({
        data: {
          publicId: createPublicId("buy"),
          organizationId,
          company: "Hill Country Intake",
          status: "ACTIVE",
          states: ["TX"],
          revenuePerCall: "36.0000",
          conversionThresholdSeconds: 90,
        },
      });
      await this.prisma.buyerDestination.create({
        data: {
          publicId: createPublicId("dst"),
          buyerId: third.id,
          label: "Waterfall C",
          did: "+18005551903",
        },
      });
    }
    const linked = await this.prisma.campaignBuyer.findFirst({
      where: { campaignId: campaign.id, buyerId: third.id },
    });
    if (!linked) {
      await this.prisma.campaignBuyer.create({
        data: {
          campaignId: campaign.id,
          buyerId: third.id,
          priority: 3,
          revenueOverride: "36.0000",
          allowedStates: ["TX"],
        },
      });
    }

    const refreshed = await this.prisma.campaign.findFirstOrThrow({
      where: { id: campaign.id },
      include: { buyers: { include: { buyer: { include: { destinations: true } } } } },
    });
    const scripts: Record<string, "answer" | "no_answer" | "reject"> = {};
    const sorted = [...refreshed.buyers].sort((a, b) => {
      const ra = Number(a.revenueOverride ?? a.buyer.revenuePerCall);
      const rb = Number(b.revenueOverride ?? b.buyer.revenuePerCall);
      return rb - ra;
    });
    const outcomes: Array<"no_answer" | "reject" | "answer"> = ["no_answer", "reject", "answer"];
    sorted.forEach((link, i) => {
      const did = link.buyer.destinations[0]?.did;
      if (did) scripts[did] = outcomes[i] ?? "answer";
    });

    return this.orchestrator.ingest({
      organizationId,
      campaignId: campaign.id,
      callerE164: "+12145553003",
      state: "TX",
      connectedDurationSeconds: 100,
      destinationScripts: scripts,
      idempotencyKey: `mvp3-${Date.now()}`,
    });
  }

  private scenario4() {
    const bids = runFakeAuction([
      {
        buyerId: "a",
        buyerName: "A",
        latencyMs: 40,
        response: { accept: true, bid: "32.00", destination: "+18005550101" },
      },
      {
        buyerId: "b",
        buyerName: "B",
        latencyMs: 55,
        response: { accept: true, bid: "45.00", destination: "+18005550102" },
      },
      {
        buyerId: "c",
        buyerName: "C",
        latencyMs: 80,
        response: { accept: true, bid: "39.00", destination: "+18005550103" },
      },
      { buyerId: "d", buyerName: "D", latencyMs: 20, response: { accept: false } },
    ]);
    const winner = selectWinner(bids);
    return {
      winner: winner?.buyerName,
      bid: winner?.bid?.toFixed(4),
      failover: "C",
      bids: bids.map((b) => ({
        buyer: b.buyerName,
        accepted: b.accepted,
        bid: b.bid?.toFixed(4) ?? null,
        reason: b.rejectionReason ?? null,
        latencyMs: b.latencyMs,
      })),
    };
  }
}

function summarize(call: Awaited<ReturnType<CallOrchestrator["inspector"]>>) {
  return {
    callId: call.publicId,
    status: call.status,
    buyer: call.buyer?.company ?? null,
    talkDurationSeconds: call.talkDurationSeconds,
    converted: call.converted,
    revenue: String(call.revenue),
    payout: String(call.payout),
    telecom: String(call.telecomCost),
    profit: String(call.profit),
    explanation: call.routingExplanation,
    events: call.events.map((e) => e.type),
    attempts: call.attempts.map((a) => ({ buyer: a.buyerName, result: a.result })),
  };
}
