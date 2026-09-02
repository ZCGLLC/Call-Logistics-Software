import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { createPublicId, Permission } from "@zcg/shared";
import { PrismaService } from "../prisma.service.js";
import { AuthGuard, CurrentUser, assertPerm, type AuthPrincipal } from "../auth/auth.guard.js";
import { buyerScope, redactList, redactRecord } from "../auth/tenant.js";

@Controller("buyers")
@UseGuards(AuthGuard)
export class BuyersController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() user: AuthPrincipal, @Query("includeRemoved") includeRemoved?: string) {
    if (user.publisherId) return { data: [] };
    const data = await this.prisma.buyer.findMany({
      where: {
        ...buyerScope(user),
        status: includeRemoved === "true" ? undefined : { not: "TERMINATED" },
      },
      orderBy: { company: "asc" },
      include: { destinations: true, _count: { select: { calls: true } } },
    });
    return { data: redactList(user, data as unknown as Record<string, unknown>[]) };
  }

  @Post()
  async create(@CurrentUser() user: AuthPrincipal, @Body() body: unknown) {
    assertPerm(user, Permission.BUYERS_WRITE);
    const dto = z
      .object({
        company: z.string().min(1),
        states: z.array(z.string()).optional(),
        revenuePerCall: z.string().optional(),
        conversionThresholdSeconds: z.coerce.number().optional(),
        dailyCap: z.coerce.number().optional(),
        did: z.string().optional(),
        vertical: z.string().optional(),
        contactName: z.string().optional(),
        email: z.string().email().optional(),
        status: z.enum(["PROSPECT", "TESTING", "ACTIVE", "PAUSED", "SUSPENDED", "TERMINATED"]).optional(),
      })
      .parse(body);
    const buyer = await this.prisma.buyer.create({
      data: {
        publicId: createPublicId("buy"),
        organizationId: user.organizationId,
        company: dto.company,
        contactName: dto.contactName,
        email: dto.email,
        states: dto.states ?? [],
        revenuePerCall: dto.revenuePerCall ?? "0",
        conversionThresholdSeconds: dto.conversionThresholdSeconds ?? 90,
        dailyCap: dto.dailyCap,
        vertical: dto.vertical,
        status: dto.status ?? "ACTIVE",
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
      where: { ...buyerScope(user), OR: [{ id }, { publicId: id }] },
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
    return redactRecord(user, { buyer, kpis: { ...stats, conversions } } as unknown as Record<string, unknown>);
  }

  @Patch(":id")
  async patch(@CurrentUser() user: AuthPrincipal, @Param("id") id: string, @Body() body: unknown) {
    assertPerm(user, Permission.BUYERS_WRITE);
    const dto = z
      .object({
        status: z.enum(["PROSPECT", "TESTING", "ACTIVE", "PAUSED", "SUSPENDED", "TERMINATED"]).optional(),
        dailyCap: z.number().nullable().optional(),
        notes: z.string().optional(),
        pingEndpoint: z.string().url().nullable().optional(),
        timeoutMs: z.number().optional(),
      })
      .parse(body);
    const before = await this.prisma.buyer.findFirstOrThrow({
      where: { ...buyerScope(user), OR: [{ id }, { publicId: id }] },
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

  @Delete(":id")
  async remove(@CurrentUser() user: AuthPrincipal, @Param("id") id: string) {
    assertPerm(user, Permission.BUYERS_WRITE);
    const row = await this.prisma.buyer.findFirstOrThrow({
      where: { ...buyerScope(user), OR: [{ id }, { publicId: id }] },
    });
    const calls = await this.prisma.call.count({ where: { buyerId: row.id } });
    if (calls === 0) {
      await this.prisma.campaignBuyer.deleteMany({ where: { buyerId: row.id } });
      const dests = await this.prisma.buyerDestination.findMany({
        where: { buyerId: row.id },
        select: { id: true },
      });
      await this.prisma.routingAttempt.updateMany({
        where: { destinationId: { in: dests.map((d) => d.id) } },
        data: { destinationId: null },
      });
      await this.prisma.buyerDestination.deleteMany({ where: { buyerId: row.id } });
      await this.prisma.bid.deleteMany({ where: { buyerId: row.id } });
      const invoices = await this.prisma.invoice.findMany({ where: { buyerId: row.id }, select: { id: true } });
      await this.prisma.invoiceLine.deleteMany({ where: { invoiceId: { in: invoices.map((i) => i.id) } } });
      await this.prisma.invoice.deleteMany({ where: { buyerId: row.id } });
      await this.prisma.buyer.delete({ where: { id: row.id } });
      await this.prisma.auditLog.create({
        data: {
          organizationId: user.organizationId,
          userId: user.authType === "jwt" ? user.userId : null,
          action: "buyer.delete",
          entity: "Buyer",
          entityId: row.id,
          before: { company: row.company },
        },
      });
      return { ok: true, mode: "deleted" as const };
    }
    await this.prisma.campaignBuyer.updateMany({ where: { buyerId: row.id }, data: { active: false } });
    await this.prisma.buyer.update({ where: { id: row.id }, data: { status: "TERMINATED" } });
    return { ok: true, mode: "terminated" as const, retainedCalls: calls };
  }
}
