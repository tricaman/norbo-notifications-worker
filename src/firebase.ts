import * as admin from "firebase-admin";
import { config } from "./config";
import { logger } from "./logger";

/**
 * Initialise Firebase Admin SDK from the service account JSON env var.
 * Exported `messaging` is the only handle the rest of the worker uses.
 */
let app: admin.app.App;

try {
  const serviceAccount = JSON.parse(
    config.FIREBASE_SERVICE_ACCOUNT_JSON,
  ) as admin.ServiceAccount;

  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  logger.info("Firebase Admin SDK initialised");
} catch (err) {
  logger.fatal({ err }, "Failed to initialise Firebase Admin SDK");
  process.exit(1);
}

export const messaging = app.messaging();

/** Parameters for sending a single push notification. */
export interface SendParams {
  title: string;
  body: string;
  data: Record<string, string>;
  /** Optional sound name (without extension). Used for APNs. */
  sound?: string;
  /** Optional iOS notification category id. */
  category?: string;
}

export type SendResult = "ok" | "invalid" | "error";

/**
 * Send a push notification to a single device token.
 *
 * Uses a data-only FCM payload so Notifee on the mobile side renders the
 * notification (channel, icons, actions). APNs payload still carries
 * `mutable-content`, sound and category for iOS.
 *
 * Returns `'invalid'` when the token must be deleted server-side (FCM
 * indicated the token is no longer registered).
 */
export async function sendToDevice(
  token: string,
  params: SendParams,
): Promise<SendResult> {
  try {
    const apnsPayload: Record<string, unknown> = {
      "mutable-content": 1,
    };
    if (params.sound) apnsPayload.sound = `${params.sound}.caf`;
    if (params.category) apnsPayload.category = params.category;

    const dataPayload: Record<string, string> = {
      ...params.data,
      notifee_title: params.title,
      notifee_body: params.body,
    };
    if (params.sound) dataPayload.notifee_sound = params.sound;
    if (params.category) dataPayload.notifee_category = params.category;

    const payload: admin.messaging.Message = {
      token,
      data: dataPayload,
      android: {
        priority: "high",
        ttl: 3_600_000,
      },
      apns: {
        headers: {
          "apns-priority": "10",
          "apns-push-type": "alert",
        },
        payload: { aps: apnsPayload },
      },
    };

    const messageId = await messaging.send(payload);
    logger.info(
      { messageId, token: token.slice(0, 20) + "..." },
      "FCM message sent",
    );
    return "ok";
  } catch (err: unknown) {
    const code =
      err instanceof Error && "code" in err
        ? (err as { code: string }).code
        : "unknown";

    if (
      code === "messaging/registration-token-not-registered" ||
      code === "messaging/invalid-registration-token"
    ) {
      logger.warn({ token: token.slice(0, 12) + "..." }, "Stale FCM token");
      return "invalid";
    }

    logger.error({ err, token: token.slice(0, 12) + "..." }, "FCM send failed");
    return "error";
  }
}
