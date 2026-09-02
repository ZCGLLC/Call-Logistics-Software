import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ThrottlerModule } from "@nestjs/throttler";
import { PrismaModule } from "./prisma.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { HealthController } from "./health.controller.js";
import { PublishersController } from "./publishers/publishers.controller.js";
import { BuyersController } from "./buyers/buyers.controller.js";
import { CampaignsController } from "./campaigns/campaigns.controller.js";
import { NumbersController } from "./numbers/numbers.controller.js";
import { CallsController } from "./calls/calls.controller.js";
import { ReportsController } from "./reports/reports.controller.js";
import { RoutingController } from "./routing/routing.controller.js";
import { DemoController } from "./demo/demo.controller.js";
import { MetaController } from "./meta.controller.js";
import { CallOrchestrator } from "./calls/call-orchestrator.service.js";
import { RealtimeGateway } from "./realtime/realtime.gateway.js";
import { AuthGuard } from "./auth/auth.guard.js";
import { FakeTelephonyProvider } from "@zcg/telephony";
import { TELEPHONY } from "./telephony.token.js";

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? "dev-only-change-me",
      signOptions: { expiresIn: "8h" },
    }),
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 300 }] }),
    PrismaModule,
    AuthModule,
  ],
  controllers: [
    HealthController,
    PublishersController,
    BuyersController,
    CampaignsController,
    NumbersController,
    CallsController,
    ReportsController,
    RoutingController,
    DemoController,
    MetaController,
  ],
  providers: [
    AuthGuard,
    CallOrchestrator,
    RealtimeGateway,
    { provide: TELEPHONY, useFactory: () => new FakeTelephonyProvider() },
  ],
})
export class AppModule {}
