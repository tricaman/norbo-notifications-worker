import { Job } from "bullmq";
import { sendToDevice, type SendParams } from "./firebase";
import { logger } from "./logger";
import { DbProvider } from "./providers/db.provider";
import { NotifJobSchema } from "./schema/job.schema";

/**
 * Process a single notification job from the `notif` BullMQ queue.
 *
 * 1. Validate payload via Zod (invalid → swallow, do not retry).
 * 2. Look up push tokens for the recipient in PostgreSQL.
 * 3. Forward title/body/data/category to FCM via Firebase Admin.
 * 4. Soft-invalidate tokens that FCM reports as no longer registered.
 *
 * The worker is domain-agnostic: it does not interpret `data` keys.
 * Producers decide rendering via Notifee on the mobile client.
 */
export async function processNotifJob(job: Job): Promise<void> {
  const jobLogger = logger.child({ jobId: job.id });

  const result = NotifJobSchema.safeParse(job.data);
  if (!result.success) {
    jobLogger.warn(
      { errors: result.error.issues },
      "Invalid job payload — discarding",
    );
    return;
  }

  const payload = result.data;
  const recipientLogger = jobLogger.child({ userId: payload.userId });

  const tokens = await DbProvider.getTokensForUser(payload.userId);
  if (tokens.length === 0) {
    recipientLogger.info("No push tokens — skip");
    return;
  }

  const params: SendParams = {
    title: payload.title,
    body: payload.body,
    data: payload.data,
    sound: payload.sound,
    category: payload.category,
  };

  let sent = 0;
  for (const token of tokens) {
    const send = await sendToDevice(token.token, params);
    if (send === "invalid") {
      recipientLogger.warn(
        { tokenId: token.id },
        "Invalid token — invalidating",
      );
      await DbProvider.invalidateToken(token.id);
    } else if (send === "ok") {
      sent++;
    }
  }

  recipientLogger.info(
    { sent, total: tokens.length },
    "Notification delivered",
  );
}
