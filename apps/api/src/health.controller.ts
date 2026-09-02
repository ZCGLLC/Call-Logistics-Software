import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "./prisma.service.js";
import { CapsService } from "./caps/caps.service.js";
import { telephonyConfigured, telephonyProviderId } from "@zcg/telephony";
import { emailProviderId } from "./email/mailer.js";
import { storageProviderId } from "./storage/recordings.js";

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
    const telephony = telephonyProviderId();
    const appEnv = process.env.APP_ENV ?? "local";
    if (appEnv === "production" && telephony === "fake" && process.env.ALLOW_FAKE_TELEPHONY !== "true") {
      throw new ServiceUnavailableException("fake telephony is not allowed in production");
    }
    if (telephony !== "fake" && !telephonyConfigured(telephony)) {
      throw new ServiceUnavailableException(`${telephony} credentials missing`);
    }
    return {
      status: "ready",
      database: "up",
      redis,
      telephony,
      telephonyConfigured: telephonyConfigured(telephony),
      storage: storageProviderId(),
      email: emailProviderId(),
      payments: process.env.PAYMENTS_PROVIDER ?? "invoices",
    };
  }
}
