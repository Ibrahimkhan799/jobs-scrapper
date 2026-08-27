import { env } from '../../env.js';
import { logger } from '../../logger.js';
import { assertSafeUrl } from '../../lib/ssrf.js';
import { SourceError } from './JobSource.js';

const lastHit = new Map<string, number>();
const MIN_GAP_MS = 1200;

async function politeGap(host: string): Promise<void> {
  const last = lastHit.get(host) ?? 0;
  const wait = MIN_GAP_MS - (Date.now() - last);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastHit.set(host, Date.now());
}

export async function fetchText(
  rawUrl: string,
  options: { accept?: string; sourceId?: string } = {},
): Promise<string> {
  const url = await assertSafeUrl(rawUrl);
  await politeGap(url.hostname);

  let lastError: unknown;
  const retries = env.HTTP_MAX_RETRIES;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), env.HTTP_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': `AIJobHunter/0.1 (local; +${env.APP_URL})`,
          Accept: options.accept ?? 'application/json, text/html;q=0.8',
        },
        redirect: 'follow',
      });
      if (response.status === 429 || response.status >= 500) {
        throw new Error(`HTTP ${response.status}`);
      }
      if (!response.ok) {
        throw new SourceError(
          options.sourceId ?? 'http',
          `Request failed with ${response.status}`,
        );
      }
      return await response.text();
    } catch (error) {
      lastError = error;
      logger.warn(
        { err: error, url: url.origin + url.pathname, attempt },
        'HTTP fetch failed',
      );
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** attempt));
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Fetch failed');
}

export async function fetchJson<T>(url: string, sourceId?: string): Promise<T> {
  const text = await fetchText(url, { accept: 'application/json', sourceId });
  return JSON.parse(text) as T;
}
