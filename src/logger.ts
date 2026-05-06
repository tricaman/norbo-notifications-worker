import pino from 'pino';
import { config } from './config';

/**
 * Shared Pino logger instance for dit-worker.
 * Uses pino-pretty in development for human-readable output.
 */
export const logger = pino({
  level: config.LOG_LEVEL,
  transport:
    config.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});
