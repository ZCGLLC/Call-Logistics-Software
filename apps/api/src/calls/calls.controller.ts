import { Controller, Get, Inject, Param, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { PrismaService } from "../prisma.service.js";
import { AuthGuard, CurrentUser, type AuthPrincipal } from "../auth/auth.guard.js";
import { CallOrchestrator } from "./call-orchestrator.service.js";
import { maskE164 } from "@zcg/shared";

@Controller("calls")
@UseGuards(AuthGuard)
export class CallsController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CallOrchestrator) private readonly orchestrator: CallOrchestrator,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: AuthPrincipal,
    @Query("q") q?: string,
    @Query("publisherId") publisherId?: string,
    @Query("buyerId") buyerId?: string,
    @Query("campaignId") campaignId?: string,
    @Query("state") state?: string,
    @Query("converted") converted?: string,
    @Query("status") status?: string,
    @Query("limit") limit = "50",
  ) {
    const take = Math.min(200, Number(limit) || 50);
    const calls = await this.prisma.call.findMany({
      where: {
        organizationId: user.organizationId,
        publisherId: publisherId || undefined,
        buyerId: buyerId || undefined,
        campaignId: campaignId || undefined,
        callerState: state || undefined,
        status: status as never,
        converted: converted === "true" ? true : converted === "false" ? false : undefined,
        OR: q
          ? [
              { publicId: { contains: q } },
              { callerE164: { contains: q } },
            ]
          : undefined,
      },
      orderBy: { startedAt: "desc" },
      take,
      include: {
        campaign: { include: { vertical: true } },
        publisher: true,
        buyer: true,
      },
    });
    return {
      data: calls.map((c) => ({
        ...c,
        callerE164: user.pii ? c.callerE164 : maskE164(c.callerE164),
      })),
    };
  }

  @Get("export.csv")
  async exportCsv(@CurrentUser() user: AuthPrincipal, @Res() res: Response) {
    const calls = await this.prisma.call.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { startedAt: "desc" },
      take: 5000,
      include: { campaign: true, publisher: true, buyer: true },
    });
    const header = [
      "call_id",
      "started_at",
      "publisher",
      "campaign",
      "buyer",
      "state",
      "status",
      "talk_seconds",
      "converted",
      "revenue",
      "payout",
      "telecom",
      "profit",
    ];
    const rows = calls.map((c) =>
      [
        c.publicId,
        c.startedAt.toISOString(),
        c.publisher.company,
        c.campaign.name,
        c.buyer?.company ?? "",
        c.callerState ?? "",
        c.status,
        c.talkDurationSeconds,
        c.converted,
        c.revenue,
        c.payout,
        c.telecomCost,
        c.profit,
      ].join(","),
    );
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=calls.csv");
    res.send([header.join(","), ...rows].join("\n"));
  }

  @Get(":id")
  async one(@CurrentUser() user: AuthPrincipal, @Param("id") id: string) {
    const call = await this.prisma.call.findFirst({
      where: {
        organizationId: user.organizationId,
        OR: [{ id }, { publicId: id }],
      },
    });
    if (!call) return { error: "not_found" };
    const full = await this.orchestrator.inspector(call.id);
    return {
      ...full,
      callerE164: user.pii ? full.callerE164 : maskE164(full.callerE164),
    };
  }
}
