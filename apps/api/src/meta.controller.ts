import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { PrismaService } from "./prisma.service.js";
import { AuthGuard, CurrentUser, type AuthPrincipal } from "./auth/auth.guard.js";
import { callScope, redactList } from "./auth/tenant.js";

@Controller()
@UseGuards(AuthGuard)
export class MetaController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get("verticals")
  async verticals(@CurrentUser() user: AuthPrincipal) {
    return {
      data: await this.prisma.vertical.findMany({
        where: { organizationId: user.organizationId },
        orderBy: { name: "asc" },
      }),
    };
  }

  @Get("live")
  async live(@CurrentUser() user: AuthPrincipal) {
    const data = await this.prisma.call.findMany({
      where: {
        ...callScope(user),
        OR: [
          { status: { in: ["INCOMING", "IVR", "QUALIFYING", "AUCTIONING", "ROUTING", "RINGING", "CONNECTED", "TRANSFERRED"] } },
          { startedAt: { gte: new Date(Date.now() - 5 * 60_000) } },
        ],
      },
      orderBy: { startedAt: "desc" },
      take: 50,
      include: { campaign: { include: { vertical: true } }, publisher: true, buyer: true },
    });
    return { data: redactList(user, data as unknown as Record<string, unknown>[]) };
  }
}
