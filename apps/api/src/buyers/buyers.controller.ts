import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { createPublicId } from "@zcg/shared";
import { PrismaService } from "../prisma.service.js";
import { AuthGuard, CurrentUser, type AuthPrincipal } from "../auth/auth.guard.js";

@Controller("buyers")
@UseGuards(AuthGuard)
export class BuyersController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() user: AuthPrincipal) {
    const data = await this.prisma.buyer.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { company: "asc" },
      include: { destinations: true, _count: { select: { calls: true } } },
    });
    return { data };
  }

  @Post()
  async create(@CurrentUser() user: AuthPrincipal, @Body() body: unknown) {
    const dto = z
      .object({
        company: z.string().min(1),
        states: z.array(z.string()).optional(),
        revenuePerCall: z.string().optional(),
        conversionThresholdSeconds: z.number().optional(),
        dailyCap: z.number().optional(),
        did: z.string().optional(),
        vertical: z.string().optional(),
      })
      .parse(body);
    const buyer = await this.prisma.buyer.create({
      data: {
        publicId: createPublicId("buy"),
        organizationId: user.organizationId,
        company: dto.company,
        states: dto.states ?? [],
        revenuePerCall: dto.revenuePerCall ?? "0",
        conversionThresholdSeconds: dto.conversionThresholdSeconds ?? 90,
        dailyCap: dto.dailyCap,
        vertical: dto.vertical,
        status: "TESTING",
      },
    });
    if (dto.did) {
      await this.prisma.buyerDestination.create({
        data: {
          publicId: createPublicId("dst"),
          buyerId: buyer.id,
          label: "Primary",
          did: dto.did,
        },
      });
    }
    await this.prisma.auditLog.create({
      data: {
        organizationId: user.organizationId,
        userId: user.userId,
        action: "buyer.create",
        entity: "Buyer",
        entityId: buyer.id,
        after: buyer as object,
      },
    });
    return buyer;
  }

  @Get(":id")
  async one(@CurrentUser() user: AuthPrincipal, @Param("id") id: string) {
    const buyer = await this.prisma.buyer.findFirst({
      where: { organizationId: user.organizationId, OR: [{ id }, { publicId: id }] },
      include: { destinations: true, campaignLinks: { include: { campaign: true } } },
    });
    if (!buyer) return { error: "not_found" };
    const month = new Date();
    month.setUTCDate(1);
    month.setUTCHours(0, 0, 0, 0);
    const stats = await this.prisma.call.aggregate({
      where: { buyerId: buyer.id, startedAt: { gte: month } },
      _count: { _all: true },
      _sum: { revenue: true, talkDurationSeconds: true },
    });
    const conversions = await this.prisma.call.count({
      where: { buyerId: buyer.id, startedAt: { gte: month }, converted: true },
    });
    return { buyer, kpis: { ...stats, conversions } };
  }

  @Patch(":id")
  async patch(@CurrentUser() user: AuthPrincipal, @Param("id") id: string, @Body() body: unknown) {
    const dto = z
      .object({
        status: z.enum(["PROSPECT", "TESTING", "ACTIVE", "PAUSED", "SUSPENDED", "TERMINATED"]).optional(),
        dailyCap: z.number().nullable().optional(),
        notes: z.string().optional(),
      })
      .parse(body);
    const before = await this.prisma.buyer.findFirstOrThrow({
      where: { organizationId: user.organizationId, OR: [{ id }, { publicId: id }] },
    });
    const after = await this.prisma.buyer.update({ where: { id: before.id }, data: dto });
    await this.prisma.auditLog.create({
      data: {
        organizationId: user.organizationId,
        userId: user.userId,
        action: "buyer.update",
        entity: "Buyer",
        entityId: before.id,
        before: before as object,
        after: after as object,
      },
    });
    return after;
  }
}
