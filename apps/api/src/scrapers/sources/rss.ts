import Parser from 'rss-parser';
import type { RawJob } from '@job-hunter/shared';
import { prisma } from '@job-hunter/database';
import type { JobSource, SourceSearchQuery } from '../core/JobSource.js';
import { SourceError } from '../core/JobSource.js';
import { assertSafeUrl } from '../../lib/ssrf.js';

const parser = new Parser();

type RssConfig = { feeds?: string[] };

export class RssSource implements JobSource {
  id = 'rss';
  name = 'RSS feeds';

  async search(query: SourceSearchQuery): Promise<RawJob[]> {
    const source = await prisma.jobSource.findUnique({ where: { sourceKey: this.id } });
    const config = (source?.config ?? {}) as RssConfig;
    const feeds = config.feeds ?? [];
    if (feeds.length === 0) return [];

    const tokens = query.query.toLowerCase().split(/\s+/).filter(Boolean);
    const jobs: RawJob[] = [];

    for (const feedUrl of feeds.slice(0, 5)) {
      try {
        await assertSafeUrl(feedUrl);
        const feed = await parser.parseURL(feedUrl);
        for (const item of feed.items.slice(0, 30)) {
          const hay = `${item.title ?? ''} ${item.contentSnippet ?? ''}`.toLowerCase();
          if (!tokens.every((token) => hay.includes(token) || token === 'remote')) continue;
          const link = item.link ?? feedUrl;
          jobs.push({
            source: this.id,
            sourceJobId: item.guid ?? link,
            title: item.title ?? 'Untitled',
            company: feed.title ?? 'RSS',
            description: item.content ?? item.contentSnippet ?? '',
            applicationUrl: link,
            postedAt: item.isoDate ?? item.pubDate,
            originalUrl: link,
          });
        }
      } catch (error) {
        throw new SourceError(this.id, `RSS feed failed: ${feedUrl}`, error);
      }
    }
    return jobs;
  }

  async test() {
    const source = await prisma.jobSource.findUnique({ where: { sourceKey: this.id } });
    const feeds = ((source?.config ?? {}) as RssConfig).feeds ?? [];
    if (feeds.length === 0) {
      return { ok: true, message: 'No RSS feeds configured', sampleCount: 0 };
    }
    try {
      const jobs = await this.search({ query: 'developer' });
      return { ok: true, message: `Parsed ${jobs.length} items`, sampleCount: jobs.length };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Failed' };
    }
  }
}
