'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiSend } from '@/lib/api';
import { PageHeader, EmptyState, Skeleton } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/forms';
import { Select } from '@/components/ui/select';

type SearchProfile = {
  id: string;
  name: string;
  targetTitles: string[];
  targetLocations: string[];
  salaryMin: number | null;
  salaryMax: number | null;
  minMatchScore: number;
  dailyApplicationLimit: number;
  allowAutomatedSending: boolean;
  discoveryIntervalHours: number;
  remotePreference: string;
  enabled: boolean;
  queries: Array<{ id: string; query: string; location: string | null }>;
};

export default function SearchPage() {
  const queryClient = useQueryClient();
  const list = useQuery({
    queryKey: ['search-profiles'],
    queryFn: () => api<SearchProfile[]>('/search-profiles'),
  });
  const create = useMutation({
    mutationFn: (body: unknown) => apiSend('/search-profiles', 'POST', body),
    onSuccess: () => {
      toast.success('Search profile saved');
      queryClient.invalidateQueries({ queryKey: ['search-profiles'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const run = useMutation({
    mutationFn: (id: string) => apiSend('/jobs/search', 'POST', { searchProfileId: id }),
    onSuccess: () => {
      toast.success('Discovery started');
      queryClient.invalidateQueries();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiSend(`/search-profiles/${id}`, 'DELETE'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['search-profiles'] }),
  });

  return (
    <div>
      <PageHeader
        title="Search profiles"
        description="Queries are generated from titles × locations, capped to avoid redundant searches. Automated sending defaults to off."
      />
      <form
        className="mb-6 grid gap-3 border border-border p-3 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          create.mutate({
            name: form.get('name'),
            targetTitles: String(form.get('targetTitles'))
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
            targetLocations: String(form.get('targetLocations'))
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
            salaryMin: form.get('salaryMin') ? Number(form.get('salaryMin')) : null,
            salaryMax: form.get('salaryMax') ? Number(form.get('salaryMax')) : null,
            minMatchScore: Number(form.get('minMatchScore') || 80),
            dailyApplicationLimit: Number(form.get('dailyApplicationLimit') || 10),
            allowAutomatedSending: form.get('allowAutomatedSending') === 'on',
            discoveryIntervalHours: Number(form.get('discoveryIntervalHours') || 12),
            remotePreference: form.get('remotePreference'),
            employmentTypes: ['FULL_TIME', 'CONTRACT'],
            enabled: true,
          });
        }}
      >
        <Field name="name" label="Name" placeholder="Frontend · GCC + Remote" />
        <div>
          <Label>Remote</Label>
          <Select
            name="remotePreference"
            className="mt-1"
            defaultValue="REMOTE"
            options={[
              { value: 'REMOTE', label: 'Remote' },
              { value: 'HYBRID', label: 'Hybrid' },
              { value: 'ONSITE', label: 'On-site' },
              { value: 'ANY', label: 'Any' },
            ]}
          />
        </div>
        <Field name="targetTitles" label="Target titles" placeholder="Frontend Developer, React Developer, Next.js Developer" />
        <Field name="targetLocations" label="Target locations" placeholder="Remote, Dubai, Riyadh, Doha, Abu Dhabi" />
        <Field name="salaryMin" label="Min salary" type="number" placeholder="80000" />
        <Field name="salaryMax" label="Max salary" type="number" placeholder="150000" />
        <Field name="minMatchScore" label="Minimum Match Score" type="number" placeholder="80" />
        <Field name="dailyApplicationLimit" label="Daily application limit" type="number" placeholder="10" />
        <Field name="discoveryIntervalHours" label="Discovery every N hours" type="number" placeholder="12" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="allowAutomatedSending" />
          Allow automated email sending (off unless checked)
        </label>
        <div className="md:col-span-2">
          <Button type="submit" disabled={create.isPending}>Create search profile</Button>
        </div>
      </form>
      {list.isLoading ? (
        <Skeleton className="h-40" />
      ) : !list.data?.length ? (
        <EmptyState title="No search profiles" body="Create one to generate queries and run discovery." />
      ) : (
        <div className="space-y-3">
          {list.data.map((profile) => (
            <article key={profile.id} className="border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium">{profile.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Min score {profile.minMatchScore} · Limit {profile.dailyApplicationLimit}/day · Every {profile.discoveryIntervalHours}h · Auto-send {profile.allowAutomatedSending ? 'ON' : 'OFF'}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => run.mutate(profile.id)} disabled={run.isPending}>Run now</Button>
                  <Button size="sm" variant="outline" onClick={() => remove.mutate(profile.id)}>Delete</Button>
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">{profile.targetTitles.join(' · ')}</div>
              <div className="mt-2 flex flex-wrap gap-1">
                {profile.queries.map((q) => (
                  <span key={q.id} className="bg-muted px-1.5 py-0.5 text-[11px]">{q.query}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Field(props: { name: string; label: string; placeholder?: string; type?: string }) {
  return (
    <div>
      <Label>{props.label}</Label>
      <Input className="mt-1" name={props.name} type={props.type ?? 'text'} placeholder={props.placeholder} />
    </div>
  );
}
