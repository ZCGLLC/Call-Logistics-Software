import { Body, Controller, Get, Inject, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { Permission, createPublicId } from "@zcg/shared";
import { findOpportunities, partnerHealthScore } from "@zcg/analytics";
import { PrismaService } from "../prisma.service.js";
import { AuthGuard, CurrentUser, assertPerm, type AuthPrincipal } from "../auth/auth.guard.js";
import { CapsService } from "../caps/caps.service.js";
import { startOfUtcDay, startOfUtcMonth } from "@zcg/shared";

@Controller("ops")
@UseGuards(AuthGuard)
export class OpsController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CapsService) private readonly caps: CapsService,
  ) {}

  @Get("health")
  async health(@CurrentUser() user: AuthPrincipal) {
    const redis = await this.caps.ping();
    const lastCall = await this.prisma.call.findFirst({
      where: { organizationId: user.organizationId },
      orderBy: { startedAt: "desc" },
      select: { publicId: true, startedAt: true, status: true },
    });
    const pendingWebhooks = await this.prisma.webhookDelivery.count({
      where: { status: { in: ["PENDING", "FAILED"] }, endpoint: { organizationId: user.organizationId } },
    });
    const dlq = await this.prisma.webhookDelivery.count({
      where: { status: "DLQ", endpoint: { organizationId: user.organizationId } },
    });
    return {
      api: "up",
      database: "up",
      redis,
      telephony: process.env.TELEPHONY_PROVIDER ?? "fake",
      lastCall,
      webhooks: { pending: pendingWebhooks, dlq },
    };
  }

  @Get("health-scores")
  async healthScores(@CurrentUser() user: AuthPrincipal) {
    const from = startOfUtcMonth(new Date());
    const buyers = await this.prisma.buyer.findMany({
      where: { organizationId: user.organizationId, ...(user.buyerId ? { id: user.buyerId } : {}) },
    });
    const data = [];
    for (const b of buyers) {
      const [calls, answered, conversions] = await Promise.all([
        this.prisma.call.count({ where: { buyerId: b.id, startedAt: { gte: from } } }),
        this.prisma.call.count({ where: { buyerId: b.id, startedAt: { gte: from }, answeredAt: { not: null } } }),
        this.prisma.call.count({ where: { buyerId: b.id, startedAt: { gte: from }, converted: true } }),
      ]);
      const delivered = await this.caps.hydrateDailyBuyer(user.organizationId, b.id);
      data.push({
        buyerId: b.publicId,
        company: b.company,
        ...partnerHealthScore({
          calls,
          answered,
          conversions,
          capLimit: b.dailyCap,
          delivered,
        }),
      });
    }
    return { data };
  }

  @Get("opportunities")
  async opportunities(@CurrentUser() user: AuthPrincipal) {
    const start = startOfUtcDay(new Date());
    const month = startOfUtcMonth(new Date());
    const links = await this.prisma.campaignBuyer.findMany({
      where: { campaign: { organizationId: user.organizationId, status: "ACTIVE" } },
      include: { campaign: true, buyer: true },
    });
    const rows = [];
    for (const link of links) {
      const delivered = await this.prisma.call.count({
        where: { campaignId: link.campaignId, buyerId: link.buyerId, startedAt: { gte: start } },
      });
      const monthCalls = await this.prisma.call.findMany({
        where: { campaignId: link.campaignId, buyerId: link.buyerId, startedAt: { gte: month } },
        select: { answeredAt: true, profit: true },
      });
      const answered = monthCalls.filter((c) => c.answeredAt).length;
      const profit = monthCalls.reduce((s, c) => s + Number(c.profit), 0);
      rows.push({
        campaign: link.campaign.name,
        buyer: link.buyer.company,
        cap: link.dailyCap ?? link.buyer.dailyCap,
        delivered,
        fillRate: monthCalls.length ? answered / monthCalls.length : 0,
        profit,
      });
    }
    return { data: findOpportunities(rows) };
  }

  @Get("tags")
  async tags(@CurrentUser() user: AuthPrincipal) {
    return { data: await this.prisma.tag.findMany({ where: { organizationId: user.organizationId } }) };
  }

  @Post("tags")
  async createTag(@CurrentUser() user: AuthPrincipal, @Body() body: unknown) {
    const dto = z.object({ name: z.string().min(1), color: z.string().optional() }).parse(body);
    return this.prisma.tag.create({
      data: { organizationId: user.organizationId, name: dto.name, color: dto.color ?? "#3DDC97" },
    });
  }

  @Get("suppressions")
  async suppressions(@CurrentUser() user: AuthPrincipal) {
    assertPerm(user, Permission.CALLS_READ);
    return {
      data: await this.prisma.suppressionEntry.findMany({
        where: { organizationId: user.organizationId },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
    };
  }

  @Post("suppressions")
  async addSuppression(@CurrentUser() user: AuthPrincipal, @Body() body: unknown) {
    assertPerm(user, Permission.CALLS_WRITE);
    const dto = z
      .object({
        type: z.string().default("PHONE"),
        value: z.string().min(3),
        scope: z.string().optional(),
        reason: z.string().optional(),
      })
      .parse(body);
    return this.prisma.suppressionEntry.create({
      data: {
        organizationId: user.organizationId,
        type: dto.type,
        value: dto.value,
        scope: dto.scope ?? "GLOBAL",
        reason: dto.reason,
      },
    });
  }

  @Get("flags")
  async flags(@CurrentUser() user: AuthPrincipal) {
    return { data: await this.prisma.featureFlag.findMany({ where: { organizationId: user.organizationId } }) };
  }

  @Patch("flags/:key")
  async patchFlag(@CurrentUser() user: AuthPrincipal, @Param("key") key: string, @Body() body: unknown) {
    assertPerm(user, Permission.SETTINGS_WRITE);
    const dto = z.object({ enabled: z.boolean() }).parse(body);
    return this.prisma.featureFlag.upsert({
      where: { organizationId_key: { organizationId: user.organizationId, key } },
      update: { enabled: dto.enabled },
      create: { organizationId: user.organizationId, key, enabled: dto.enabled },
    });
  }

  @Get("audit")
  async audit(@CurrentUser() user: AuthPrincipal, @Query("limit") limit = "50") {
    assertPerm(user, Permission.AUDIT_READ);
    return {
      data: await this.prisma.auditLog.findMany({
        where: { organizationId: user.organizationId },
        orderBy: { createdAt: "desc" },
        take: Math.min(200, Number(limit) || 50),
      }),
    };
  }

  @Get("notifications")
  async notifications(@CurrentUser() user: AuthPrincipal) {
    if (user.authType === "api_key") return { data: [] };
    return {
      data: await this.prisma.notification.findMany({
        where: { userId: user.userId },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
    };
  }

  @Post("notifications/:id/read")
  async readNotification(@CurrentUser() user: AuthPrincipal, @Param("id") id: string) {
    await this.prisma.notification.updateMany({
      where: { id, userId: user.userId },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  @Get("filters")
  async filters(@CurrentUser() user: AuthPrincipal, @Query("entity") entity?: string) {
    return {
      data: await this.prisma.savedFilter.findMany({
        where: { organizationId: user.organizationId, userId: user.userId, entity: entity || undefined },
      }),
    };
  }

  @Post("filters")
  async saveFilter(@CurrentUser() user: AuthPrincipal, @Body() body: unknown) {
    const dto = z
      .object({ name: z.string(), entity: z.string(), query: z.record(z.unknown()) })
      .parse(body);
    return this.prisma.savedFilter.create({
      data: {
        organizationId: user.organizationId,
        userId: user.userId,
        name: dto.name,
        entity: dto.entity,
        query: dto.query as never,
      },
    });
  }

  @Post("import/preview")
  preview(@CurrentUser() user: AuthPrincipal, @Body() body: unknown) {
    assertPerm(user, Permission.IMPORT_WRITE);
    const dto = z.object({ entity: z.enum(["publishers", "buyers", "leads"]), csv: z.string().min(1) }).parse(body);
    const lines = dto.csv.trim().split(/\r?\n/);
    const headers = lines[0]?.split(",").map((h) => h.trim()) ?? [];
    const rows = lines.slice(1, 51).map((line) => {
      const cols = line.split(",").map((c) => c.trim());
      return Object.fromEntries(headers.map((h, i) => [h, cols[i] ?? ""]));
    });
    return { entity: dto.entity, headers, rows, count: Math.max(0, lines.length - 1) };
  }

  @Post("import/commit")
  async commit(@CurrentUser() user: AuthPrincipal, @Body() body: unknown) {
    assertPerm(user, Permission.IMPORT_WRITE);
    const dto = z
      .object({
        entity: z.enum(["publishers", "buyers", "leads"]),
        rows: z.array(z.record(z.string())),
      })
      .parse(body);
    const created: string[] = [];
    for (const row of dto.rows) {
      if (dto.entity === "publishers" && row.company) {
        const p = await this.prisma.publisher.create({
          data: {
            publicId: createPublicId("pub"),
            organizationId: user.organizationId,
            company: row.company,
            email: row.email,
            contactName: row.contactName,
            status: "PROSPECT",
          },
        });
        created.push(p.publicId);
      }
      if (dto.entity === "buyers" && row.company) {
        const b = await this.prisma.buyer.create({
          data: {
            publicId: createPublicId("buy"),
            organizationId: user.organizationId,
            company: row.company,
            states: row.states ? row.states.split("|") : [],
            revenuePerCall: row.revenuePerCall ?? "0",
            status: "TESTING",
          },
        });
        created.push(b.publicId);
      }
      if (dto.entity === "leads" && row.phone) {
        const l = await this.prisma.lead.create({
          data: {
            publicId: createPublicId("lead"),
            organizationId: user.organizationId,
            publisherId: user.publisherId,
            phone: row.phone,
            firstName: row.firstName,
            lastName: row.lastName,
            email: row.email,
            state: row.state,
            status: "NEW",
          },
        });
        created.push(l.publicId);
      }
    }
    return { created: created.length, ids: created };
  }

  @Get("ivr")
  async ivrList(@CurrentUser() user: AuthPrincipal) {
    return { data: await this.prisma.ivrDefinition.findMany({ where: { organizationId: user.organizationId } }) };
  }

  @Post("ivr")
  async ivrCreate(@CurrentUser() user: AuthPrincipal, @Body() body: unknown) {
    const dto = z
      .object({ name: z.string(), document: z.record(z.unknown()), status: z.string().optional() })
      .parse(body);
    const last = await this.prisma.ivrDefinition.findFirst({
      where: { organizationId: user.organizationId, name: dto.name },
      orderBy: { version: "desc" },
    });
    return this.prisma.ivrDefinition.create({
      data: {
        organizationId: user.organizationId,
        name: dto.name,
        version: (last?.version ?? 0) + 1,
        status: dto.status ?? "published",
        document: dto.document as never,
      },
    });
  }

  @Get("pools")
  async pools(@CurrentUser() user: AuthPrincipal) {
    return {
      data: await this.prisma.numberPool.findMany({
        where: { organizationId: user.organizationId },
        include: { numbers: true },
      }),
    };
  }

  @Post("pools")
  async createPool(@CurrentUser() user: AuthPrincipal, @Body() body: unknown) {
    const dto = z.object({ name: z.string().min(1) }).parse(body);
    return this.prisma.numberPool.create({
      data: { publicId: createPublicId("pool"), organizationId: user.organizationId, name: dto.name },
    });
  }
}
