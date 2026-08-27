import { env } from './env.js';
import { logger } from './logger.js';
import { buildApp } from './app.js';
import { startScheduler } from './scheduler.js';

async function main() {
  const app = await buildApp();
  startScheduler();
  await app.listen({ port: env.API_PORT, host: '0.0.0.0' });
  logger.info(`API listening on ${env.API_URL}`);
}

main().catch((error) => {
  logger.error({ err: error }, 'API failed to start');
  process.exit(1);
});
