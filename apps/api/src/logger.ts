import pino from 'pino';
import { env } from './env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'SMTP_PASSWORD',
      'smtpPassword',
      'password',
      'OPENAI_API_KEY',
      'GEMINI_API_KEY',
      'req.headers.authorization',
      'env.SMTP_PASSWORD',
      'env.OPENAI_API_KEY',
      'env.GEMINI_API_KEY',
    ],
    censor: '[redacted]',
  },
  transport:
    env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
      : undefined,
});
