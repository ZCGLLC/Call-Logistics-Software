import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { UserRole } from "@zcg/shared";
import { hasPermission, type Permission } from "@zcg/shared";

export interface AuthPrincipal {
  userId: string;
  email: string;
  name: string;
  organizationId: string;
  role: UserRole;
  pii: boolean;
}

export const CurrentUser = createParamDecorator((_d: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  return req.user as AuthPrincipal;
});

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(JwtService) private readonly jwt: JwtService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const cookieName = process.env.COOKIE_NAME ?? "zcg_session";
    const raw =
      req.cookies?.[cookieName] ??
      (typeof req.headers.authorization === "string" && req.headers.authorization.startsWith("Bearer ")
        ? req.headers.authorization.slice(7)
        : undefined);
    if (!raw) throw new UnauthorizedException("Not authenticated");
    try {
      req.user = await this.jwt.verifyAsync<AuthPrincipal>(raw);
      return true;
    } catch {
      throw new UnauthorizedException("Invalid session");
    }
  }
}

export function assertPerm(user: AuthPrincipal, perm: Permission) {
  if (!hasPermission(user.role, perm)) {
    throw new UnauthorizedException("Insufficient permission");
  }
}
