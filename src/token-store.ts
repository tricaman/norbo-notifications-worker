import Redis from 'ioredis';
import { logger } from './logger';

/**
 * TokenStore — looks up push tokens for a given user from Redis.
 *
 * norbo-api writes push tokens to both PostgreSQL (source of truth)
 * and Redis (cache for fast lookup by dit-worker). This store reads
 * from Redis to avoid a direct PostgreSQL dependency.
 *
 * Redis key format: `push_tokens:{userId}` → Set of token strings
 *
 * If a token is found to be stale (FCM returns 404/410), the worker
 * removes it from both Redis and publishes a deletion event so
 * norbo-api can clean up PostgreSQL.
 */
export class TokenStore {
  constructor(private readonly redis: Redis) {}

  /** Get all push tokens for a user from Redis. */
  async getTokensForUser(userId: string): Promise<string[]> {
    const tokens = await this.redis.smembers(`push_tokens:${userId}`);
    return tokens;
  }

  /** Remove a stale token from the Redis set. */
  async removeToken(userId: string, token: string): Promise<void> {
    await this.redis.srem(`push_tokens:${userId}`, token);
    logger.info(
      { userId, token: token.slice(0, 12) + '...' },
      'Removed stale push token from Redis',
    );
  }
}
