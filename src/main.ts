import { Worker } from "bullmq";
import Redis from "ioredis";
import { config } from "./config";
import { logger } from "./logger";
import { processNotifJob } from "./processor";
import { DbProvider } from "./providers/db.provider";

/**
 * dit-worker — BullMQ consumer for the `notif` queue.
 *
 * Processes notification jobs published by norbo-api and dit-ping:
 * - ping_in    → push notification to ping recipient
 * - dah_received → push notification to original ping sender
 *
 * Push tokens are resolved from PostgreSQL (source of truth).
 * Stale tokens are deleted on FCM send failure.
 *
 * Graceful shutdown on SIGTERM/SIGINT (important for container health).
 */

// ── Redis connection ────────────────────────────────────────────────────
const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null, // required by BullMQ
});

// ── BullMQ Worker ───────────────────────────────────────────────────────
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
  "dit-worker started — listening on notif queue",
);

// ── Graceful shutdown ───────────────────────────────────────────────────
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Shutting down gracefully...");
  await worker.close();
  await DbProvider.close();
  redis.disconnect();
  logger.info("dit-worker stopped");
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
