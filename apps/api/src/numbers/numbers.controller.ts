import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { createPublicId, Permission } from "@zcg/shared";
import type { TelephonyProvider } from "@zcg/telephony";
import { PrismaService } from "../prisma.service.js";
import { AuthGuard, CurrentUser, assertPerm, type AuthPrincipal } from "../auth/auth.guard.js";
import { numberScope, publisherScope, campaignScope } from "../auth/tenant.js";
import { TELEPHONY } from "../telephony.token.js";

@Controller("numbers")
@UseGuards(AuthGuard)
export class NumbersController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TELEPHONY) private readonly telephony: TelephonyProvider,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthPrincipal, @Query("includeReleased") includeReleased?: string) {
    const data = await this.prisma.trackingNumber.findMany({
      where: {
        ...numberScope(user),
        status: includeReleased === "true" ? undefined : { not: "RELEASED" },
      },
      orderBy: { createdAt: "desc" },
      include: { campaign: true, publisher: true },
    });
    return { data };
  }

  @Get("available")
  async available(
    @CurrentUser() user: AuthPrincipal,
    @Query("areaCode") areaCode?: string,
    @Query("tollFree") tollFree?: string,
    @Query("limit") limit = "8",
  ) {
    assertPerm(user, Permission.PUBLISHERS_WRITE);
    const wanted = Math.min(25, Number(limit) || 8);
    const raw = await this.telephony.searchNumbers({
      areaCode,
      tollFree: tollFree === "true",
      limit: wanted + 10,
    });
    const existing = new Set(
      (
        await this.prisma.trackingNumber.findMany({
          where: { organizationId: user.organizationId, e164: { in: raw.map((n) => n.e164) } },
          select: { e164: true },
        })
      ).map((n) => n.e164),
    );
    return { data: raw.filter((n) => !existing.has(n.e164)).slice(0, wanted) };
  }

  @Post("provision")
  async provision(@CurrentUser() user: AuthPrincipal, @Body() body: unknown) {
    assertPerm(user, Permission.PUBLISHERS_WRITE);
    const dto = z
      .object({
        publisherId: z.string().min(1),
        campaignId: z.string().optional(),
        quantity: z.coerce.number().int().min(1).max(25).default(1),
        numberType: z.enum(["LOCAL", "TOLL_FREE", "MOBILE"]).default("TOLL_FREE"),
        areaCode: z.string().optional(),
      })
      .parse(body);

    const publisher = await this.prisma.publisher.findFirstOrThrow({
      where: { ...publisherScope(user), OR: [{ id: dto.publisherId }, { publicId: dto.publisherId }] },
    });
    let campaignId: string | undefined;
    if (dto.campaignId) {
      const campaign = await this.prisma.campaign.findFirstOrThrow({
        where: {
          ...campaignScope(user),
          publisherId: publisher.id,
          OR: [{ id: dto.campaignId }, { publicId: dto.campaignId }],
        },
      });
      campaignId = campaign.id;
    }

    const created = [];
    for (let i = 0; i < dto.quantity; i++) {
      const e164 = await this.nextUniqueE164(dto.numberType, dto.areaCode);
      const purchased = await this.telephony.purchaseNumber({ e164 });
      const row = await this.prisma.trackingNumber.create({
        data: {
          publicId: createPublicId("did"),
          organizationId: user.organizationId,
          e164: purchased.e164,
          provider: this.telephony.id,
          providerNumberId: purchased.providerNumberId,
          publisherId: publisher.id,
          campaignId,
          numberType: dto.numberType,
          status: campaignId ? "ASSIGNED" : "RESERVED",
          monthlyCost: "1.0000",
        },
        include: { publisher: true, campaign: true },
      });
      created.push(row);
    }

    await this.prisma.auditLog.create({
      data: {
        organizationId: user.organizationId,
        userId: user.authType === "jwt" ? user.userId : null,
        action: "numbers.provision",
        entity: "TrackingNumber",
        entityId: publisher.id,
        after: { quantity: created.length, publisherId: publisher.publicId, e164: created.map((n) => n.e164) },
      },
    });
    return { data: created, publisher: { publicId: publisher.publicId, company: publisher.company } };
  }

  @Post()
  async create(@CurrentUser() user: AuthPrincipal, @Body() body: unknown) {
    assertPerm(user, Permission.CAMPAIGNS_WRITE);
    const dto = z
      .object({
        e164: z.string(),
        campaignId: z.string().optional(),
        publisherId: z.string().optional(),
        numberType: z.enum(["LOCAL", "TOLL_FREE", "MOBILE"]).optional(),
      })
      .parse(body);
    return this.prisma.trackingNumber.create({
      data: {
        publicId: createPublicId("did"),
        organizationId: user.organizationId,
        e164: dto.e164,
        provider: process.env.TELEPHONY_PROVIDER ?? "fake",
        campaignId: dto.campaignId,
        publisherId: dto.publisherId,
        numberType: dto.numberType ?? "TOLL_FREE",
        status: dto.campaignId ? "ASSIGNED" : dto.publisherId ? "RESERVED" : "AVAILABLE",
      },
    });
  }

  @Patch(":id")
  async patch(@CurrentUser() user: AuthPrincipal, @Param("id") id: string, @Body() body: unknown) {
    assertPerm(user, Permission.PUBLISHERS_WRITE);
    const dto = z
      .object({
        publisherId: z.string().nullable().optional(),
        campaignId: z.string().nullable().optional(),
        status: z.enum(["AVAILABLE", "ASSIGNED", "RESERVED", "PORTING", "RELEASED"]).optional(),
      })
      .parse(body);
    const row = await this.prisma.trackingNumber.findFirstOrThrow({
      where: { ...numberScope(user), OR: [{ id }, { publicId: id }] },
    });
    let publisherId = dto.publisherId === undefined ? row.publisherId : dto.publisherId;
    let campaignId = dto.campaignId === undefined ? row.campaignId : dto.campaignId;
    if (typeof publisherId === "string") {
      const pub = await this.prisma.publisher.findFirst({
        where: { ...publisherScope(user), OR: [{ id: publisherId }, { publicId: publisherId }] },
      });
      publisherId = pub?.id ?? publisherId;
    }
    if (typeof campaignId === "string") {
      const cam = await this.prisma.campaign.findFirst({
        where: { ...campaignScope(user), OR: [{ id: campaignId }, { publicId: campaignId }] },
      });
      campaignId = cam?.id ?? campaignId;
    }
    const status =
      dto.status ??
      (campaignId ? "ASSIGNED" : publisherId ? "RESERVED" : "AVAILABLE");
    return this.prisma.trackingNumber.update({
      where: { id: row.id },
      data: { publisherId, campaignId, status },
      include: { publisher: true, campaign: true },
    });
  }

  @Delete(":id")
  async release(@CurrentUser() user: AuthPrincipal, @Param("id") id: string) {
    assertPerm(user, Permission.PUBLISHERS_WRITE);
    const row = await this.prisma.trackingNumber.findFirstOrThrow({
      where: { ...numberScope(user), OR: [{ id }, { publicId: id }] },
    });
    if (row.providerNumberId) {
      await this.telephony.releaseNumber(row.providerNumberId).catch(() => undefined);
    }
    await this.prisma.trackingNumber.update({
      where: { id: row.id },
      data: { status: "RELEASED", campaignId: null, publisherId: null },
    });
    return { ok: true, released: row.e164 };
  }

  private async nextUniqueE164(numberType: "LOCAL" | "TOLL_FREE" | "MOBILE", areaCode?: string) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const candidates = await this.telephony.searchNumbers({
        areaCode,
        tollFree: numberType === "TOLL_FREE",
        limit: 8,
      });
      for (const c of candidates) {
        const taken = await this.prisma.trackingNumber.findFirst({
          where: { e164: c.e164 },
        });
        if (!taken) return c.e164;
      }
    }
    throw new BadRequestException("Could not allocate a unique DID from the provider inventory");
  }
}
