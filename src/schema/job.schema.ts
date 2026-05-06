import { z } from "zod/v4";

/**
 * Generic notification job payload consumed from the `notif` BullMQ queue.
 *
 * After the dit → norbo cleanup the worker is intentionally domain-agnostic:
 * the producer (norbo-api or any future service) is responsible for choosing
 * title, body, and any custom data. The worker only resolves push tokens for
 * `userId`, sends the FCM message, and prunes stale tokens.
 *
 * `data` is forwarded as-is to the FCM payload. Notifee on the mobile side
 * inspects it to decide how to render the notification (channel, actions, …).
 */
export const NotifJobSchema = z.object({
  /** Recipient user id — used to look up push tokens. */
  userId: z.string().min(1),

  /** Visible title shown to the user. */
  title: z.string().min(1),

  /** Visible body shown to the user. */
  body: z.string().default(""),

  /**
   * Sound name without extension. The worker maps it to `${sound}.caf` for
   * iOS APNs. Android sound is decided client-side via the channel id.
   * Optional — defaults to the system default sound.
   */
  sound: z.string().optional(),

  /**
   * Free-form key/value bag forwarded to FCM as the `data` payload.
   * All values must be strings (FCM constraint).
   */
  data: z.record(z.string(), z.string()).default({}),

  /**
   * Optional iOS notification category id (used for action buttons).
   * Mobile must register the matching category in Notifee.
   */
  category: z.string().optional(),
});

export type NotifJobPayload = z.infer<typeof NotifJobSchema>;
