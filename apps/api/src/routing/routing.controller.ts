import { Body, Controller, Inject, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { Money } from "@zcg/shared";
import { route, type DestinationSnapshot } from "@zcg/routing-engine";
import { PrismaService } from "../prisma.service.js";
import { AuthGuard, CurrentUser, type AuthPrincipal } from "../auth/auth.guard.js";
import type { RoutingStrategy } from "@zcg/shared";

@Controller("routing")
@UseGuards(AuthGuard)
export class RoutingController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Post("simulate")
  async simulate(@CurrentUser() user: AuthPrincipal, @Body() body: unknown) {
    const dto = z
      .object({
        campaignId: z.string(),
        state: z.string().optional(),
        zip: z.string().optional(),
        callerE164: z.string().optional(),
        now: z.string().datetime().optional(),
      })
      .parse(body);
    const campaign = await this.prisma.campaign.findFirstOrThrow({
      where: {
        organizationId: user.organizationId,
        OR: [{ id: dto.campaignId }, { publicId: dto.campaignId }],
      },
      include: { buyers: { include: { buyer: { include: { destinations: true } } } } },
    });
    const destinations: DestinationSnapshot[] = [];
    for (const link of campaign.buyers) {
      const dest = link.buyer.destinations[0];
      if (!dest) continue;
      const revenue = Money.from(String(link.revenueOverride ?? link.buyer.revenuePerCall));
      const payout = Money.from(String(link.payoutOverride ?? campaign.publisherPayoutAmount));
      destinations.push({
        id: dest.id,
        buyerId: link.buyerId,
        buyerName: link.buyer.company,
        destinationId: dest.id,
        destinationLabel: dest.label,
        did: dest.did ?? undefined,
        sipUri: dest.sipUri ?? undefined,
        active: link.active && dest.active && link.buyer.status === "ACTIVE",
        verticalId: campaign.verticalId,
        allowedStates: link.allowedStates.length ? link.allowedStates : link.buyer.states,
        allowedZips: [],
        allowedAreaCodes: [],
        allowedPublisherIds: [],
        allowedCampaignIds: [],
        allowedTrafficSourceIds: [],
        hours: null,
        caps: {
          concurrent: 0,
          concurrentLimit: link.buyer.concurrentCap,
          hourly: 0,
          hourlyLimit: link.buyer.hourlyCap,
          daily: 0,
          dailyLimit: link.dailyCap ?? link.buyer.dailyCap,
          weekly: 0,
          weeklyLimit: link.buyer.weeklyCap,
          monthly: 0,
          monthlyLimit: link.buyer.monthlyCap,
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
        utilization: 0,
        minBid: null,
        maxBid: null,
        ivrPredicates: {},
      });
    }
    const result = route({
      now: dto.now ? new Date(dto.now) : new Date(),
      call: {
        id: "sim_" + Date.now(),
        callerE164: dto.callerE164 ?? "+12145550100",
        state: dto.state,
        zip: dto.zip,
        attributes: {},
        ivr: {},
        publisherId: campaign.publisherId,
        campaignId: campaign.id,
        isDuplicate: false,
        duplicateAction: campaign.duplicateAction,
        isSuppressed: false,
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
    });
    return {
      strategy: result.strategy,
      explanation: result.explanation,
      selected: result.selected
        ? {
            buyer: result.selected.destination.buyerName,
            revenue: result.selected.destination.revenue.toFixed(4),
            payout: result.selected.destination.payout.toFixed(4),
            expectedProfit: result.selected.expectedGrossProfit.toFixed(4),
          }
        : null,
      eligible: result.eligible.map((e) => ({
        buyer: e.destination.buyerName,
        revenue: e.destination.revenue.toFixed(4),
        rank: e.rank,
      })),
      rejected: result.rejected.map((r) => ({
        buyer: r.destination.buyerName,
        reasons: r.reasons,
      })),
      traces: result.traces,
    };
  }
}
