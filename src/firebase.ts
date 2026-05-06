import * as admin from "firebase-admin";
import { config } from "./config";
import { logger } from "./logger";

/**
 * Initialise Firebase Admin SDK from the service account JSON
 * environment variable. Exports the messaging instance for
 * sending push notifications.
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

/** Parameters for sending a push notification. */
export interface SendParams {
  title: string;
  body: string;
  sound: string;
  data: Record<string, string>;
  category: string;
}

/**
 * Send a push notification to a single device token.
 * Uses data-only payload for Android (Notifee renders the notification)
 * and APNs payload for iOS (sound + category support).
 *
 * Returns 'ok' on success, 'invalid' if the token should be deleted.
 */
export async function sendToDevice(
  token: string,
  params: SendParams,
): Promise<"ok" | "invalid" | "error"> {
  try {
    const payload = {
      token,
      // DATA ONLY — Notifee handles display on Android
      data: {
        ...params.data,
        notifee_title: params.title,
        notifee_body: params.body,
        notifee_sound: params.sound,
        notifee_category: params.category,
      },
      android: {
        priority: "high" as const,
        ttl: 3600000, // 1 hour in ms
      },
      apns: {
        headers: {
          "apns-priority": "10",
          "apns-push-type": "alert",
        },
        payload: {
          aps: {
            "mutable-content": 1,
            sound: `${params.sound}.caf`,
            category: params.category,
          },
        },
      },
    };

    logger.info(
      {
        token: token.slice(0, 20) + "...",
        title: params.title,
        body: params.body,
        type: params.data.type,
      },
      "Sending FCM message",
    );

    const response = await messaging.send(payload);

    logger.info(
      { messageId: response, token: token.slice(0, 20) + "..." },
      "FCM message sent successfully",
    );
    return "ok";
  } catch (err: unknown) {
    const code =
      err instanceof Error && "code" in err
        ? (err as { code: string }).code
        : "unknown";

    // Token is no longer valid — caller should delete it
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
