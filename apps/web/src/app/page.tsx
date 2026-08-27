'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiSend } from '@/lib/api';
import { formatDate, remoteLabel } from '@/lib/utils';
import { PageHeader, Metric, Skeleton } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { ScoreBadge } from '@/components/score-badge';

type Dashboard = {
  metrics: {
    newJobs: number;
    strongMatches: number;
    readyToApply: number;
    applicationsSent: number;
    responses: number;
    interviews: number;
    offers: number;
  };
  recentJobs: Array<{
    id: string;
    title: string;
    location: string | null;
    remoteType: string;
    postedAt: string | null;
    isDemo: boolean;
    company: { name: string };
    matches?: Array<{ matchScore: number }>;
  }>;
};

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const dash = useQuery({ queryKey: ['dashboard'], queryFn: () => api<Dashboard>('/dashboard') });
  const search = useMutation({
    mutationFn: () => apiSend<{ created: number; updated: number }>('/jobs/search', 'POST', {}),
    onSuccess: (result: { created: number; updated: number }) => {
      toast.success(`Search finished. ${result.created} new, ${result.updated} updated.`);
      queryClient.invalidateQueries();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (dash.isLoading) {
    return (
      <div className="grid gap-3 md:grid-cols-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }
  if (dash.error) {
    return <p className="text-sm text-danger">Could not load dashboard. Is the API running?</p>;
  }
  const m = dash.data!.metrics;
  return (
    <div>
      <PageHeader
        title="Today"
        description="Job Match Score is profile-to-job similarity, not a chance of being hired."
        actions={
          <Button onClick={() => search.mutate()} disabled={search.isPending}>
            {search.isPending ? 'Searching…' : 'Run search now'}
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        <Metric label="New jobs" value={m.newJobs} />
        <Metric label="Strong matches" value={m.strongMatches} hint="Score 80+" />
        <Metric label="Ready to apply" value={m.readyToApply} />
        <Metric label="Applications sent" value={m.applicationsSent} />
        <Metric label="Responses" value={m.responses} />
        <Metric label="Interviews" value={m.interviews} />
        <Metric label="Offers" value={m.offers} />
      </div>
      <div className="mt-8">
        <h2 className="mb-3 text-sm font-medium">Recent jobs</h2>
        <div className="overflow-hidden rounded-md border border-border">
          {dash.data!.recentJobs.map((job) => (
            <Link
              key={job.id}
              href={`/jobs/${job.id}`}
              className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-0 hover:bg-muted/60"
            >
              <ScoreBadge score={job.matches?.[0]?.matchScore} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {job.title}
                  {job.isDemo ? (
                    <span className="ml-2 text-[10px] font-normal uppercase text-muted-foreground">
                      Demo
                    </span>
                  ) : null}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {job.company.name} · {job.location ?? '—'} · {remoteLabel(job.remoteType)}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">{formatDate(job.postedAt)}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
