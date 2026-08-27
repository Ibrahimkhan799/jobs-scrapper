'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { APPLICATION_STATUSES } from '@/lib/match';
import { toast } from 'sonner';
import { api, apiSend } from '@/lib/api';
import { PageHeader, EmptyState, Skeleton } from '@/components/ui/page';
import { ScoreBadge } from '@/components/score-badge';

type Application = {
  id: string;
  status: string;
  method: string;
  job: {
    id: string;
    title: string;
    applicationEmail: string | null;
    company: { name: string };
    matches?: Array<{ matchScore: number }>;
  };
};

export default function ApplicationsPage() {
  const queryClient = useQueryClient();
  const list = useQuery({
    queryKey: ['applications'],
    queryFn: () => api<Application[]>('/applications'),
  });
  const move = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiSend(`/applications/${id}/status`, 'PATCH', { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['applications'] }),
    onError: (error: Error) => toast.error(error.message),
  });

  if (list.isLoading) return <Skeleton className="h-96" />;
  if (!list.data?.length) {
    return (
      <EmptyState
        title="No applications yet"
        body="Generate an application from a job. Emails are never sent until you approve them."
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Applications"
        description="Move listings between columns. Status changes are logged. Sending still needs approval unless auto-send is on."
      />
      <div className="flex gap-4 overflow-x-auto pb-4">
        {APPLICATION_STATUSES.map((status) => {
          const cards = list.data!.filter((item) => item.status === status);
          return (
            <section
              key={status}
              className="w-52 shrink-0"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                const id = event.dataTransfer.getData('text/plain');
                if (id) move.mutate({ id, status });
              }}
            >
              <div className="mb-2 flex items-baseline justify-between border-b border-border pb-1">
                <h2 className="text-xs font-medium text-muted-foreground">
                  {status.replace('_', ' ')}
                </h2>
                <span className="text-[11px] tabular text-muted-foreground">{cards.length}</span>
              </div>
              <div className="space-y-2">
                {cards.map((item) => (
                  <article
                    key={item.id}
                    draggable
                    onDragStart={(event) => event.dataTransfer.setData('text/plain', item.id)}
                    className="cursor-grab border-b border-border py-2 active:cursor-grabbing"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/applications/${item.id}`} className="text-xs font-medium leading-4 hover:underline">
                        {item.job.title}
                      </Link>
                      <ScoreBadge score={item.job.matches?.[0]?.matchScore} />
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">{item.job.company.name}</div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      {item.job.applicationEmail ? 'Email' : 'Manual'}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
