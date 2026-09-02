import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { createPublicId, Permission } from "@zcg/shared";
import { PrismaService } from "../prisma.service.js";
import { AuthGuard, CurrentUser, assertPerm, type AuthPrincipal } from "../auth/auth.guard.js";
import { buyerScope, campaignScope, publisherScope, redactList, redactRecord } from "../auth/tenant.js";

@Controller("campaigns")
@UseGuards(AuthGuard)
export class CampaignsController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() user: AuthPrincipal, @Query("includeArchived") includeArchived?: string) {
    const data = await this.prisma.campaign.findMany({
      where: {
        ...campaignScope(user),
        status: includeArchived === "true" ? undefined : { not: "ARCHIVED" },
      },
      orderBy: { name: "asc" },
      include: {
        vertical: true,
        publisher: true,
        buyers: { include: { buyer: true } },
        numbers: true,
        _count: { select: { calls: true } },
      },
    });
    return { data: redactList(user, data as unknown as Record<string, unknown>[]) };
  }

  @Post()
  async create(@CurrentUser() user: AuthPrincipal, @Body() body: unknown) {
    assertPerm(user, Permission.CAMPAIGNS_WRITE);
    const dto = z
      .object({
        name: z.string().min(1),
        verticalId: z.string(),
        publisherId: z.string(),
        routingStrategy: z.string().optional(),
        buyerRevenueAmount: z.string().optional(),
        publisherPayoutAmount: z.string().optional(),
        buyerThresholdSeconds: z.coerce.number().optional(),
        publisherThresholdSeconds: z.coerce.number().optional(),
        allowedStates: z.array(z.string()).optional(),
        buyerIds: z.array(z.string()).optional(),
        dialMode: z.enum(["WATERFALL", "SIMULTANEOUS"]).optional(),
        recordingEnabled: z.boolean().optional(),
        recordingDisclosure: z.string().optional(),
        dailyCap: z.coerce.number().optional(),
        status: z.enum(["DRAFT", "TESTING", "ACTIVE", "PAUSED"]).optional(),
      })
      .parse(body);
    const publisher = await this.prisma.publisher.findFirstOrThrow({
      where: { ...publisherScope(user), OR: [{ id: dto.publisherId }, { publicId: dto.publisherId }] },
    });
    const vertical = await this.prisma.vertical.findFirstOrThrow({
      where: {
        organizationId: user.organizationId,
        OR: [{ id: dto.verticalId }, { slug: dto.verticalId }],
      },
    });
    const cam = await this.prisma.campaign.create({
      data: {
        publicId: createPublicId("cam"),
        organizationId: user.organizationId,
        name: dto.name,
        verticalId: vertical.id,
        publisherId: publisher.id,
        routingStrategy: (dto.routingStrategy as never) ?? "HIGHEST_REVENUE",
        buyerRevenueAmount: dto.buyerRevenueAmount ?? "0",
        publisherPayoutAmount: dto.publisherPayoutAmount ?? "0",
        buyerThresholdSeconds: dto.buyerThresholdSeconds ?? 90,
        publisherThresholdSeconds: dto.publisherThresholdSeconds ?? 90,
        allowedStates: dto.allowedStates ?? [],
        dialMode: dto.dialMode ?? "WATERFALL",
        recordingEnabled: dto.recordingEnabled ?? false,
        recordingDisclosure: dto.recordingDisclosure,
        dailyCap: dto.dailyCap,
        status: dto.status ?? "DRAFT",
      },
    });
    if (dto.buyerIds) {
      for (const [i, buyerId] of dto.buyerIds.entries()) {
        const buyer = await this.prisma.buyer.findFirstOrThrow({
          where: { ...buyerScope(user), OR: [{ id: buyerId }, { publicId: buyerId }] },
        });
        await this.prisma.campaignBuyer.create({
          data: { campaignId: cam.id, buyerId: buyer.id, priority: i + 1 },
        });
      }
    }
    return cam;
  }

  @Get(":id")
  async one(@CurrentUser() user: AuthPrincipal, @Param("id") id: string) {
    const cam = await this.prisma.campaign.findFirst({
      where: { ...campaignScope(user), OR: [{ id }, { publicId: id }] },
      include: {
        vertical: true,
        publisher: true,
        buyers: { include: { buyer: { include: { destinations: true } } } },
        numbers: true,
        schedules: true,
        capPolicies: true,
      },
    });
    if (!cam) return { error: "not_found" };
    return redactRecord(user, cam as unknown as Record<string, unknown>);
  }

  @Post(":id/duplicate")
  async duplicate(@CurrentUser() user: AuthPrincipal, @Param("id") id: string) {
    assertPerm(user, Permission.CAMPAIGNS_WRITE);
    const src = await this.prisma.campaign.findFirstOrThrow({
      where: { ...campaignScope(user), OR: [{ id }, { publicId: id }] },
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
    assertPerm(user, Permission.CAMPAIGNS_WRITE);
    const dto = z
      .object({
        status: z.enum(["DRAFT", "TESTING", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]).optional(),
        name: z.string().optional(),
        routingStrategy: z.string().optional(),
        dialMode: z.enum(["WATERFALL", "SIMULTANEOUS"]).optional(),
        recordingEnabled: z.boolean().optional(),
        recordingDisclosure: z.string().nullable().optional(),
        dailyCap: z.number().nullable().optional(),
        buyerThresholdSeconds: z.number().optional(),
        publisherThresholdSeconds: z.number().optional(),
        ivrDefinitionId: z.string().nullable().optional(),
      })
      .parse(body);
    const before = await this.prisma.campaign.findFirstOrThrow({
      where: { ...campaignScope(user), OR: [{ id }, { publicId: id }] },
    });
    const after = await this.prisma.campaign.update({ where: { id: before.id }, data: dto as never });
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

  @Delete(":id")
  async remove(@CurrentUser() user: AuthPrincipal, @Param("id") id: string) {
    assertPerm(user, Permission.CAMPAIGNS_WRITE);
    const row = await this.prisma.campaign.findFirstOrThrow({
      where: { ...campaignScope(user), OR: [{ id }, { publicId: id }] },
    });
    const calls = await this.prisma.call.count({ where: { campaignId: row.id } });
    if (calls === 0) {
      await this.prisma.campaignBuyer.deleteMany({ where: { campaignId: row.id } });
      await this.prisma.pricingRule.deleteMany({ where: { campaignId: row.id } });
      await this.prisma.schedule.deleteMany({ where: { campaignId: row.id } });
      await this.prisma.capPolicy.deleteMany({ where: { campaignId: row.id } });
      await this.prisma.trackingNumber.updateMany({
        where: { campaignId: row.id },
        data: { campaignId: null, status: "RESERVED" },
      });
      await this.prisma.lead.updateMany({ where: { campaignId: row.id }, data: { campaignId: null } });
      await this.prisma.campaign.delete({ where: { id: row.id } });
      return { ok: true, mode: "deleted" as const };
    }
    await this.prisma.campaign.update({ where: { id: row.id }, data: { status: "ARCHIVED" } });
    return { ok: true, mode: "archived" as const, retainedCalls: calls };
  }
}
