import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { badRequest } from './errors.js';

const BLOCKED_HOSTS = new Set(['localhost', 'localhost.localdomain', 'metadata.google.internal']);

function isPrivateIp(ip: string): boolean {
  if (ip === '::1' || ip.startsWith('fe80:') || ip.startsWith('fc') || ip.startsWith('fd')) {
    return true;
  }
  const parts = ip.split('.').map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return false;
  const [a, b] = parts;
  if (a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 0) return true;
  return false;
}

export async function assertSafeUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw badRequest('Invalid URL', 'INVALID_URL');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw badRequest('Only http and https URLs are allowed', 'BLOCKED_URL');
  }
  const hostname = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(hostname) || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw badRequest('URL host is not allowed', 'BLOCKED_URL');
  }
  if (isIP(hostname) && isPrivateIp(hostname)) {
    throw badRequest('Private IP addresses are not allowed', 'BLOCKED_URL');
  }
  try {
    const resolved = await lookup(hostname, { all: true });
    if (resolved.some((entry) => isPrivateIp(entry.address))) {
      throw badRequest('URL resolved to a private address', 'BLOCKED_URL');
    }
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error) throw error;
    throw badRequest('Could not resolve URL host', 'BLOCKED_URL');
  }
  return url;
}
