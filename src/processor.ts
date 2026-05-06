import { Job } from "bullmq";
import { sendToDevice, type SendParams } from "./firebase";
import { logger } from "./logger";
import { DbProvider } from "./providers/db.provider";
import {
  NotifJobSchema,
  type DahNotifJobPayload,
  type PingNotifJobPayload,
} from "./schema/job.schema";
import { formatTimeLeft, getTimeLeft } from "./utils/time";

/**
 * Process a single notification job:
 *
 * 1. Validate payload via Zod
 * 2. Route by type → handlePingNotification / handleDahNotification
 * 3. Look up push tokens from PostgreSQL
 * 4. Send via FCM with platform-aware payloads
 * 5. Delete stale tokens on send failure
 */
export async function processNotifJob(job: Job): Promise<void> {
  const jobLogger = logger.child({ jobId: job.id });

  // 1. Validate payload
  const result = NotifJobSchema.safeParse(job.data);
  if (!result.success) {
    jobLogger.warn(
      { errors: result.error.issues },
      "Invalid job payload — discarding",
    );
    return; // do not retry invalid payloads
  }

  const payload = result.data;

  // 2. Route by type
  if (payload.type === "ping_in") {
    await handlePingNotification(payload, jobLogger);
  } else if (payload.type === "dah_received") {
    await handleDahNotification(payload, jobLogger);
  }
}

async function handlePingNotification(
  payload: PingNotifJobPayload,
  parentLogger: typeof logger,
): Promise<void> {
  const jobLogger = parentLogger.child({
    pingId: payload.pingId,
    recipientId: payload.recipientId,
  });

  const tokens = await DbProvider.getTokensForUser(payload.recipientId);
  if (tokens.length === 0) {
    jobLogger.info("No tokens — skip");
    return;
  }

  const timeLeft = getTimeLeft(payload.createdAt, payload.ttlSeconds);
  if (timeLeft <= 0) {
    jobLogger.info("Ping expired — skip");
    return;
  }

  // Check if ping is still PENDING in DB before sending reminder
  if (payload.isReminder) {
    const pingStatus = await DbProvider.getPingStatus(payload.pingId);
    if (pingStatus !== "PENDING") {
      jobLogger.info(
        { status: pingStatus },
        "Ping no longer pending — skip reminder",
      );
      return;
    }
  }

  const title = payload.senderName;
  const body = payload.isReminder
    ? `dit · ${formatTimeLeft(timeLeft)} left`
    : "dit";
  const sound = "morse_dit"; // maps to morse_dit.wav / morse_dit.caf

  const params: SendParams = {
    title,
    body,
    sound,
    data: {
      type: "ping_in",
      pingId: payload.pingId,
      senderId: payload.senderId,
      senderName: payload.senderName,
      ttlSeconds: String(payload.ttlSeconds),
      createdAt: payload.createdAt,
      isReminder: String(payload.isReminder),
    },
    category: "PING_ACTIONS", // enables Dah action button
  };

  let sent = 0;
  for (const token of tokens) {
    const result = await sendToDevice(token.token, params);
    if (result === "invalid") {
      jobLogger.warn({ tokenId: token.id }, "Invalid token — deleting");
      await DbProvider.deleteToken(token.id);
    } else if (result === "ok") {
      sent++;
    }
  }

  jobLogger.info(
    { sent, total: tokens.length, isReminder: payload.isReminder },
    "Ping notification delivered",
  );
}

async function handleDahNotification(
  payload: DahNotifJobPayload,
  parentLogger: typeof logger,
): Promise<void> {
  const jobLogger = parentLogger.child({
    pingId: payload.pingId,
    senderId: payload.senderId,
  });

  // Dah notification goes to the original ping sender
  const tokens = await DbProvider.getTokensForUser(payload.senderId);
  if (tokens.length === 0) {
    jobLogger.info("No tokens for sender — skip");
    return;
  }

  const params: SendParams = {
    title: payload.recipientName,
    body: "dah",
    sound: "morse_dah", // maps to morse_dah.wav / morse_dah.caf
    data: {
      type: "dah_received",
      pingId: payload.pingId,
      recipientId: payload.recipientId,
      recipientName: payload.recipientName,
      ackedAt: payload.ackedAt,
    },
    category: "DAH_INFO", // no action needed — read only
  };

  let sent = 0;
  for (const token of tokens) {
    const result = await sendToDevice(token.token, params);
    if (result === "invalid") {
      jobLogger.warn({ tokenId: token.id }, "Invalid token — deleting");
      await DbProvider.deleteToken(token.id);
    } else if (result === "ok") {
      sent++;
    }
  }

  jobLogger.info({ sent, total: tokens.length }, "Dah notification delivered");
}
