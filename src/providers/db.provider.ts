import postgres from "postgres";
import { config } from "../config";

const sql = postgres(config.DATABASE_URL);

/**
 * Thin Postgres provider used by the worker.
 *
 * Reads push tokens (source of truth lives in norbo-api) and deletes
 * stale tokens reported by FCM (404/410 errors). No other writes.
 */
export const DbProvider = {
  async getTokensForUser(
    userId: string,
  ): Promise<{ id: string; token: string; platform: string }[]> {
    return sql<{ id: string; token: string; platform: string }[]>`
      SELECT id, token, platform
      FROM push_tokens
      WHERE "userId" = ${userId}
    `;
  },

  async deleteToken(tokenId: string): Promise<void> {
    await sql`DELETE FROM push_tokens WHERE id = ${tokenId}`;
  },

  async close(): Promise<void> {
    await sql.end();
  },
};
