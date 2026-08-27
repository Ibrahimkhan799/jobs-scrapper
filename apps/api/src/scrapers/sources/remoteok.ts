import type { RawJob } from '@job-hunter/shared';
import type { JobSource, SourceSearchQuery } from '../core/JobSource.js';
import { SourceError } from '../core/JobSource.js';
import { fetchJson } from '../core/http.js';

type RemoteOkJob = {
  id?: string | number;
  slug?: string;
  position?: string;
  company?: string;
  location?: string;
  description?: string;
  url?: string;
  apply_url?: string;
  tags?: string[];
  date?: string;
  salary_min?: number;
  salary_max?: number;
};

export class RemoteOkSource implements JobSource {
  id = 'remoteok';
  name = 'RemoteOK';

  async search(query: SourceSearchQuery): Promise<RawJob[]> {
    try {
      const payload = await fetchJson<Array<RemoteOkJob | { legal?: string }>>(
        'https://remoteok.com/api',
        this.id,
      );
      const tokens = query.query.toLowerCase().split(/\s+/).filter(Boolean);
      const jobs = payload.filter((item): item is RemoteOkJob => 'position' in item || 'id' in item);
      return jobs
        .filter((job) => {
          const hay = `${job.position ?? ''} ${job.company ?? ''} ${(job.tags ?? []).join(' ')}`.toLowerCase();
          return tokens.every((token) => hay.includes(token) || token === 'remote');
        })
        .slice(0, 40)
        .map((job) => ({
          source: this.id,
          sourceJobId: String(job.id ?? job.slug ?? job.url),
          title: job.position ?? 'Untitled',
          company: job.company ?? 'Unknown',
          location: job.location || 'Remote',
          remoteType: 'REMOTE' as const,
          description: job.description,
          skills: job.tags ?? [],
          salaryMin: job.salary_min ? job.salary_min * 1000 : null,
          salaryMax: job.salary_max ? job.salary_max * 1000 : null,
          applicationUrl: job.apply_url ?? job.url,
          postedAt: job.date,
          originalUrl: job.url ?? `https://remoteok.com/remote-jobs/${job.slug ?? job.id}`,
        }));
    } catch (error) {
      throw new SourceError(this.id, 'RemoteOK search failed', error);
    }
  }

  async test() {
    try {
      const jobs = await this.search({ query: 'javascript remote' });
      return { ok: true, message: `Matched ${jobs.length} listings`, sampleCount: jobs.length };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Failed' };
    }
  }
}
