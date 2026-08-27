'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiSend } from '@/lib/api';
import { formatDate, formatSalary, remoteLabel } from '@/lib/utils';
import { PageHeader, Skeleton } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { ScoreBadge } from '@/components/score-badge';

type JobDetail = {
  id: string;
  title: string;
  location: string | null;
  remoteType: string;
  employmentType: string;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  description: string;
  descriptionText: string;
  requirements: string[] | null;
  niceToHave: string[] | null;
  experienceRequired: string | null;
  educationRequired: string | null;
  applicationUrl: string | null;
  applicationEmail: string | null;
  postedAt: string | null;
  originalUrl: string;
  isDemo: boolean;
  company: { name: string; website: string | null };
  source: { name: string };
  skills: Array<{ skill: { name: string } }>;
  matches: Array<{
    matchScore: number;
    recommendation: string;
    skillMatch: number;
    experienceMatch: number;
    roleMatch: number;
    locationMatch: number;
    seniorityMatch: number;
    salaryMatch: number;
    educationMatch: number;
    matchedSkills: string[];
    missingRequiredSkills: string[];
    concerns: string[];
    reasoning: string;
  }>;
  applications: Array<{ id: string; status: string }>;
};

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
        <span>{label}</span>
        <span className="tabular">{value}</span>
      </div>
      <div className="h-1 overflow-hidden bg-muted">
        <div className="h-full bg-score" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const job = useQuery({
    queryKey: ['job', params.id],
    queryFn: () => api<JobDetail>(`/jobs/${params.id}`),
  });
  const analyze = useMutation({
    mutationFn: () => apiSend(`/jobs/${params.id}/analyze`, 'POST'),
    onSuccess: () => {
      toast.success('Match analysis updated');
      queryClient.invalidateQueries({ queryKey: ['job', params.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const generate = useMutation({
    mutationFn: () => apiSend<{ id: string }>(`/jobs/${params.id}/generate-application`, 'POST'),
    onSuccess: (app) => {
      toast.success('Application draft ready for review');
      queryClient.invalidateQueries();
      router.push(`/applications/${app.id}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (job.isLoading) return <Skeleton className="h-96" />;
  if (!job.data) return <p className="text-sm text-danger">Job not found.</p>;
  const match = job.data.matches[0];
  const reqs = job.data.requirements ?? [];
  const nice = job.data.niceToHave ?? [];

  return (
    <div>
      <PageHeader
        title={job.data.title}
        description={`${job.data.company.name} · ${job.data.location ?? '—'} · ${remoteLabel(job.data.remoteType)}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => analyze.mutate()} disabled={analyze.isPending}>
              Analyze
            </Button>
            <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
              Generate application
            </Button>
          </div>
        }
      />
      {job.data.isDemo ? (
        <p className="mb-4 border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
          Seeded demo listing. Not a real job opening.
        </p>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-5">
          <section className="border border-border p-4">
            <div className="mb-3 flex items-center gap-3">
              <ScoreBadge score={match?.matchScore} />
              <div>
                <div className="text-sm font-medium">{match?.recommendation?.replace('_', ' ') ?? 'Not analyzed'}</div>
                <div className="text-xs text-muted-foreground">Job Match Score — not a hiring probability</div>
              </div>
            </div>
            {match ? (
              <div className="grid gap-3 md:grid-cols-2">
                <Bar label="Skills" value={match.skillMatch} />
                <Bar label="Experience" value={match.experienceMatch} />
                <Bar label="Role" value={match.roleMatch} />
                <Bar label="Location" value={match.locationMatch} />
                <Bar label="Seniority" value={match.seniorityMatch} />
                <Bar label="Salary" value={match.salaryMatch} />
              </div>
            ) : null}
            {match?.reasoning ? <p className="mt-3 text-sm text-muted-foreground">{match.reasoning}</p> : null}
            <div className="mt-3 flex flex-wrap gap-1">
              {match?.matchedSkills.map((s) => (
                <span key={s} className="text-[11px] text-score">{s}</span>
              ))}
              {match?.missingRequiredSkills.map((s) => (
                <span key={s} className="text-[11px] text-muted-foreground">Missing {s}</span>
              ))}
            </div>
            {match?.concerns?.length ? (
              <ul className="mt-3 list-disc pl-4 text-xs text-muted-foreground">
                {match.concerns.map((c) => <li key={c}>{c}</li>)}
              </ul>
            ) : null}
          </section>
          <section>
            <h2 className="mb-2 text-sm font-medium">Description</h2>
            <div className="prose-job text-sm leading-6 text-foreground/90" dangerouslySetInnerHTML={{ __html: job.data.description }} />
          </section>
          {reqs.length ? (
            <section>
              <h2 className="mb-2 text-sm font-medium">Requirements</h2>
              <ul className="list-disc pl-5 text-sm">{reqs.map((r) => <li key={r}>{r}</li>)}</ul>
            </section>
          ) : null}
          {nice.length ? (
            <section>
              <h2 className="mb-2 text-sm font-medium">Nice to have</h2>
              <ul className="list-disc pl-5 text-sm">{nice.map((r) => <li key={r}>{r}</li>)}</ul>
            </section>
          ) : null}
        </div>
        <aside className="space-y-3">
          <div className="border border-border p-3 text-sm">
            <div className="text-xs text-muted-foreground">Salary</div>
            <div>{formatSalary(job.data.salaryMin, job.data.salaryMax, job.data.currency ?? 'USD')}</div>
            <div className="mt-2 text-xs text-muted-foreground">Posted</div>
            <div>{formatDate(job.data.postedAt)}</div>
            <div className="mt-2 text-xs text-muted-foreground">Source</div>
            <div>{job.data.source.name}</div>
            <div className="mt-2 text-xs text-muted-foreground">Employment</div>
            <div>{job.data.employmentType.replace('_', ' ')}</div>
          </div>
          <div className="border border-border p-3">
            <div className="text-sm font-medium">Application</div>
            {job.data.applicationEmail ? (
              <p className="mt-1 text-xs text-muted-foreground">{job.data.applicationEmail}</p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">Manual application required</p>
            )}
            <div className="mt-3 flex flex-col gap-2">
              {job.data.applicationUrl ? (
                <Button asChild variant="outline" size="sm">
                  <a href={job.data.applicationUrl} target="_blank" rel="noreferrer">Open application</a>
                </Button>
              ) : null}
              {job.data.applications[0] ? (
                <Button asChild size="sm">
                  <Link href={`/applications/${job.data.applications[0].id}`}>Review application</Link>
                </Button>
              ) : null}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
