'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiSend } from '@/lib/api';
import { PageHeader, Skeleton } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/forms';
import { ScoreBadge } from '@/components/score-badge';

type Application = {
  id: string;
  status: string;
  method: string;
  recipientEmail: string | null;
  generatedSubject: string | null;
  generatedBody: string | null;
  editedSubject: string | null;
  editedBody: string | null;
  attachCv: boolean;
  job: {
    id: string;
    title: string;
    applicationUrl: string | null;
    applicationEmail: string | null;
    company: { name: string };
    matches: Array<{ matchScore: number }>;
  };
  emails: Array<{ id: string; status: string; recipient: string; sentAt: string | null; error: string | null }>;
};

export default function ApplicationReviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['application', params.id],
    queryFn: () => api<Application>(`/applications/${params.id}`),
  });
  const [subject, setSubject] = useState<string | null>(null);
  const [body, setBody] = useState<string | null>(null);
  const [recipient, setRecipient] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  const draftPayload = () => ({
    subject: subject ?? query.data?.editedSubject ?? query.data?.generatedSubject,
    body: body ?? query.data?.editedBody ?? query.data?.generatedBody,
    recipientEmail: recipient === null ? query.data?.recipientEmail : recipient || null,
  });

  const saveDraft = useMutation({
    mutationFn: () => apiSend(`/applications/${params.id}/draft`, 'PATCH', draftPayload()),
    onSuccess: () => {
      toast.success('Draft saved. You can keep editing — no AI required.');
      queryClient.invalidateQueries({ queryKey: ['application', params.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const save = useMutation({
    mutationFn: () => apiSend(`/applications/${params.id}/approve`, 'POST', draftPayload()),
    onSuccess: () => {
      toast.success('Approved. Email is not sent until you click Send unless auto-send is on.');
      queryClient.invalidateQueries({ queryKey: ['application', params.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const send = useMutation({
    mutationFn: async () => {
      await apiSend(`/applications/${params.id}/approve`, 'POST', draftPayload());
      return apiSend(`/applications/${params.id}/send`, 'POST');
    },
    onSuccess: () => {
      toast.success('Application sent.');
      setConfirm(false);
      queryClient.invalidateQueries();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (query.isLoading) return <Skeleton className="h-96" />;
  if (!query.data) return <p className="text-sm text-danger">Application not found.</p>;
  const app = query.data;
  const sub = subject ?? app.editedSubject ?? app.generatedSubject ?? '';
  const text = body ?? app.editedBody ?? app.generatedBody ?? '';
  const to = recipient ?? app.recipientEmail ?? '';
  const score = app.job.matches[0]?.matchScore;

  return (
    <div>
      <PageHeader
        title="Review application"
        description={`${app.job.title} · ${app.job.company.name}. Edit the email even if no AI is configured.`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button variant="ghost" onClick={() => saveDraft.mutate()} disabled={saveDraft.isPending}>
              Save edits
            </Button>
            <Button variant="secondary" onClick={() => save.mutate()} disabled={save.isPending}>
              Approve
            </Button>
            <Button onClick={() => setConfirm(true)} disabled={!to}>
              Approve & Send
            </Button>
          </div>
        }
      />
      {!app.recipientEmail ? (
        <div className="mb-4 border border-border p-3 text-sm">
          <div className="font-medium">Manual application required</div>
          <p className="mt-1 text-xs text-muted-foreground">No recruiting email was found. Use the job application URL.</p>
          {app.job.applicationUrl ? (
            <Button asChild className="mt-2" size="sm">
              <a href={app.job.applicationUrl} target="_blank" rel="noreferrer">Open application</a>
            </Button>
          ) : null}
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        <div className="space-y-3">
          <div>
            <Label>Recipient</Label>
            <Input value={to} onChange={(e) => setRecipient(e.target.value)} placeholder="recruiter@company.com" />
          </div>
          <div>
            <Label>Subject</Label>
            <Input value={sub} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <Label>Body</Label>
            <Textarea value={text} onChange={(e) => setBody(e.target.value)} className="min-h-72 font-mono text-[13px]" />
          </div>
        </div>
        <aside className="space-y-3">
          <div className="border border-border p-3">
            <div className="mb-2 flex items-center gap-2">
              <ScoreBadge score={score} />
              <span className="text-xs text-muted-foreground">Job Match Score</span>
            </div>
            <div className="text-sm font-medium">{app.job.title}</div>
            <div className="text-xs text-muted-foreground">{app.job.company.name}</div>
            <div className="mt-2 text-xs">Status: {app.status}</div>
            <div className="text-xs">CV attachment: {app.attachCv ? 'Yes' : 'No'}</div>
          </div>
          {app.emails.map((email) => (
            <div key={email.id} className="border border-border p-3 text-xs">
              <div>{email.status} → {email.recipient}</div>
              {email.error ? <div className="text-danger">{email.error}</div> : null}
            </div>
          ))}
        </aside>
      </div>
      {confirm ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Send this email?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This sends a real email if SMTP is configured. Automated sending stays off unless you enable it in settings.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirm(false)}>Cancel</Button>
              <Button onClick={() => send.mutate()} disabled={send.isPending}>
                {send.isPending ? 'Sending…' : 'Send'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
