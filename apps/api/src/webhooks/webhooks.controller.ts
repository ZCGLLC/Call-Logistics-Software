import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { Permission } from "@zcg/shared";
import { PrismaService } from "../prisma.service.js";
import { AuthGuard, CurrentUser, assertPerm, type AuthPrincipal } from "../auth/auth.guard.js";
import { WebhookService, WEBHOOK_EVENTS } from "./webhooks.service.js";

@Controller("webhooks")
@UseGuards(AuthGuard)
export class WebhooksController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(WebhookService) private readonly webhooks: WebhookService,
  ) {}

  @Get("events")
  events() {
    return { data: WEBHOOK_EVENTS };
  }

  @Get()
  async list(@CurrentUser() user: AuthPrincipal) {
    assertPerm(user, Permission.WEBHOOKS_WRITE);
    const data = await this.prisma.webhookEndpoint.findMany({
      where: { organizationId: user.organizationId },
      include: { deliveries: { orderBy: { createdAt: "desc" }, take: 5 } },
    });
    return {
      data: data.map((d) => ({
        id: d.id,
        url: d.url,
        events: d.events,
        active: d.active,
        deliveries: d.deliveries.map((x) => ({
          id: x.id,
          event: x.event,
          status: x.status,
          attempts: x.attempts,
          lastError: x.lastError,
          createdAt: x.createdAt,
        })),
      })),
    };
  }

  @Post()
  async create(@CurrentUser() user: AuthPrincipal, @Body() body: unknown) {
    assertPerm(user, Permission.WEBHOOKS_WRITE);
    const dto = z
      .object({
        url: z.string().url(),
        events: z.array(z.string()).optional(),
        secret: z.string().min(8).optional(),
      })
      .parse(body);
    const secret = dto.secret ?? `whsec_${crypto.randomUUID().replace(/-/g, "")}`;
    const row = await this.prisma.webhookEndpoint.create({
      data: {
        organizationId: user.organizationId,
        url: dto.url,
        secretHash: secret,
        events: dto.events ?? ["*"],
        active: true,
      },
    });
    return { id: row.id, url: row.url, events: row.events, secret };
  }

  @Patch(":id")
  async patch(@CurrentUser() user: AuthPrincipal, @Param("id") id: string, @Body() body: unknown) {
    assertPerm(user, Permission.WEBHOOKS_WRITE);
    const dto = z
      .object({
        active: z.boolean().optional(),
        events: z.array(z.string()).optional(),
        url: z.string().url().optional(),
      })
      .parse(body);
    const row = await this.prisma.webhookEndpoint.findFirstOrThrow({
      where: { id, organizationId: user.organizationId },
    });
    return this.prisma.webhookEndpoint.update({ where: { id: row.id }, data: dto });
  }

  @Post(":id/test")
  async test(@CurrentUser() user: AuthPrincipal, @Param("id") id: string) {
    assertPerm(user, Permission.WEBHOOKS_WRITE);
    const row = await this.prisma.webhookEndpoint.findFirstOrThrow({
      where: { id, organizationId: user.organizationId },
    });
    await this.webhooks.emit(user.organizationId, "call.completed", {
      test: true,
      endpointId: row.id,
    });
    return { ok: true };
  }

  @Delete(":id")
  async remove(@CurrentUser() user: AuthPrincipal, @Param("id") id: string) {
    assertPerm(user, Permission.WEBHOOKS_WRITE);
    const row = await this.prisma.webhookEndpoint.findFirstOrThrow({
      where: { id, organizationId: user.organizationId },
    });
    await this.prisma.webhookDelivery.deleteMany({ where: { endpointId: row.id } });
    await this.prisma.webhookEndpoint.delete({ where: { id: row.id } });
    return { ok: true };
  }
}
