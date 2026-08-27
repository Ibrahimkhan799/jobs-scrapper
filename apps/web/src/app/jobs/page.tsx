'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiSend } from '@/lib/api';
import { formatDate, formatSalary, remoteLabel } from '@/lib/utils';
import { PageHeader, EmptyState, Skeleton } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/forms';
import { ScoreBadge, ScoreMeta } from '@/components/score-badge';

type JobList = {
  items: Array<{
    id: string;
    title: string;
    location: string | null;
    remoteType: string;
    employmentType: string;
    salaryMin: number | null;
    salaryMax: number | null;
    currency: string | null;
    postedAt: string | null;
    applicationEmail: string | null;
    applicationUrl: string | null;
    isDemo: boolean;
    company: { name: string };
    source: { name: string; sourceKey: string };
    skills: Array<{ skill: { name: string } }>;
    matches?: Array<{
      matchScore: number;
      matchedSkills: string[];
      missingRequiredSkills: string[];
    }>;
  }>;
  total: number;
  page: number;
  pageSize: number;
};

export default function JobsPage() {
  const [q, setQ] = useState('');
  const [minScore, setMinScore] = useState('');
  const [remote, setRemote] = useState('');
  const [source, setSource] = useState('');
  const [hasEmail, setHasEmail] = useState('');
  const [sort, setSort] = useState('match');
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const params = useMemo(() => {
    const search = new URLSearchParams();
    if (q) search.set('q', q);
    if (minScore) search.set('minScore', minScore);
    if (remote) search.set('remoteType', remote);
    if (source) search.set('source', source);
    if (hasEmail) search.set('hasEmail', hasEmail);
    search.set('sort', sort);
    search.set('page', String(page));
    search.set('pageSize', '20');
    return search.toString();
  }, [q, minScore, remote, source, hasEmail, sort, page]);

  const jobs = useQuery({
    queryKey: ['jobs', params],
    queryFn: () => api<JobList>(`/jobs?${params}`),
  });

  const searchNow = useMutation({
    mutationFn: () => apiSend('/jobs/search', 'POST', {}),
    onSuccess: () => {
      toast.success('Search finished');
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const archive = useMutation({
    mutationFn: (id: string) => apiSend(`/jobs/${id}/analyze`, 'POST'),
    onSuccess: () => {
      toast.success('Analyzed');
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });

  return (
    <div>
      <PageHeader
        title="Jobs"
        description="Sort and filter by Job Match Score. Seeded rows are labeled Demo."
        actions={
          <Button onClick={() => searchNow.mutate()} disabled={searchNow.isPending}>
            {searchNow.isPending ? 'Searching…' : 'Run search now'}
          </Button>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-6">
        <Input placeholder="Search title or company" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <Input placeholder="Min score" type="number" value={minScore} onChange={(e) => { setMinScore(e.target.value); setPage(1); }} />
        <select className="h-8 rounded-md border border-border bg-background px-2 text-sm" value={remote} onChange={(e) => { setRemote(e.target.value); setPage(1); }}>
          <option value="">Remote: any</option>
          <option value="REMOTE">Remote</option>
          <option value="HYBRID">Hybrid</option>
          <option value="ONSITE">On-site</option>
        </select>
        <select className="h-8 rounded-md border border-border bg-background px-2 text-sm" value={hasEmail} onChange={(e) => { setHasEmail(e.target.value); setPage(1); }}>
          <option value="">Apply method</option>
          <option value="true">Email available</option>
          <option value="false">Manual only</option>
        </select>
        <Input placeholder="Source key" value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }} />
        <select className="h-8 rounded-md border border-border bg-background px-2 text-sm" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="match">Sort: Match</option>
          <option value="date">Sort: Date</option>
          <option value="salary">Sort: Salary</option>
          <option value="company">Sort: Company</option>
          <option value="location">Sort: Location</option>
        </select>
      </div>
      {jobs.isLoading ? (
        <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : jobs.error ? (
        <p className="text-sm text-danger">Failed to load jobs.</p>
      ) : !jobs.data?.items.length ? (
        <EmptyState
          title="No jobs yet"
          body="Upload a CV, configure a search profile, then run discovery. Public sources such as Remotive are used when enabled."
        />
      ) : (
        <div className="overflow-hidden rounded-md border border-border">
          {jobs.data.items
            .slice()
            .sort((a, b) =>
              sort === 'match'
                ? (b.matches?.[0]?.matchScore ?? 0) - (a.matches?.[0]?.matchScore ?? 0)
                : 0,
            )
            .map((job) => {
              const match = job.matches?.[0];
              return (
                <div key={job.id} className="grid grid-cols-[auto_1fr_auto] items-start gap-3 border-b border-border px-3 py-2.5 last:border-0">
                  <div>
                    <ScoreBadge score={match?.matchScore} />
                    <div className="mt-1"><ScoreMeta score={match?.matchScore} /></div>
                  </div>
                  <div className="min-w-0">
                    <Link href={`/jobs/${job.id}`} className="text-sm font-medium hover:underline">
                      {job.title}
                    </Link>
                    {job.isDemo ? <span className="ml-2 text-[10px] uppercase text-muted-foreground">Demo</span> : null}
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {job.company.name} · {job.location ?? '—'} · {remoteLabel(job.remoteType)} · {formatSalary(job.salaryMin, job.salaryMax, job.currency ?? 'USD')} · {job.source.name} · {formatDate(job.postedAt)}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(match?.matchedSkills ?? job.skills.map((s) => s.skill.name)).slice(0, 6).map((skill) => (
                        <span key={skill} className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-400">{skill}</span>
                      ))}
                      {(match?.missingRequiredSkills ?? []).slice(0, 4).map((skill) => (
                        <span key={skill} className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{skill}</span>
                      ))}
                      <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {job.applicationEmail ? 'Email apply' : 'Manual application required'}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button asChild size="sm" variant="outline"><Link href={`/jobs/${job.id}`}>View</Link></Button>
                    <Button size="sm" variant="ghost" onClick={() => archive.mutate(job.id)}>Analyze</Button>
                    {job.applicationUrl ? (
                      <Button asChild size="sm" variant="ghost"><a href={job.applicationUrl} target="_blank" rel="noreferrer">Open</a></Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
        </div>
      )}
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>{jobs.data?.total ?? 0} jobs</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <Button size="sm" variant="outline" onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>
    </div>
  );
}
