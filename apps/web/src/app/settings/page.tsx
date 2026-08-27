'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiSend } from '@/lib/api';
import { PageHeader, Skeleton } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/forms';

type SettingsResponse = {
  settings: {
    allowAutomatedSending: boolean;
    dailyApplicationLimit: number;
    discoveryIntervalHours: number;
    minMatchScore: number;
    followUpAfterDays: number;
  } | null;
  emailAccounts: Array<{
    id: string;
    provider: string;
    host: string;
    fromEmail: string;
    enabled: boolean;
  }>;
};

type Source = {
  id: string;
  sourceKey: string;
  name: string;
  description: string | null;
  enabled: boolean;
  lastError: string | null;
  implemented: boolean;
};

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: () => api<SettingsResponse>('/settings'),
  });
  const sources = useQuery({
    queryKey: ['sources'],
    queryFn: () => api<Source[]>('/sources'),
  });

  const save = useMutation({
    mutationFn: (body: unknown) => apiSend('/settings', 'PUT', body),
    onSuccess: () => {
      toast.success('Settings saved');
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const addAccount = useMutation({
    mutationFn: (body: unknown) => apiSend('/email-accounts', 'POST', body),
    onSuccess: () => {
      toast.success('SMTP account stored locally. Password is never sent to the browser after save.');
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const toggleSource = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      apiSend(`/sources/${id}`, 'PATCH', { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sources'] }),
  });
  const testSource = useMutation({
    mutationFn: (id: string) => apiSend<{ ok: boolean; message: string }>(`/sources/${id}/test`, 'POST'),
    onSuccess: (result) => toast[result.ok ? 'success' : 'error'](result.message),
    onError: (error: Error) => toast.error(error.message),
  });

  if (settings.isLoading || sources.isLoading) return <Skeleton className="h-96" />;
  const current = settings.data?.settings;

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Automated sending is off unless you turn it on. SMTP passwords are never returned by the API."
      />
      <form
        className="mb-8 grid max-w-xl gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          save.mutate({
            allowAutomatedSending: form.get('allowAutomatedSending') === 'on',
            dailyApplicationLimit: Number(form.get('dailyApplicationLimit')),
            discoveryIntervalHours: Number(form.get('discoveryIntervalHours')),
            minMatchScore: Number(form.get('minMatchScore')),
            followUpAfterDays: Number(form.get('followUpAfterDays')),
          });
        }}
      >
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="allowAutomatedSending" defaultChecked={current?.allowAutomatedSending} />
          Allow automated email sending
        </label>
        <Field name="dailyApplicationLimit" label="Daily application limit" defaultValue={current?.dailyApplicationLimit ?? 10} />
        <Field name="discoveryIntervalHours" label="Discovery interval (hours)" defaultValue={current?.discoveryIntervalHours ?? 12} />
        <Field name="minMatchScore" label="Default minimum Match Score" defaultValue={current?.minMatchScore ?? 80} />
        <Field name="followUpAfterDays" label="Follow-up reminder after days" defaultValue={current?.followUpAfterDays ?? 7} />
        <Button type="submit">Save settings</Button>
      </form>

      <h2 className="mb-2 text-sm font-medium">Email accounts</h2>
      <div className="mb-4 space-y-2">
        {settings.data?.emailAccounts.map((account) => (
          <div key={account.id} className="rounded-md border border-border px-3 py-2 text-sm">
            {account.provider} · {account.fromEmail} · {account.host} {account.enabled ? '' : '(disabled)'}
          </div>
        ))}
      </div>
      <form
        className="mb-8 grid max-w-xl gap-3 rounded-md border border-border p-3 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          addAccount.mutate({
            provider: form.get('provider'),
            host: form.get('host'),
            port: Number(form.get('port') || 587),
            username: form.get('username'),
            password: form.get('password'),
            fromEmail: form.get('fromEmail'),
            secure: form.get('secure') === 'on',
          });
          event.currentTarget.reset();
        }}
      >
        <div>
          <Label>Provider</Label>
          <select name="provider" className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-sm">
            <option value="smtp">SMTP</option>
            <option value="gmail">Gmail</option>
            <option value="outlook">Outlook</option>
          </select>
        </div>
        <Field name="host" label="Host" placeholder="smtp.example.com" />
        <Field name="port" label="Port" placeholder="587" />
        <Field name="username" label="Username" />
        <Field name="password" label="Password" type="password" />
        <Field name="fromEmail" label="From email" />
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input type="checkbox" name="secure" />
          Use TLS (port 465)
        </label>
        <div className="md:col-span-2">
          <Button type="submit">Add SMTP account</Button>
        </div>
      </form>

      <h2 className="mb-2 text-sm font-medium">Job sources</h2>
      <div className="space-y-2">
        {sources.data?.map((source) => (
          <div key={source.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
            <div>
              <div className="text-sm font-medium">{source.name}</div>
              <div className="text-xs text-muted-foreground">{source.description}</div>
              {source.lastError ? <div className="text-xs text-danger">{source.lastError}</div> : null}
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => testSource.mutate(source.sourceKey)} disabled={!source.implemented}>
                Test
              </Button>
              <Button
                size="sm"
                variant={source.enabled ? 'secondary' : 'outline'}
                onClick={() => toggleSource.mutate({ id: source.id, enabled: !source.enabled })}
              >
                {source.enabled ? 'Enabled' : 'Disabled'}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({
  name,
  label,
  defaultValue,
  placeholder,
  type = 'text',
}: {
  name: string;
  label: string;
  defaultValue?: string | number;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input className="mt-1" name={name} type={type} defaultValue={defaultValue} placeholder={placeholder} />
    </div>
  );
}
