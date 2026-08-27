import { sourceRegistry } from './core/JobSourceRegistry.js';
import { RemotiveSource } from './sources/remotive.js';
import { RemoteOkSource } from './sources/remoteok.js';
import { ArbeitnowSource } from './sources/arbeitnow.js';
import { RssSource } from './sources/rss.js';
import { GreenhouseSource } from './sources/greenhouse.js';

export function registerSources(): void {
  sourceRegistry.register(new RemotiveSource());
  sourceRegistry.register(new RemoteOkSource());
  sourceRegistry.register(new ArbeitnowSource());
  sourceRegistry.register(new RssSource());
  sourceRegistry.register(new GreenhouseSource());
}

export { sourceRegistry } from './core/JobSourceRegistry.js';
export type { JobSource } from './core/JobSource.js';
