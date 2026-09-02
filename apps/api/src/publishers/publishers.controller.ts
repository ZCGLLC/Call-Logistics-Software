import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { createPublicId } from "@zcg/shared";
import { PrismaService } from "../prisma.service.js";
import { AuthGuard, CurrentUser, type AuthPrincipal } from "../auth/auth.guard.js";
import { publisherScope, redactList, redactRecord } from "../auth/tenant.js";
import { Permission } from "@zcg/shared";
import { assertPerm } from "../auth/auth.guard.js";

@Controller("publishers")
@UseGuards(AuthGuard)
export class PublishersController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() user: AuthPrincipal, @Query("includeRemoved") includeRemoved?: string) {
    if (user.buyerId) return { data: [] };
    const data = await this.prisma.publisher.findMany({
      where: {
        ...publisherScope(user),
        status: includeRemoved === "true" ? undefined : { not: "TERMINATED" },
      },
      orderBy: { company: "asc" },
      include: { _count: { select: { calls: true, campaigns: true } } },
    });
    return { data: redactList(user, data as unknown as Record<string, unknown>[]) };
  }

  @Post()
  async create(@CurrentUser() user: AuthPrincipal, @Body() body: unknown) {
    assertPerm(user, Permission.PUBLISHERS_WRITE);
    const dto = z
      .object({
        company: z.string().min(1),
        contactName: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        status: z.string().optional(),
        verticals: z.array(z.string()).optional(),
        notes: z.string().optional(),
        paymentTerms: z.enum(["PREPAID", "NET_7", "NET_14", "NET_15", "NET_30", "CUSTOM"]).optional(),
      })
      .parse(body);
    const row = await this.prisma.publisher.create({
      data: {
        publicId: createPublicId("pub"),
        organizationId: user.organizationId,
        company: dto.company,
        contactName: dto.contactName,
        email: dto.email,
        phone: dto.phone,
        verticals: dto.verticals ?? [],
        notes: dto.notes,
        paymentTerms: dto.paymentTerms ?? "NET_15",
        status: (dto.status as never) ?? "ACTIVE",
      },
    });
    await this.prisma.auditLog.create({
      data: {
        organizationId: user.organizationId,
        userId: user.userId,
        action: "publisher.create",
        entity: "Publisher",
        entityId: row.id,
        after: row as object,
      },
    });
    return row;
  }

  @Get(":id")
  async one(@CurrentUser() user: AuthPrincipal, @Param("id") id: string) {
    const publisher = await this.prisma.publisher.findFirst({
      where: { ...publisherScope(user), OR: [{ id }, { publicId: id }] },
      include: { campaigns: true, numbers: true },
    });
    if (!publisher) return { error: "not_found" };
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const month = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    const [today, mtd, converted] = await Promise.all([
      this.prisma.call.count({ where: { publisherId: publisher.id, startedAt: { gte: start } } }),
      this.prisma.call.count({ where: { publisherId: publisher.id, startedAt: { gte: month } } }),
      this.prisma.call.aggregate({
        where: { publisherId: publisher.id, startedAt: { gte: month } },
        _sum: { revenue: true, payout: true, profit: true, talkDurationSeconds: true },
        _count: { _all: true },
      }),
    ]);
    const conversions = await this.prisma.call.count({
      where: { publisherId: publisher.id, startedAt: { gte: month }, converted: true },
    });
    return redactRecord(user, { publisher, kpis: { today, mtd, conversions, totals: converted } } as unknown as Record<string, unknown>);
  }

  @Patch(":id")
  async patch(@CurrentUser() user: AuthPrincipal, @Param("id") id: string, @Body() body: unknown) {
    assertPerm(user, Permission.PUBLISHERS_WRITE);
    const dto = z
      .object({
        status: z.enum(["PROSPECT", "TESTING", "ACTIVE", "PAUSED", "SUSPENDED", "TERMINATED"]).optional(),
        notes: z.string().optional(),
        company: z.string().optional(),
      })
      .parse(body);
    const before = await this.prisma.publisher.findFirstOrThrow({
      where: { ...publisherScope(user), OR: [{ id }, { publicId: id }] },
    });
    const after = await this.prisma.publisher.update({ where: { id: before.id }, data: dto });
    await this.prisma.auditLog.create({
      data: {
        organizationId: user.organizationId,
        userId: user.userId,
        action: "publisher.update",
        entity: "Publisher",
        entityId: before.id,
        before: before as object,
        after: after as object,
      },
    });
    return after;
  }

  @Delete(":id")
  async remove(@CurrentUser() user: AuthPrincipal, @Param("id") id: string) {
    assertPerm(user, Permission.PUBLISHERS_WRITE);
    const row = await this.prisma.publisher.findFirstOrThrow({
      where: { ...publisherScope(user), OR: [{ id }, { publicId: id }] },
    });
    const [calls, campaigns] = await Promise.all([
      this.prisma.call.count({ where: { publisherId: row.id } }),
      this.prisma.campaign.count({ where: { publisherId: row.id } }),
    ]);
    if (calls === 0 && campaigns === 0) {
      await this.prisma.trackingNumber.updateMany({
        where: { publisherId: row.id },
        data: { publisherId: null, campaignId: null, status: "AVAILABLE" },
      });
      await this.prisma.lead.updateMany({ where: { publisherId: row.id }, data: { publisherId: null } });
      await this.prisma.statement.deleteMany({ where: { publisherId: row.id } });
      await this.prisma.publisher.delete({ where: { id: row.id } });
      await this.prisma.auditLog.create({
        data: {
          organizationId: user.organizationId,
          userId: user.authType === "jwt" ? user.userId : null,
          action: "publisher.delete",
          entity: "Publisher",
          entityId: row.id,
          before: { company: row.company },
        },
      });
      return { ok: true, mode: "deleted" as const };
    }
    await this.prisma.campaign.updateMany({
      where: { publisherId: row.id, status: { in: ["ACTIVE", "TESTING", "DRAFT"] } },
      data: { status: "PAUSED" },
    });
    await this.prisma.publisher.update({ where: { id: row.id }, data: { status: "TERMINATED" } });
    await this.prisma.auditLog.create({
      data: {
        organizationId: user.organizationId,
        userId: user.authType === "jwt" ? user.userId : null,
        action: "publisher.terminate",
        entity: "Publisher",
        entityId: row.id,
        after: { status: "TERMINATED" },
      },
    });
    return { ok: true, mode: "terminated" as const, retainedCalls: calls, retainedCampaigns: campaigns };
  }
}
