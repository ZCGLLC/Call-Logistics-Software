import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { createHash } from "node:crypto";
import type { UserRole } from "@zcg/shared";
import { hasPermission, type Permission } from "@zcg/shared";
import { PrismaService } from "../prisma.service.js";

export interface AuthPrincipal {
  userId: string;
  email: string;
  name: string;
  organizationId: string;
  role: UserRole;
  pii: boolean;
  publisherId?: string | null;
  buyerId?: string | null;
  scopes?: string[];
  authType?: "jwt" | "api_key";
  keyId?: string;
}

export const CurrentUser = createParamDecorator((_d: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  return req.user as AuthPrincipal;
});

function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const apiKey = req.headers["x-api-key"];
    if (typeof apiKey === "string" && apiKey.length > 8) {
      req.user = await this.fromApiKey(apiKey);
      return true;
    }
    const cookieName = process.env.COOKIE_NAME ?? "zcg_session";
    const raw =
      req.cookies?.[cookieName] ??
      (typeof req.headers.authorization === "string" && req.headers.authorization.startsWith("Bearer ")
        ? req.headers.authorization.slice(7)
        : undefined);
    if (!raw) throw new UnauthorizedException("Not authenticated");
    try {
      const payload = await this.jwt.verifyAsync<AuthPrincipal>(raw);
      req.user = { ...payload, authType: "jwt", scopes: payload.scopes ?? ["*"] };
      return true;
    } catch {
      throw new UnauthorizedException("Invalid session");
    }
  }

  private async fromApiKey(raw: string): Promise<AuthPrincipal> {
    const hash = hashApiKey(raw);
    const key = await this.prisma.apiKey.findUnique({ where: { hash } });
    if (!key || key.revokedAt) throw new UnauthorizedException("Invalid API key");
    await this.prisma.apiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    });
    const pubScope = key.scopes.find((s) => s.startsWith("pub:"));
    const buyScope = key.scopes.find((s) => s.startsWith("buy:"));
    const role: UserRole = buyScope ? "BUYER_ADMIN" : pubScope ? "PUBLISHER_ADMIN" : "ADMINISTRATOR";
    return {
      userId: `key:${key.id}`,
      email: `key:${key.prefix}@api.zcg`,
      name: key.name,
      organizationId: key.organizationId,
      role,
      pii: key.scopes.includes("*") || key.scopes.includes("pii:read"),
      publisherId: pubScope ? pubScope.slice(4) : null,
      buyerId: buyScope ? buyScope.slice(4) : null,
      scopes: key.scopes,
      authType: "api_key",
      keyId: key.id,
    };
  }
}

export function assertPerm(user: AuthPrincipal, perm: Permission) {
  if (!hasPermission(user.role, perm)) {
    throw new UnauthorizedException("Insufficient permission");
  }
}

export function hasScope(user: AuthPrincipal, scope: string): boolean {
  const scopes = user.scopes ?? ["*"];
  return scopes.includes("*") || scopes.includes(scope);
}

export function assertScope(user: AuthPrincipal, scope: string) {
  if (!hasScope(user, scope)) {
    throw new UnauthorizedException(`Missing scope ${scope}`);
  }
}
