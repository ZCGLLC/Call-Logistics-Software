import { Inject, Injectable, Optional } from "@nestjs/common";
import { Queue } from "bullmq";
import type { Redis } from "ioredis";
import { Prisma } from "@prisma/client";
import { REDIS_QUEUE } from "../redis.module.js";
import { PrismaService } from "../prisma.service.js";
import { signWebhookBody } from "./hmac.js";

export const WEBHOOK_EVENTS = [
  "call.started",
  "call.completed",
  "call.converted",
  "call.failed",
  "lead.created",
  "dispute.opened",
  "dispute.resolved",
  "invoice.generated",
] as const;

@Injectable()
export class WebhookService {
  private queue: Queue | null = null;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Optional() @Inject(REDIS_QUEUE) queueRedis: Redis | null,
  ) {
    if (queueRedis) {
      this.queue = new Queue("webhooks", { connection: queueRedis });
    }
  }

  async emit(organizationId: string, event: (typeof WEBHOOK_EVENTS)[number], payload: Record<string, unknown>) {
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: { organizationId, active: true },
    });
    for (const ep of endpoints) {
      if (ep.events.length && !ep.events.includes(event) && !ep.events.includes("*")) continue;
      const delivery = await this.prisma.webhookDelivery.create({
        data: {
          endpointId: ep.id,
          event,
          payload: payload as Prisma.InputJsonValue,
          status: "PENDING",
        },
      });
      if (this.queue) {
        await this.queue.add(
          "deliver",
          { deliveryId: delivery.id },
          { attempts: 8, backoff: { type: "exponential", delay: 2000 }, removeOnComplete: 1000 },
        );
      } else {
        await this.deliverNow(delivery.id);
      }
    }
  }

  async deliverNow(deliveryId: string) {
    const delivery = await this.prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: { endpoint: true },
    });
    if (!delivery || !delivery.endpoint.active) return;
    const body = JSON.stringify({
      id: delivery.id,
      event: delivery.event,
      createdAt: delivery.createdAt.toISOString(),
      data: delivery.payload,
    });
    const signature = signWebhookBody(delivery.endpoint.secretHash, body);
    try {
      const res = await fetch(delivery.endpoint.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-zcg-signature": signature,
          "x-zcg-event": delivery.event,
          "x-zcg-delivery": delivery.id,
        },
        body,
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: { status: "DELIVERED", attempts: delivery.attempts + 1, lastError: null },
      });
    } catch (err) {
      const attempts = delivery.attempts + 1;
      await this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          attempts,
          status: attempts >= 8 ? "DLQ" : "FAILED",
          lastError: err instanceof Error ? err.message : "delivery failed",
        },
      });
      throw err;
    }
  }
}
