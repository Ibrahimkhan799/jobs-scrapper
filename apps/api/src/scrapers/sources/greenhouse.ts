import type { RawJob } from '@job-hunter/shared';
import { prisma } from '@job-hunter/database';
import type { JobSource, SourceSearchQuery } from '../core/JobSource.js';
import { SourceError } from '../core/JobSource.js';
import { fetchJson } from '../core/http.js';

type GreenhouseConfig = { boards?: string[] };

type GreenhouseResponse = {
  jobs?: Array<{
    id: number;
    title: string;
    absolute_url: string;
    updated_at?: string;
    location?: { name?: string };
    content?: string;
    metadata?: unknown;
  }>;
};

export class GreenhouseSource implements JobSource {
  id = 'greenhouse';
  name = 'Greenhouse boards';

  async search(query: SourceSearchQuery): Promise<RawJob[]> {
    const record = await prisma.jobSource.findUnique({ where: { sourceKey: this.id } });
    const boards = ((record?.config ?? {}) as GreenhouseConfig).boards ?? [];
    if (boards.length === 0) return [];
    const tokens = query.query.toLowerCase().split(/\s+/).filter((t) => t !== 'remote');
    const jobs: RawJob[] = [];

    for (const board of boards.slice(0, 8)) {
      try {
        const data = await fetchJson<GreenhouseResponse>(
          `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs?content=true`,
          this.id,
        );
        for (const job of data.jobs ?? []) {
          const hay = `${job.title} ${job.location?.name ?? ''}`.toLowerCase();
          if (!tokens.every((token) => hay.includes(token))) continue;
          jobs.push({
            source: this.id,
            sourceJobId: `${board}-${job.id}`,
            title: job.title,
            company: board,
            location: job.location?.name,
            description: job.content,
            applicationUrl: job.absolute_url,
            postedAt: job.updated_at,
            originalUrl: job.absolute_url,
          });
        }
      } catch (error) {
        throw new SourceError(this.id, `Greenhouse board failed: ${board}`, error);
      }
    }
    return jobs.slice(0, 50);
  }

  async test() {
    const record = await prisma.jobSource.findUnique({ where: { sourceKey: this.id } });
    const boards = ((record?.config ?? {}) as GreenhouseConfig).boards ?? [];
    if (boards.length === 0) {
      return { ok: true, message: 'No Greenhouse boards configured', sampleCount: 0 };
    }
    try {
      const jobs = await this.search({ query: 'engineer' });
      return { ok: true, message: `Fetched ${jobs.length} jobs`, sampleCount: jobs.length };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Failed' };
    }
  }
}
