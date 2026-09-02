import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { createPublicId } from "@zcg/shared";
import { PrismaService } from "../prisma.service.js";
import { AuthGuard, CurrentUser, type AuthPrincipal } from "../auth/auth.guard.js";

@Controller("numbers")
@UseGuards(AuthGuard)
export class NumbersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() user: AuthPrincipal) {
    const data = await this.prisma.trackingNumber.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: "desc" },
      include: { campaign: true, publisher: true },
    });
    return { data };
  }

  @Post()
  async create(@CurrentUser() user: AuthPrincipal, @Body() body: unknown) {
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
