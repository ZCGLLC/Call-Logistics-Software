import { Body, Controller, Get, Inject, Post, Req, Res, UnauthorizedException, UseGuards } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Request, Response } from "express";
import argon2 from "argon2";
import { z } from "zod";
import { PrismaService } from "../prisma.service.js";
import { AuthGuard, CurrentUser, type AuthPrincipal } from "./auth.guard.js";
import { hasPermission, Permission } from "@zcg/shared";

const LoginDto = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

@Controller("auth")
export class AuthController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwt: JwtService,
  ) {}

  @Post("login")
  async login(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { email, password } = LoginDto.parse(body);
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { memberships: true },
    });
    if (!user) throw new UnauthorizedException("Invalid credentials");
    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) throw new UnauthorizedException("Invalid credentials");
    const membership = user.memberships[0];
    if (!membership) throw new UnauthorizedException("No organization membership");
    const principal: AuthPrincipal = {
      userId: user.id,
      email: user.email,
      name: user.name,
      organizationId: membership.organizationId,
      role: membership.role,
      pii: hasPermission(membership.role, Permission.PII_READ),
    };
    const token = await this.jwt.signAsync(principal);
    const cookieName = process.env.COOKIE_NAME ?? "zcg_session";
    const forwarded = String(req.headers["x-forwarded-proto"] ?? "");
    const secure =
      process.env.COOKIE_SECURE === "true" ||
      process.env.NODE_ENV === "production" ||
      forwarded.includes("https");
    res.cookie(cookieName, token, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      maxAge: 8 * 60 * 60 * 1000,
      path: "/",
    });
    return { user: principal };
  }

  @Post("logout")
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(process.env.COOKIE_NAME ?? "zcg_session", { path: "/" });
    return { ok: true };
  }

  @Get("me")
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: AuthPrincipal) {
    return { user };
  }

  @Get("csrf-check")
  ping(@Req() req: Request) {
    return { origin: req.headers.origin ?? null };
  }
}
