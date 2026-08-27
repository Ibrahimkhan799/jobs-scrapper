import type { RawJob } from '@job-hunter/shared';
import type { JobSource, SourceSearchQuery } from '../core/JobSource.js';
import { SourceError } from '../core/JobSource.js';
import { fetchJson } from '../core/http.js';

type RemotiveResponse = {
  jobs?: Array<{
    id: number;
    url: string;
    title: string;
    company_name: string;
    company_logo?: string;
    category?: string;
    tags?: string[];
    job_type?: string;
    publication_date?: string;
    candidate_required_location?: string;
    salary?: string;
    description?: string;
  }>;
};

export class RemotiveSource implements JobSource {
  id = 'remotive';
  name = 'Remotive';

  async search(query: SourceSearchQuery): Promise<RawJob[]> {
    const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query.query)}`;
    try {
      const data = await fetchJson<RemotiveResponse>(url, this.id);
      return (data.jobs ?? []).slice(0, 40).map((job) => ({
        source: this.id,
        sourceJobId: String(job.id),
        title: job.title,
        company: job.company_name,
        location: job.candidate_required_location ?? 'Remote',
        remoteType: 'REMOTE',
        employmentType: job.job_type,
        salary: job.salary,
        description: job.description,
        skills: job.tags ?? [],
        applicationUrl: job.url,
        postedAt: job.publication_date,
        originalUrl: job.url,
      }));
    } catch (error) {
      throw new SourceError(this.id, 'Remotive search failed', error);
    }
  }

  async test() {
    try {
      const jobs = await this.search({ query: 'javascript' });
      return { ok: true, message: `Fetched ${jobs.length} listings`, sampleCount: jobs.length };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Failed' };
    }
  }
}
