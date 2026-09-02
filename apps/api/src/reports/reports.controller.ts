import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service.js";
import { AuthGuard, CurrentUser, type AuthPrincipal } from "../auth/auth.guard.js";
import { Money, grossProfit, marginRatio, startOfUtcDay, startOfUtcMonth, isPublisherRole, isBuyerRole } from "@zcg/shared";
import { callScope, campaignScope, redactKpiPayload } from "../auth/tenant.js";

@Controller("reports")
@UseGuards(AuthGuard)
export class ReportsController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get("kpis")
  async kpis(@CurrentUser() user: AuthPrincipal, @Query("range") range = "today") {
    const now = new Date();
    let from = startOfUtcDay(now);
    if (range === "mtd") from = startOfUtcMonth(now);
    if (range === "7d") from = new Date(now.getTime() - 7 * 86400000);
    if (range === "30d") from = new Date(now.getTime() - 30 * 86400000);
    if (range === "yesterday") {
      from = startOfUtcDay(new Date(now.getTime() - 86400000));
    }

    const where = { ...callScope(user), startedAt: { gte: from } };
    const [count, converted, sums, live] = await Promise.all([
      this.prisma.call.count({ where }),
      this.prisma.call.count({ where: { ...where, converted: true } }),
      this.prisma.call.aggregate({
        where,
        _sum: { revenue: true, payout: true, telecomCost: true, profit: true, talkDurationSeconds: true },
      }),
      this.prisma.call.count({
        where: {
          ...callScope(user),
          status: { in: ["INCOMING", "IVR", "ROUTING", "RINGING", "CONNECTED", "AUCTIONING"] },
        },
      }),
    ]);
    const revenue = Money.from(String(sums._sum.revenue ?? 0));
    const payout = Money.from(String(sums._sum.payout ?? 0));
    const telecom = Money.from(String(sums._sum.telecomCost ?? 0));
    const profit = sums._sum.profit
      ? Money.from(String(sums._sum.profit))
      : grossProfit({ revenue, payout, telecom });
    const answered = await this.prisma.call.count({
      where: { ...where, answeredAt: { not: null } },
    });
    return redactKpiPayload(user, {
      range,
      from,
      calls: count,
      live,
      conversions: converted,
      conversionPct: count ? converted / count : 0,
      revenue: revenue.toFixed(4),
      payout: payout.toFixed(4),
      telecom: telecom.toFixed(4),
      profit: profit.toFixed(4),
      margin: marginRatio(profit, revenue).toFixed(6),
      avgRevenuePerCall: count ? revenue.toDecimal().div(count).toFixed(4) : "0.0000",
      avgPayoutPerCall: count ? payout.toDecimal().div(count).toFixed(4) : "0.0000",
      fillRate: count ? answered / count : 0,
      avgDurationSeconds: count ? Math.round((sums._sum.talkDurationSeconds ?? 0) / count) : 0,
    });
  }

  @Get("series")
  async series(@CurrentUser() user: AuthPrincipal) {
    const from = new Date(Date.now() - 14 * 86400000);
    const rows = await this.prisma.$queryRaw<
      { day: Date; calls: bigint; conversions: bigint; revenue: Prisma.Decimal; profit: Prisma.Decimal }[]
    >`
      SELECT date_trunc('day', "startedAt") AS day,
             COUNT(*)::bigint AS calls,
             SUM(CASE WHEN converted THEN 1 ELSE 0 END)::bigint AS conversions,
             COALESCE(SUM(revenue), 0) AS revenue,
             COALESCE(SUM(profit), 0) AS profit
      FROM "Call"
      WHERE "organizationId" = ${user.organizationId}
        AND "startedAt" >= ${from}
        ${user.publisherId ? Prisma.sql`AND "publisherId" = ${user.publisherId}` : Prisma.empty}
        ${user.buyerId ? Prisma.sql`AND "buyerId" = ${user.buyerId}` : Prisma.empty}
      GROUP BY 1
      ORDER BY 1
    `;
    return {
      data: rows.map((r) => ({
        day: r.day,
        calls: Number(r.calls),
        conversions: Number(r.conversions),
        revenue: String(r.revenue),
        profit: String(r.profit),
      })),
    };
  }

  @Get("operations")
  async operations(@CurrentUser() user: AuthPrincipal) {
    const start = startOfUtcDay(new Date());
    const campaigns = await this.prisma.campaign.findMany({
      where: { ...campaignScope(user), status: { in: ["ACTIVE", "TESTING"] } },
      include: {
        vertical: true,
        publisher: true,
        buyers: { include: { buyer: true } },
        numbers: true,
      },
    });
    const rows = [];
    for (const c of campaigns) {
      for (const link of c.buyers) {
        const delivered = await this.prisma.call.count({
          where: { campaignId: c.id, buyerId: link.buyerId, startedAt: { gte: start } },
        });
        const cap = link.dailyCap ?? link.buyer.dailyCap ?? null;
        const buyerRate = Money.from(String(link.revenueOverride ?? link.buyer.revenuePerCall));
        const pubRate = Money.from(String(link.payoutOverride ?? c.publisherPayoutAmount));
        if (isPublisherRole(user.role)) {
          rows.push({
            vertical: c.vertical.name,
            publisher: c.publisher.company,
            campaign: c.name,
            campaignId: c.publicId,
            publisherRate: pubRate.toFixed(4),
            publisherBuffer: c.publisherThresholdSeconds,
            buyer: "Destination",
            buyerRate: null,
            buyerBuffer: null,
            grossSpread: null,
            states: (link.allowedStates.length ? link.allowedStates : c.allowedStates).join(", "),
            cap,
            deliveredToday: delivered,
            remaining: cap === null ? null : Math.max(0, cap - delivered),
            did: c.numbers[0]?.e164 ?? null,
            status: c.status,
          });
          continue;
        }
        if (isBuyerRole(user.role) && user.buyerId && link.buyerId !== user.buyerId) continue;
        rows.push({
          vertical: c.vertical.name,
          publisher: isBuyerRole(user.role) ? "Publisher" : c.publisher.company,
          campaign: c.name,
          campaignId: c.publicId,
          publisherRate: isBuyerRole(user.role) ? null : pubRate.toFixed(4),
          publisherBuffer: isBuyerRole(user.role) ? null : c.publisherThresholdSeconds,
          buyer: link.buyer.company,
          buyerRate: buyerRate.toFixed(4),
          buyerBuffer: link.thresholdOverride ?? c.buyerThresholdSeconds,
          grossSpread: isBuyerRole(user.role) ? null : buyerRate.sub(pubRate).toFixed(4),
          states: (link.allowedStates.length ? link.allowedStates : c.allowedStates).join(", "),
          cap,
          deliveredToday: delivered,
          remaining: cap === null ? null : Math.max(0, cap - delivered),
          did: c.numbers[0]?.e164 ?? null,
          status: c.status,
        });
      }
    }
    return { data: rows };
  }

  @Get("profitability")
  async profitability(@CurrentUser() user: AuthPrincipal) {
    const from = startOfUtcMonth(new Date());
    const groups = await this.prisma.call.groupBy({
      by: ["publisherId", "buyerId", "campaignId"],
      where: { ...callScope(user), startedAt: { gte: from } },
      _count: { _all: true },
      _sum: { revenue: true, payout: true, telecomCost: true, profit: true },
    });
    const pubs = await this.prisma.publisher.findMany({ where: { organizationId: user.organizationId } });
    const buys = await this.prisma.buyer.findMany({ where: { organizationId: user.organizationId } });
    const cams = await this.prisma.campaign.findMany({ where: { organizationId: user.organizationId } });
    const pubMap = Object.fromEntries(pubs.map((p) => [p.id, p.company]));
    const buyMap = Object.fromEntries(buys.map((p) => [p.id, p.company]));
    const camMap = Object.fromEntries(cams.map((p) => [p.id, p.name]));
    return {
      data: groups.map((g) => {
        const revenue = Money.from(String(g._sum.revenue ?? 0));
        const payout = Money.from(String(g._sum.payout ?? 0));
        const telecom = Money.from(String(g._sum.telecomCost ?? 0));
        const profit = Money.from(String(g._sum.profit ?? 0));
        return {
          publisher: isBuyerRole(user.role) ? "Publisher" : (pubMap[g.publisherId] ?? g.publisherId),
          buyer: isPublisherRole(user.role) ? "Destination" : g.buyerId ? buyMap[g.buyerId] : "(none)",
          campaign: camMap[g.campaignId] ?? g.campaignId,
          calls: g._count._all,
          publisherCost: isBuyerRole(user.role) ? null : payout.toFixed(4),
          buyerRevenue: isPublisherRole(user.role) ? null : revenue.toFixed(4),
          carrierCost: isPublisherRole(user.role) || isBuyerRole(user.role) ? null : telecom.toFixed(4),
          grossProfit: isPublisherRole(user.role) || isBuyerRole(user.role) ? null : profit.toFixed(4),
          grossMargin: isPublisherRole(user.role) || isBuyerRole(user.role) ? null : marginRatio(profit, revenue).toFixed(6),
          negative: isPublisherRole(user.role) || isBuyerRole(user.role) ? false : profit.isNegative(),
        };
      }),
    };
  }
}
