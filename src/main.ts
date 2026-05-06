import { Worker } from "bullmq";
import Redis from "ioredis";
import { config } from "./config";
import { logger } from "./logger";
import { processNotifJob } from "./processor";
import { DbProvider } from "./providers/db.provider";

/**
 * norbo-notifications-worker — BullMQ consumer for the `notif` queue.
 *
 * Each job is a generic push notification request:
 *   { userId, title, body, data?, sound?, category? }
 *
 * The worker resolves push tokens for `userId` from PostgreSQL, sends the
 * FCM message via Firebase Admin, and prunes tokens that FCM no longer
 * recognises. No business logic, no HTTP server.
 *
 * Graceful shutdown on SIGTERM / SIGINT (important for container health).
 */

const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null, // required by BullMQ
});

const worker = new Worker(
  "notif",
  async (job) => {
    await processNotifJob(job);
  },
  {
    connection: redis,
    concurrency: config.WORKER_CONCURRENCY,
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
);

worker.on("completed", (job) => {
  logger.debug({ jobId: job.id }, "Job completed");
});

worker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, err }, "Job failed");
});

worker.on("error", (err) => {
  logger.error({ err }, "Worker error");
});

logger.info(
  { concurrency: config.WORKER_CONCURRENCY },
  "norbo-notifications-worker started — listening on notif queue",
);

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Shutting down gracefully...");
  await worker.close();
  await DbProvider.close();
  redis.disconnect();
  logger.info("norbo-notifications-worker stopped");
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
