import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import { env } from './env.js';
import { logger } from './logger.js';
import { HttpError } from './lib/errors.js';
import { registerRoutes } from './routes.js';
import { registerSources } from './scrapers/index.js';

export async function buildApp() {
  registerSources();

  const app = Fastify({
    logger: false,
    trustProxy: true,
    bodyLimit: env.MAX_FILE_SIZE + 1024 * 64,
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });
  await app.register(cors, {
    origin: [env.APP_URL, 'http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
  });
  await app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
  });
  await app.register(multipart, {
    limits: { fileSize: env.MAX_FILE_SIZE, files: 1 },
  });

  app.addHook('preHandler', async (request, reply) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return;
    const origin = request.headers.origin;
    if (!origin) return;
    const allowed = [env.APP_URL, 'http://localhost:3000', 'http://127.0.0.1:3000'];
    if (!allowed.some((item) => origin === item)) {
      return reply.code(403).send({ error: { message: 'Origin not allowed', code: 'CSRF' } });
    }
  });

  app.setErrorHandler((error, request, reply) => {
    logger.error({ err: error, url: request.url }, 'request failed');
    if (error instanceof HttpError) {
      return reply.code(error.statusCode).send({
        error: { message: error.message, code: error.code },
      });
    }
    const status = (error as { statusCode?: number }).statusCode ?? 500;
    const message = error instanceof Error ? error.message : 'Request failed';
    return reply.code(status).send({
      error: {
        message: status >= 500 ? 'Internal server error' : message,
        code: 'ERROR',
      },
    });
  });

  await registerRoutes(app);
  return app;
}
