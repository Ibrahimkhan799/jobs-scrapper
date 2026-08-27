'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiSend } from '@/lib/api';
import { PageHeader, Skeleton } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/forms';

type Preset = {
  id: string;
  label: string;
  baseUrl: string;
  defaultModel: string;
  needsKey: boolean;
  hint: string;
};

type SettingsResponse = {
  settings: {
    allowAutomatedSending: boolean;
    dailyApplicationLimit: number;
    discoveryIntervalHours: number;
    minMatchScore: number;
    followUpAfterDays: number;
    emailTemplateSubject: string | null;
    emailTemplateBody: string | null;
    activeAiCredentialId: string | null;
  } | null;
  emailAccounts: Array<{
    id: string;
    provider: string;
    host: string;
    fromEmail: string;
    enabled: boolean;
  }>;
  aiCredentials: Array<{
    id: string;
    provider: string;
    label: string;
    apiKey: string | null;
    baseUrl: string | null;
    model: string | null;
    enabled: boolean;
    lastError: string | null;
  }>;
  aiStatus: { id: string; available: boolean; mode: string; message: string };
  aiPresets: Preset[];
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
      toast.success('SMTP account stored. Password is never returned to the browser.');
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const addAi = useMutation({
    mutationFn: (body: unknown) => apiSend('/ai-credentials', 'POST', body),
    onSuccess: () => {
      toast.success('AI key saved. The full key is never shown again.');
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const activateAi = useMutation({
    mutationFn: (id: string) => apiSend(`/ai-credentials/${id}/activate`, 'POST'),
    onSuccess: () => {
      toast.success('Active AI provider updated');
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
  const testAi = useMutation({
    mutationFn: (id: string) => apiSend<{ ok: boolean; message: string }>(`/ai-credentials/${id}/test`, 'POST'),
    onSuccess: (result) => toast[result.ok ? 'success' : 'error'](result.message),
    onError: (error: Error) => toast.error(error.message),
  });
  const deleteAi = useMutation({
    mutationFn: (id: string) => apiSend(`/ai-credentials/${id}`, 'DELETE'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
  });
  const autoSend = useMutation({
    mutationFn: () => apiSend<{ sent: number; skipped: number; reason?: string }>('/applications/auto-send', 'POST'),
    onSuccess: (result) =>
      toast.success(`Auto-send finished. Sent ${result.sent}. Skipped ${result.skipped}.`),
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
  const activeId = current?.activeAiCredentialId;

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Auto-send is off until you enable it. API keys stay on the server and are never sent back in full."
      />

      <section className="mb-8 max-w-xl rounded-md border border-border p-4">
        <h2 className="text-sm font-medium">Automated sending</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          When this is on, applications that meet your minimum Match Score and have a recruiting email
          can be sent without a second click — still capped by the daily limit, and only if SMTP is configured.
        </p>
        <form
          className="mt-4 grid gap-3"
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
          <label className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
            <input
              type="checkbox"
              name="allowAutomatedSending"
              className="mt-0.5"
              defaultChecked={current?.allowAutomatedSending}
            />
            <span>
              <span className="font-medium">Allow auto-send</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Off by default. You are responsible for SMTP and for the messages that go out.
              </span>
            </span>
          </label>
          <Field name="dailyApplicationLimit" label="Daily application limit" defaultValue={current?.dailyApplicationLimit ?? 10} />
          <Field name="minMatchScore" label="Minimum Match Score to auto-send" defaultValue={current?.minMatchScore ?? 80} />
          <Field name="discoveryIntervalHours" label="Discovery interval (hours)" defaultValue={current?.discoveryIntervalHours ?? 12} />
          <Field name="followUpAfterDays" label="Follow-up reminder after days" defaultValue={current?.followUpAfterDays ?? 7} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit">Save sending settings</Button>
            <Button
              type="button"
              variant="outline"
              disabled={!current?.allowAutomatedSending || autoSend.isPending}
              onClick={() => autoSend.mutate()}
            >
              {autoSend.isPending ? 'Sending…' : 'Run auto-send now'}
            </Button>
          </div>
        </form>
      </section>

      <section className="mb-8 max-w-2xl">
        <h2 className="mb-1 text-sm font-medium">AI providers</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          {settings.data?.aiStatus.message} Add Grok, Groq, OpenRouter, Together, OpenAI, Gemini, Ollama, or any OpenAI-compatible endpoint.
        </p>
        <div className="mb-3 space-y-2">
          {settings.data?.aiCredentials.map((cred) => (
            <div key={cred.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
              <div>
                <div className="text-sm font-medium">
                  {cred.label}{' '}
                  {activeId === cred.id ? (
                    <span className="text-[10px] uppercase text-accent">Active</span>
                  ) : null}
                </div>
                <div className="text-xs text-muted-foreground">
                  {cred.provider} · {cred.model || 'default model'} · {cred.apiKey ?? 'no key'}
                </div>
                {cred.lastError ? <div className="text-xs text-danger">{cred.lastError}</div> : null}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => testAi.mutate(cred.id)}>Test</Button>
                <Button size="sm" variant="secondary" onClick={() => activateAi.mutate(cred.id)}>Use</Button>
                <Button size="sm" variant="ghost" onClick={() => deleteAi.mutate(cred.id)}>Remove</Button>
              </div>
            </div>
          ))}
        </div>
        <form
          className="grid gap-3 rounded-md border border-border p-3 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const provider = String(form.get('provider'));
            const preset = settings.data?.aiPresets.find((item) => item.id === provider);
            addAi.mutate({
              provider,
              label: form.get('label') || preset?.label || provider,
              apiKey: form.get('apiKey'),
              baseUrl: form.get('baseUrl') || preset?.baseUrl,
              model: form.get('model') || preset?.defaultModel,
              enabled: true,
            });
            event.currentTarget.reset();
          }}
        >
          <div>
            <Label>Service</Label>
            <select name="provider" className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-sm" defaultValue="grok">
              {settings.data?.aiPresets.map((preset) => (
                <option key={preset.id} value={preset.id}>{preset.label}</option>
              ))}
            </select>
          </div>
          <Field name="label" label="Label" placeholder="Personal Grok key" />
          <Field name="apiKey" label="API key" type="password" placeholder="Paste key — stored locally" />
          <Field name="baseUrl" label="Base URL (optional)" placeholder="https://api.x.ai/v1" />
          <Field name="model" label="Model (optional)" placeholder="grok-2-latest" />
          <p className="md:col-span-2 text-[11px] text-muted-foreground">
            Leave Base URL empty to use the preset. Custom OpenAI-compatible services only need a key, base URL ending in /v1, and a model name.
          </p>
          <div className="md:col-span-2">
            <Button type="submit">Save API key</Button>
          </div>
        </form>
      </section>

      <section className="mb-8 max-w-2xl">
        <h2 className="mb-1 text-sm font-medium">Application email template</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Used when no AI is configured, and as a fallback if AI fails. Edit any generated email before sending.
          Placeholders: {'{{fullName}} {{jobTitle}} {{company}} {{location}} {{skills}} {{years}} {{summary}} {{links}} {{email}}'}
        </p>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            save.mutate({
              emailTemplateSubject: form.get('emailTemplateSubject'),
              emailTemplateBody: form.get('emailTemplateBody'),
            });
          }}
        >
          <div>
            <Label>Subject</Label>
            <Input
              className="mt-1"
              name="emailTemplateSubject"
              defaultValue={current?.emailTemplateSubject ?? ''}
            />
          </div>
          <div>
            <Label>Body</Label>
            <Textarea
              className="mt-1 min-h-56 font-mono text-[13px]"
              name="emailTemplateBody"
              defaultValue={current?.emailTemplateBody ?? ''}
            />
          </div>
          <Button type="submit">Save template</Button>
        </form>
      </section>

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
      <p className="mb-3 max-w-2xl text-xs text-muted-foreground">
        LinkedIn and Indeed are not scraped. Those sites block automation, require login, and their terms
        prohibit scraping. This app only uses public APIs and feeds you enable: Remotive, RemoteOK, Arbeitnow,
        RSS, and Greenhouse boards.
      </p>
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
