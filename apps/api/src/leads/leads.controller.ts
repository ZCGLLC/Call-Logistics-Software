import { Body, Controller, Get, Inject, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { createPublicId, Permission, normalizeE164 } from "@zcg/shared";
import { PrismaService } from "../prisma.service.js";
import { AuthGuard, CurrentUser, assertPerm, assertScope, type AuthPrincipal } from "../auth/auth.guard.js";
import { campaignScope } from "../auth/tenant.js";
import { WebhookService } from "../webhooks/webhooks.service.js";

@Controller("leads")
@UseGuards(AuthGuard)
export class LeadsController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(WebhookService) private readonly webhooks: WebhookService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthPrincipal, @Query("limit") limit = "50") {
    assertPerm(user, Permission.LEADS_WRITE);
    const data = await this.prisma.lead.findMany({
      where: {
        organizationId: user.organizationId,
        ...(user.publisherId ? { publisherId: user.publisherId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(200, Number(limit) || 50),
      include: { campaign: true, publisher: true },
    });
    return { data };
  }

  @Post()
  async create(@CurrentUser() user: AuthPrincipal, @Body() body: unknown) {
    assertPerm(user, Permission.LEADS_WRITE);
    assertScope(user, "leads:write");
    const dto = z
      .object({
        phone: z.string(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        email: z.string().email().optional(),
        state: z.string().optional(),
        zip: z.string().optional(),
        vertical: z.string().optional(),
        campaignId: z.string().optional(),
        publisherId: z.string().optional(),
        customFields: z.record(z.unknown()).optional(),
        consentAt: z.string().datetime().optional(),
        consentSourceUrl: z.string().optional(),
        consentIp: z.string().optional(),
        consentUserAgent: z.string().optional(),
        consentTextVer: z.string().optional(),
      })
      .parse(body);
    const phone = normalizeE164(dto.phone);
    const campaign = dto.campaignId
      ? await this.prisma.campaign.findFirst({
          where: { ...campaignScope(user), OR: [{ id: dto.campaignId }, { publicId: dto.campaignId }] },
        })
      : null;
    const publisherId = user.publisherId ?? dto.publisherId ?? campaign?.publisherId;
    const hourAgo = new Date(Date.now() - 3600_000);
    const dup = await this.prisma.lead.findFirst({
      where: {
        organizationId: user.organizationId,
        phone,
        campaignId: campaign?.id ?? undefined,
        createdAt: { gte: hourAgo },
      },
    });
    if (dup) return { ...dup, duplicate: true };
    const lead = await this.prisma.lead.create({
      data: {
        publicId: createPublicId("lead"),
        organizationId: user.organizationId,
        publisherId,
        campaignId: campaign?.id,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone,
        email: dto.email,
        state: dto.state,
        zip: dto.zip,
        vertical: dto.vertical ?? campaign?.name,
        customFields: dto.customFields as never,
        consentAt: dto.consentAt ? new Date(dto.consentAt) : null,
        consentSourceUrl: dto.consentSourceUrl,
        consentIp: dto.consentIp,
        consentUserAgent: dto.consentUserAgent,
        consentTextVer: dto.consentTextVer,
        status: "NEW",
      },
    });
    await this.webhooks.emit(user.organizationId, "lead.created", { leadId: lead.publicId, phone: lead.phone });
    return lead;
  }

  @Patch(":id")
  async patch(@CurrentUser() user: AuthPrincipal, @Param("id") id: string, @Body() body: unknown) {
    assertPerm(user, Permission.LEADS_WRITE);
    const dto = z.object({ status: z.string(), customFields: z.record(z.unknown()).optional() }).parse(body);
    const row = await this.prisma.lead.findFirstOrThrow({
      where: {
        organizationId: user.organizationId,
        OR: [{ id }, { publicId: id }],
        ...(user.publisherId ? { publisherId: user.publisherId } : {}),
      },
    });
    return this.prisma.lead.update({
      where: { id: row.id },
      data: { status: dto.status, customFields: dto.customFields as never },
    });
  }
}
