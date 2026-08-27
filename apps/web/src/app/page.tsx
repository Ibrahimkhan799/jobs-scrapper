'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiSend } from '@/lib/api';
import { formatDate, remoteLabel } from '@/lib/utils';
import { PageHeader, StatusStrip, Skeleton } from '@/components/ui/page';
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
  const ai = useQuery({
    queryKey: ['ai-status'],
    queryFn: () => api<{ message: string; mode: string }>('/ai/status'),
  });
  const search = useMutation({
    mutationFn: () => apiSend<{ created: number; updated: number }>('/jobs/search', 'POST', {}),
    onSuccess: (result: { created: number; updated: number }) => {
      toast.success(`Search finished. ${result.created} new, ${result.updated} updated.`);
      queryClient.invalidateQueries();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (dash.isLoading) {
    return <Skeleton className="h-64" />;
  }
  if (dash.error) {
    return <p className="text-sm text-danger">Could not load dashboard. Is the API running?</p>;
  }
  const m = dash.data!.metrics;
  return (
    <div>
      <PageHeader
        title="Today"
        description={`${ai.data?.message ?? 'Profile parsing and emails work without AI.'} Job Match Score is profile-to-job similarity, not a chance of being hired.`}
        actions={
          <Button onClick={() => search.mutate()} disabled={search.isPending}>
            {search.isPending ? 'Searching…' : 'Run search now'}
          </Button>
        }
      />
      <StatusStrip
        items={[
          { label: 'new', value: m.newJobs },
          { label: 'strong', value: m.strongMatches, hint: '80+' },
          { label: 'ready', value: m.readyToApply },
          { label: 'sent', value: m.applicationsSent },
          { label: 'replies', value: m.responses },
          { label: 'interviews', value: m.interviews },
          { label: 'offers', value: m.offers },
        ]}
      />
      <div className="mt-6">
        <h2 className="mb-2 text-sm font-medium">Listings</h2>
        <div className="border-t border-border">
          {dash.data!.recentJobs.map((job) => (
            <Link
              key={job.id}
              href={`/jobs/${job.id}`}
              className="grid grid-cols-[3.25rem_1fr_auto] items-baseline gap-3 border-b border-border py-2.5 hover:bg-muted/50"
            >
              <ScoreBadge score={job.matches?.[0]?.matchScore} />
              <div className="min-w-0">
                <div className="truncate text-sm">
                  {job.title}
                  {job.isDemo ? <span className="ml-2 text-[10px] uppercase text-muted-foreground">Demo</span> : null}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {job.company.name} · {job.location ?? '—'} · {remoteLabel(job.remoteType)}
                </div>
              </div>
              <div className="text-xs tabular text-muted-foreground">{formatDate(job.postedAt)}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
