import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { createPublicId } from "@zcg/shared";
import { PrismaService } from "../prisma.service.js";
import { AuthGuard, CurrentUser, type AuthPrincipal } from "../auth/auth.guard.js";

@Controller("campaigns")
@UseGuards(AuthGuard)
export class CampaignsController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() user: AuthPrincipal) {
    const data = await this.prisma.campaign.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { name: "asc" },
      include: {
        vertical: true,
        publisher: true,
        buyers: { include: { buyer: true } },
        numbers: true,
        _count: { select: { calls: true } },
      },
    });
    return { data };
  }

  @Post()
  async create(@CurrentUser() user: AuthPrincipal, @Body() body: unknown) {
    const dto = z
      .object({
        name: z.string().min(1),
        verticalId: z.string(),
        publisherId: z.string(),
        routingStrategy: z.string().optional(),
        buyerRevenueAmount: z.string().optional(),
        publisherPayoutAmount: z.string().optional(),
        buyerThresholdSeconds: z.number().optional(),
        publisherThresholdSeconds: z.number().optional(),
        allowedStates: z.array(z.string()).optional(),
        buyerIds: z.array(z.string()).optional(),
      })
      .parse(body);
    const cam = await this.prisma.campaign.create({
      data: {
        publicId: createPublicId("cam"),
        organizationId: user.organizationId,
        name: dto.name,
        verticalId: dto.verticalId,
        publisherId: dto.publisherId,
        routingStrategy: (dto.routingStrategy as never) ?? "HIGHEST_REVENUE",
        buyerRevenueAmount: dto.buyerRevenueAmount ?? "0",
        publisherPayoutAmount: dto.publisherPayoutAmount ?? "0",
        buyerThresholdSeconds: dto.buyerThresholdSeconds ?? 90,
        publisherThresholdSeconds: dto.publisherThresholdSeconds ?? 90,
        allowedStates: dto.allowedStates ?? [],
        status: "DRAFT",
      },
    });
    if (dto.buyerIds) {
      for (const [i, buyerId] of dto.buyerIds.entries()) {
        await this.prisma.campaignBuyer.create({
          data: { campaignId: cam.id, buyerId, priority: i + 1 },
        });
      }
    }
    return cam;
  }

  @Get(":id")
  async one(@CurrentUser() user: AuthPrincipal, @Param("id") id: string) {
    return this.prisma.campaign.findFirst({
      where: { organizationId: user.organizationId, OR: [{ id }, { publicId: id }] },
      include: {
        vertical: true,
        publisher: true,
        buyers: { include: { buyer: { include: { destinations: true } } } },
        numbers: true,
      },
    });
  }

  @Post(":id/duplicate")
  async duplicate(@CurrentUser() user: AuthPrincipal, @Param("id") id: string) {
    const src = await this.prisma.campaign.findFirstOrThrow({
      where: { organizationId: user.organizationId, OR: [{ id }, { publicId: id }] },
      include: { buyers: true },
    });
    const copy = await this.prisma.campaign.create({
      data: {
        publicId: createPublicId("cam"),
        organizationId: src.organizationId,
        name: `${src.name} (copy)`,
        verticalId: src.verticalId,
        publisherId: src.publisherId,
        routingStrategy: src.routingStrategy,
        buyerRevenueAmount: src.buyerRevenueAmount,
        publisherPayoutAmount: src.publisherPayoutAmount,
        buyerThresholdSeconds: src.buyerThresholdSeconds,
        publisherThresholdSeconds: src.publisherThresholdSeconds,
        estimatedTelecomCost: src.estimatedTelecomCost,
        allowedStates: src.allowedStates,
        timezone: src.timezone,
        status: "DRAFT",
      },
    });
    for (const b of src.buyers) {
      await this.prisma.campaignBuyer.create({
        data: {
          campaignId: copy.id,
          buyerId: b.buyerId,
          priority: b.priority,
          weight: b.weight,
          revenueOverride: b.revenueOverride,
          payoutOverride: b.payoutOverride,
          allowedStates: b.allowedStates,
        },
      });
    }
    return copy;
  }

  @Patch(":id")
  async patch(@CurrentUser() user: AuthPrincipal, @Param("id") id: string, @Body() body: unknown) {
    const dto = z
      .object({
        status: z.enum(["DRAFT", "TESTING", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]).optional(),
        name: z.string().optional(),
      })
      .parse(body);
    const before = await this.prisma.campaign.findFirstOrThrow({
      where: { organizationId: user.organizationId, OR: [{ id }, { publicId: id }] },
    });
    const after = await this.prisma.campaign.update({ where: { id: before.id }, data: dto });
    await this.prisma.auditLog.create({
      data: {
        organizationId: user.organizationId,
        userId: user.userId,
        action: "campaign.update",
        entity: "Campaign",
        entityId: before.id,
        before: { status: before.status },
        after: { status: after.status },
      },
    });
    return after;
  }
}
