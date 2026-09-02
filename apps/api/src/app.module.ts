import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ThrottlerModule } from "@nestjs/throttler";
import { PrismaModule } from "./prisma.module.js";
import { RedisModule } from "./redis.module.js";
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
import { KeysController } from "./keys/keys.controller.js";
import { LeadsController } from "./leads/leads.controller.js";
import { RtbController } from "./rtb/rtb.controller.js";
import { WebhooksController } from "./webhooks/webhooks.controller.js";
import { BillingController } from "./billing/billing.controller.js";
import { SearchController } from "./search/search.controller.js";
import { OpsController } from "./ops/ops.controller.js";
import { CallOrchestrator } from "./calls/call-orchestrator.service.js";
import { RealtimeGateway } from "./realtime/realtime.gateway.js";
import { AuthGuard } from "./auth/auth.guard.js";
import { CapsService } from "./caps/caps.service.js";
import { WebhookService } from "./webhooks/webhooks.service.js";
import { AuctionService } from "./rtb/auction.service.js";
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
    RedisModule,
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
    KeysController,
    LeadsController,
    RtbController,
    WebhooksController,
    BillingController,
    SearchController,
    OpsController,
  ],
  providers: [
    AuthGuard,
    CallOrchestrator,
    RealtimeGateway,
    CapsService,
    WebhookService,
    AuctionService,
    { provide: TELEPHONY, useFactory: () => new FakeTelephonyProvider() },
  ],
})
export class AppModule {}
