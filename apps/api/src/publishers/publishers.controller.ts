import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { createPublicId } from "@zcg/shared";
import { PrismaService } from "../prisma.service.js";
import { AuthGuard, CurrentUser, type AuthPrincipal } from "../auth/auth.guard.js";

@Controller("publishers")
@UseGuards(AuthGuard)
export class PublishersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() user: AuthPrincipal) {
    const data = await this.prisma.publisher.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { company: "asc" },
      include: { _count: { select: { calls: true, campaigns: true } } },
    });
    return { data };
  }

  @Post()
  async create(@CurrentUser() user: AuthPrincipal, @Body() body: unknown) {
    const dto = z
      .object({
        company: z.string().min(1),
        contactName: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        status: z.string().optional(),
        verticals: z.array(z.string()).optional(),
        notes: z.string().optional(),
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
        status: (dto.status as never) ?? "PROSPECT",
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
      where: { organizationId: user.organizationId, OR: [{ id }, { publicId: id }] },
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
    return { publisher, kpis: { today, mtd, conversions, totals: converted } };
  }

  @Patch(":id")
  async patch(@CurrentUser() user: AuthPrincipal, @Param("id") id: string, @Body() body: unknown) {
    const dto = z
      .object({
        status: z.enum(["PROSPECT", "TESTING", "ACTIVE", "PAUSED", "SUSPENDED", "TERMINATED"]).optional(),
        notes: z.string().optional(),
        company: z.string().optional(),
      })
      .parse(body);
    const before = await this.prisma.publisher.findFirstOrThrow({
      where: { organizationId: user.organizationId, OR: [{ id }, { publicId: id }] },
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
}
