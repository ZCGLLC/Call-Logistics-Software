import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { PrismaClient } from "@prisma/client";
import { createHmac } from "node:crypto";
import pino from "pino";

const logger = pino({ name: "zcg-worker" });
const url = process.env.REDIS_URL ?? "redis://localhost:6379";
const prisma = new PrismaClient();

function sign(secret: string, body: string) {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

async function deliverWebhook(deliveryId: string) {
  const delivery = await prisma.webhookDelivery.findUnique({
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
  const signature = sign(delivery.endpoint.secretHash, body);
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
  await prisma.webhookDelivery.update({
    where: { id: delivery.id },
    data: { status: "DELIVERED", attempts: delivery.attempts + 1, lastError: null },
  });
}

async function main() {
  const connection = new Redis(url, { maxRetriesPerRequest: null });
  const workers = [
    new Worker(
      "webhooks",
      async (job) => {
        const deliveryId = (job.data as { deliveryId?: string }).deliveryId;
        if (!deliveryId) return;
        try {
          await deliverWebhook(deliveryId);
        } catch (err) {
          const delivery = await prisma.webhookDelivery.findUnique({ where: { id: deliveryId } });
          const attempts = (delivery?.attempts ?? 0) + 1;
          await prisma.webhookDelivery.update({
            where: { id: deliveryId },
            data: {
              attempts,
              status: attempts >= 8 ? "DLQ" : "FAILED",
              lastError: err instanceof Error ? err.message : "delivery failed",
            },
          });
          throw err;
        }
      },
      { connection },
    ),
    ...["transcription", "reports", "invoices", "recordings", "aggregates", "alerts", "exports"].map(
      (name) =>
        new Worker(
          name,
          async (job) => {
            logger.info({ queue: name, jobId: job.id, name: job.name }, "job received");
          },
          { connection },
        ),
    ),
  ];
  logger.info({ redis: url }, "ZCG CI worker listening");
  const shutdown = async () => {
    await Promise.all(workers.map((w) => w.close()));
    await connection.quit();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  logger.error(err);
  process.exit(1);
});
