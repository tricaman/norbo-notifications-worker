import postgres from 'postgres';
import { config } from '../config';

const sql = postgres(config.DATABASE_URL);

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

  async getPingStatus(pingId: string): Promise<string | null> {
    const rows = await sql<{ status: string }[]>`
      SELECT status FROM pings WHERE id = ${pingId} LIMIT 1
    `;
    return rows[0]?.status ?? null;
  },

  async close(): Promise<void> {
    await sql.end();
  },
};
