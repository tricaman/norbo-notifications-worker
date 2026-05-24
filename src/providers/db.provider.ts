import postgres from "postgres";
import { config } from "../config";

const sql = postgres(config.DATABASE_URL);

/**
 * Thin Postgres provider used by the worker.
 *
 * Reads active push tokens (source of truth in norbo-api) and
 * soft-invalidates tokens reported as dead by FCM (404/410 errors).
 * Never hard-deletes — that is done by the norbo-api logout flow.
 */
export const DbProvider = {
  async getTokensForUser(
    userId: string,
  ): Promise<{ id: string; token: string; platform: string }[]> {
    return sql<{ id: string; token: string; platform: string }[]>`
      SELECT id, token, platform
      FROM push_tokens
      WHERE "userId" = ${userId}
        AND "invalidatedAt" IS NULL
    `;
  },

  async invalidateToken(tokenId: string): Promise<void> {
    await sql`
      UPDATE push_tokens
      SET "invalidatedAt" = NOW()
      WHERE id = ${tokenId}
    `;
  },

  async close(): Promise<void> {
    await sql.end();
  },
};
