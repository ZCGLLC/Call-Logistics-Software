import { Body, Controller, Delete, Get, Inject, Param, Post, UseGuards } from "@nestjs/common";
import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { Permission } from "@zcg/shared";
import { PrismaService } from "../prisma.service.js";
import { AuthGuard, CurrentUser, assertPerm, type AuthPrincipal } from "../auth/auth.guard.js";

@Controller("keys")
@UseGuards(AuthGuard)
export class KeysController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() user: AuthPrincipal) {
    assertPerm(user, Permission.API_KEYS_WRITE);
    const data = await this.prisma.apiKey.findMany({
      where: { organizationId: user.organizationId, revokedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        prefix: true,
        name: true,
        scopes: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });
    return { data };
  }

  @Post()
  async create(@CurrentUser() user: AuthPrincipal, @Body() body: unknown) {
    assertPerm(user, Permission.API_KEYS_WRITE);
    const dto = z
      .object({
        name: z.string().min(1),
        scopes: z.array(z.string()).optional(),
      })
      .parse(body);
    const raw = `zcg_${randomBytes(24).toString("base64url")}`;
    const prefix = raw.slice(0, 12);
    const hash = createHash("sha256").update(raw).digest("hex");
    const scopes = [...(dto.scopes ?? ["calls:read", "leads:write", "rtb:write"])];
    if (user.publisherId) scopes.push(`pub:${user.publisherId}`);
    if (user.buyerId) scopes.push(`buy:${user.buyerId}`);
    const row = await this.prisma.apiKey.create({
      data: {
        organizationId: user.organizationId,
        prefix,
        hash,
        name: dto.name,
        scopes,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        organizationId: user.organizationId,
        userId: user.authType === "jwt" ? user.userId : null,
        action: "apikey.create",
        entity: "ApiKey",
        entityId: row.id,
        after: { name: row.name, prefix },
      },
    });
    return { id: row.id, prefix, name: row.name, scopes: row.scopes, token: raw };
  }

  @Delete(":id")
  async revoke(@CurrentUser() user: AuthPrincipal, @Param("id") id: string) {
    assertPerm(user, Permission.API_KEYS_WRITE);
    const row = await this.prisma.apiKey.findFirstOrThrow({
      where: { id, organizationId: user.organizationId },
    });
    await this.prisma.apiKey.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
    return { ok: true };
  }
}
