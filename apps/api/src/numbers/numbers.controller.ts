import { Body, Controller, Get, Inject, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { createPublicId, Permission } from "@zcg/shared";
import { PrismaService } from "../prisma.service.js";
import { AuthGuard, CurrentUser, assertPerm, type AuthPrincipal } from "../auth/auth.guard.js";
import { numberScope } from "../auth/tenant.js";

@Controller("numbers")
@UseGuards(AuthGuard)
export class NumbersController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() user: AuthPrincipal) {
    const data = await this.prisma.trackingNumber.findMany({
      where: numberScope(user),
      orderBy: { createdAt: "desc" },
      include: { campaign: true, publisher: true },
    });
    return { data };
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
        status: dto.campaignId ? "ASSIGNED" : "AVAILABLE",
      },
    });
  }
}
