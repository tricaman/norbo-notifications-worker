import { z } from "zod/v4";

export const PingNotifJobSchema = z.object({
  type: z.literal("ping_in"),
  pingId: z.string().uuid(),
  senderId: z.string(),
  recipientId: z.string(),
  senderName: z.string(),
  ttlSeconds: z.number().int().positive(),
  createdAt: z.string().datetime(),
  isReminder: z.boolean(),
  reminderLabel: z.string().nullable(),
});

export const DahNotifJobSchema = z.object({
  type: z.literal("dah_received"),
  pingId: z.string().uuid(),
  senderId: z.string(),
  recipientId: z.string(),
  recipientName: z.string(),
  ackedAt: z.string().datetime(),
});

export const NotifJobSchema = z.discriminatedUnion("type", [
  PingNotifJobSchema,
  DahNotifJobSchema,
]);

export type PingNotifJobPayload = z.infer<typeof PingNotifJobSchema>;
export type DahNotifJobPayload = z.infer<typeof DahNotifJobSchema>;
export type NotifJobPayload = z.infer<typeof NotifJobSchema>;
