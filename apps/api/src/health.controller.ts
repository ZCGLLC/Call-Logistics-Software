import { Controller, Get, Inject } from "@nestjs/common";
import { PrismaService } from "./prisma.service.js";
import { CapsService } from "./caps/caps.service.js";

@Controller("health")
export class HealthController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CapsService) private readonly caps: CapsService,
  ) {}

  @Get("live")
  live() {
    return { status: "ok", service: "zcg-ci-api", ts: new Date().toISOString() };
  }

  @Get("ready")
  async ready() {
    await this.prisma.$queryRaw`SELECT 1`;
    const redis = await this.caps.ping();
    return {
      status: "ready",
      database: "up",
      redis,
      telephony: process.env.TELEPHONY_PROVIDER ?? "fake",
    };
  }
}
