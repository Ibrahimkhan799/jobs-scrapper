import type { RawJob } from '@job-hunter/shared';
import type { JobSource, SourceSearchQuery } from '../core/JobSource.js';
import { SourceError } from '../core/JobSource.js';
import { fetchJson } from '../core/http.js';

type ArbeitnowResponse = {
  data?: Array<{
    slug: string;
    company_name: string;
    title: string;
    description: string;
    remote: boolean;
    url: string;
    tags?: string[];
    job_types?: string[];
    location?: string;
    created_at?: string;
  }>;
};

export class ArbeitnowSource implements JobSource {
  id = 'arbeitnow';
  name = 'Arbeitnow';

  async search(query: SourceSearchQuery): Promise<RawJob[]> {
    try {
      const data = await fetchJson<ArbeitnowResponse>(
        'https://www.arbeitnow.com/api/job-board-api',
        this.id,
      );
      const tokens = query.query.toLowerCase().split(/\s+/).filter((t) => t !== 'remote');
      return (data.data ?? [])
        .filter((job) => {
          const hay = `${job.title} ${job.company_name} ${job.location ?? ''}`.toLowerCase();
          return tokens.every((token) => hay.includes(token));
        })
        .slice(0, 40)
        .map((job) => ({
          source: this.id,
          sourceJobId: job.slug,
          title: job.title,
          company: job.company_name,
          location: job.remote ? 'Remote' : job.location,
          remoteType: job.remote ? 'REMOTE' : 'ANY',
          employmentType: job.job_types?.[0],
          description: job.description,
          skills: job.tags ?? [],
          applicationUrl: job.url,
          postedAt: job.created_at,
          originalUrl: job.url,
        }));
    } catch (error) {
      throw new SourceError(this.id, 'Arbeitnow search failed', error);
    }
  }

  async test() {
    try {
      const jobs = await this.search({ query: 'developer' });
      return { ok: true, message: `Matched ${jobs.length} listings`, sampleCount: jobs.length };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Failed' };
    }
  }
}
