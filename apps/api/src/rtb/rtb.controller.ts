import { Body, Controller, Inject, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { Money, isPublisherRole } from "@zcg/shared";
import { PrismaService } from "../prisma.service.js";
import { AuthGuard, CurrentUser, assertScope, type AuthPrincipal } from "../auth/auth.guard.js";
import { AuctionService } from "./auction.service.js";
import { CallOrchestrator } from "../calls/call-orchestrator.service.js";
import { campaignScope } from "../auth/tenant.js";

@Controller("rtb")
@UseGuards(AuthGuard)
export class RtbController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuctionService) private readonly auctions: AuctionService,
    @Inject(CallOrchestrator) private readonly orchestrator: CallOrchestrator,
  ) {}

  @Post("ping")
  async ping(@CurrentUser() user: AuthPrincipal, @Body() body: unknown) {
    assertScope(user, "rtb:write");
    const dto = z
      .object({
        campaignId: z.string(),
        phone: z.string().optional(),
        state: z.string().optional(),
        zip: z.string().optional(),
        attributes: z.record(z.unknown()).optional(),
      })
      .parse(body);
    const campaign = await this.prisma.campaign.findFirstOrThrow({
      where: { ...campaignScope(user), OR: [{ id: dto.campaignId }, { publicId: dto.campaignId }] },
    });
    const result = await this.auctions.runBuyerAuction({
      organizationId: user.organizationId,
      campaignId: campaign.id,
      state: dto.state,
      zip: dto.zip,
      attributes: dto.attributes,
    });
    const payout = result.winner
      ? Money.from(String(campaign.publisherPayoutAmount))
      : Money.zero();
    const pingId = await this.auctions.storePing({
      organizationId: user.organizationId,
      campaignId: campaign.id,
      publisherId: user.publisherId ?? campaign.publisherId,
      phone: dto.phone,
      state: dto.state,
      zip: dto.zip,
      winnerBuyerId: result.winner?.buyerId ?? null,
      destination: result.winner?.destination ?? result.winner?.sip ?? null,
      bid: result.winner?.bid?.toFixed(4) ?? null,
      payout: payout.toFixed(4),
      expiresAt: Date.now() + 90_000,
    });
    return {
      pingId,
      accept: Boolean(result.winner),
      payout: result.winner ? payout.toFixed(4) : null,
      expiresIn: 90,
      bids: isPublisherRole(user.role)
        ? result.bids.map((b, i) => ({
            destination: i + 1,
            accepted: b.accepted,
            latencyMs: b.latencyMs,
            reason: b.rejectionReason ?? null,
          }))
        : result.bids.map((b) => ({
            buyerId: b.buyerId,
            accepted: b.accepted,
            latencyMs: b.latencyMs,
            reason: b.rejectionReason ?? null,
          })),
    };
  }

  @Post("post")
  async post(@CurrentUser() user: AuthPrincipal, @Body() body: unknown) {
    assertScope(user, "rtb:write");
    const dto = z
      .object({
        pingId: z.string(),
        connectedDurationSeconds: z.number().int().min(0).default(90),
        callerE164: z.string().optional(),
      })
      .parse(body);
    const ping = await this.auctions.loadPing(dto.pingId);
    if (!ping) return { error: "unknown_ping" };
    if (Number(ping.expiresAt) < Date.now()) return { error: "ping_expired" };
    if (ping.organizationId !== user.organizationId) return { error: "forbidden" };
    const dest = typeof ping.destination === "string" ? ping.destination : undefined;
    const call = await this.orchestrator.ingest({
      organizationId: user.organizationId,
      campaignId: String(ping.campaignId),
      callerE164: dto.callerE164 ?? String(ping.phone ?? "+12145559999"),
      state: ping.state as string | undefined,
      zip: ping.zip as string | undefined,
      connectedDurationSeconds: dto.connectedDurationSeconds,
      destinationScripts: dest ? { [dest]: "answer" } : undefined,
      idempotencyKey: `rtb-post-${dto.pingId}`,
    });
    return { callId: call.publicId, status: call.status, converted: call.converted };
  }
}
