import "dotenv/config";
import { z } from "zod/v4";

/**
 * Zod schema for norbo-notifications-worker environment variables.
 * Validates at startup — fail fast on missing config.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  REDIS_URL: z.url(),
  DATABASE_URL: z.url(),

  // Firebase Admin SDK service account JSON
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().min(1),

  // Concurrency — how many jobs to process in parallel
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(10),

  // Log level
  LOG_LEVEL: z.string().default("info"),
});

export type EnvConfig = z.infer<typeof envSchema>;

const result = envSchema.safeParse(process.env);
if (!result.success) {
  const formatted = z.prettifyError(result.error);
  console.error(`Invalid environment variables:\n${formatted}`);
  process.exit(1);
}

export const config: EnvConfig = result.data;
