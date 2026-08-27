import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

for (const relative of ['.env', '../../.env', '../../../.env']) {
  const path = resolve(process.cwd(), relative);
  if (existsSync(path)) config({ path, override: false });
}

const empty = z
  .string()
  .optional()
  .transform((value) => (value && value.trim().length > 0 ? value : undefined));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  API_PORT: z.coerce.number().int().positive().default(4000),
  APP_URL: z.string().default('http://localhost:3000'),
  API_URL: z.string().default('http://localhost:4000'),
  LOG_LEVEL: z.string().default('info'),
  DEFAULT_USER_EMAIL: z.string().email().default('demo@jobhunter.local'),
  MAX_FILE_SIZE: z.coerce.number().int().positive().default(5_242_880),
  UPLOAD_DIR: z.string().default('./storage/uploads'),
  OLLAMA_BASE_URL: empty,
  OLLAMA_MODEL: z.string().default('llama3.2'),
  OPENAI_API_KEY: empty,
  GEMINI_API_KEY: empty,
  AI_PROVIDER: z.enum(['ollama', 'openai', 'gemini', 'heuristic', 'grok', 'groq', 'openrouter', 'together', 'custom']).default('ollama'),
  SMTP_HOST: empty,
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: empty,
  SMTP_PASSWORD: empty,
  SMTP_FROM: empty,
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((value) => value === 'true' || value === '1'),
  SMTP_PROVIDER: z.enum(['smtp', 'gmail', 'outlook']).default('smtp'),
  HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  HTTP_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  SCRAPE_MAX_JOBS_PER_SOURCE: z.coerce.number().int().positive().default(50),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Invalid environment:\n${issues.join('\n')}`);
  }
  return parsed.data;
}

export const env = loadEnv();
