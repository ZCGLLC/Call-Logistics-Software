import { Worker } from "bullmq";
import { Redis } from "ioredis";
import pino from "pino";

const logger = pino({ name: "zcg-worker" });
const url = process.env.REDIS_URL ?? "redis://localhost:6379";

async function main() {
  const connection = new Redis(url, { maxRetriesPerRequest: null });
  const queues = [
    "webhooks",
    "transcription",
    "reports",
    "invoices",
    "recordings",
    "aggregates",
    "alerts",
    "exports",
  ];
  const workers = queues.map(
    (name) =>
      new Worker(
        name,
        async (job) => {
          logger.info({ queue: name, jobId: job.id, name: job.name }, "job received");
        },
        { connection },
      ),
  );
  logger.info({ queues, redis: url }, "ZCG CI worker listening");
  const shutdown = async () => {
    await Promise.all(workers.map((w) => w.close()));
    await connection.quit();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  logger.error(err);
  process.exit(1);
});
