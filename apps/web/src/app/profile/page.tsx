'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiSend } from '@/lib/api';
import { PageHeader, EmptyState, Skeleton } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/forms';

type Profile = {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  yearsOfExperience: number | null;
  professionalSummary: string | null;
  preferredRoles: string[] | null;
  preferredLocations: string[] | null;
  remotePreference: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  workAuthorization: string | null;
  previousJobs: Array<{ title: string; company?: string | null }>;
  education: Array<{ degree?: string | null; field?: string | null; school?: string | null }>;
  skills: Array<{ skill: { name: string } }>;
};

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['candidate'],
    queryFn: () => api<{ profile: Profile | null }>('/candidate'),
  });
  const [file, setFile] = useState<File | null>(null);

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Choose a PDF or DOCX file');
      const data = new FormData();
      data.append('file', file);
      const response = await fetch('/api/resumes', { method: 'POST', body: data });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? 'Upload failed');
      return payload;
    },
    onSuccess: () => {
      toast.success('CV parsed. Only information found in the file was stored.');
      queryClient.invalidateQueries({ queryKey: ['candidate'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const save = useMutation({
    mutationFn: (body: unknown) => apiSend('/candidate', 'PUT', body),
    onSuccess: () => {
      toast.success('Profile saved');
      queryClient.invalidateQueries({ queryKey: ['candidate'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (query.isLoading) return <Skeleton className="h-96" />;
  const profile = query.data?.profile;

  return (
    <div>
      <PageHeader
        title="Candidate profile"
        description="Upload a CV. Parsing works without AI. Edit any field afterward — nothing is invented if it was not in the file."
      />
      <div className="mb-6 rounded-md border border-border p-3">
        <Label>Resume (PDF or DOCX)</Label>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Input type="file" accept=".pdf,.docx,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <Button onClick={() => upload.mutate()} disabled={upload.isPending}>
            {upload.isPending ? 'Parsing…' : 'Upload and parse'}
          </Button>
        </div>
      </div>
      {!profile ? (
        <EmptyState title="No profile yet" body="Upload a CV to create a structured candidate profile." />
      ) : (
        <form
          className="grid gap-3 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            save.mutate({
              fullName: form.get('fullName'),
              email: form.get('email'),
              phone: form.get('phone'),
              location: form.get('location'),
              yearsOfExperience: form.get('yearsOfExperience') ? Number(form.get('yearsOfExperience')) : null,
              professionalSummary: form.get('professionalSummary'),
              preferredRoles: String(form.get('preferredRoles') ?? '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
              preferredLocations: String(form.get('preferredLocations') ?? '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
              remotePreference: form.get('remotePreference'),
              salaryMin: form.get('salaryMin') ? Number(form.get('salaryMin')) : null,
              salaryMax: form.get('salaryMax') ? Number(form.get('salaryMax')) : null,
              githubUrl: form.get('githubUrl'),
              linkedinUrl: form.get('linkedinUrl'),
              portfolioUrl: form.get('portfolioUrl'),
              skills: String(form.get('skills') ?? '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            });
          }}
        >
          <Field name="fullName" label="Full name" defaultValue={profile.fullName} />
          <Field name="email" label="Email" defaultValue={profile.email} />
          <Field name="phone" label="Phone" defaultValue={profile.phone} />
          <Field name="location" label="Location" defaultValue={profile.location} />
          <Field name="yearsOfExperience" label="Years of experience" defaultValue={profile.yearsOfExperience} type="number" />
          <div>
            <Label>Remote preference</Label>
            <select name="remotePreference" defaultValue={profile.remotePreference} className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-sm">
              <option value="REMOTE">Remote</option>
              <option value="HYBRID">Hybrid</option>
              <option value="ONSITE">On-site</option>
              <option value="ANY">Any</option>
            </select>
          </div>
          <Field name="salaryMin" label="Salary min" defaultValue={profile.salaryMin} type="number" />
          <Field name="salaryMax" label="Salary max" defaultValue={profile.salaryMax} type="number" />
          <Field name="preferredRoles" label="Preferred roles (comma)" defaultValue={(profile.preferredRoles ?? []).join(', ')} />
          <Field name="preferredLocations" label="Preferred locations (comma)" defaultValue={(profile.preferredLocations ?? []).join(', ')} />
          <Field name="githubUrl" label="GitHub" defaultValue={profile.githubUrl} />
          <Field name="linkedinUrl" label="LinkedIn" defaultValue={profile.linkedinUrl} />
          <Field name="portfolioUrl" label="Portfolio" defaultValue={profile.portfolioUrl} />
          <Field name="skills" label="Skills (comma)" defaultValue={profile.skills.map((s) => s.skill.name).join(', ')} />
          <div className="md:col-span-2">
            <Label>Summary</Label>
            <Textarea name="professionalSummary" defaultValue={profile.professionalSummary ?? ''} className="mt-1" />
          </div>
          <div className="md:col-span-2 text-xs text-muted-foreground">
            Previous roles: {profile.previousJobs.map((j) => `${j.title}${j.company ? ` @ ${j.company}` : ''}`).join(' · ') || '—'}
          </div>
          <div className="md:col-span-2">
            <Button type="submit" disabled={save.isPending}>Save profile</Button>
          </div>
        </form>
      )}
    </div>
  );
}

function Field({
  name,
  label,
  defaultValue,
  type = 'text',
}: {
  name: string;
  label: string;
  defaultValue: string | number | null | undefined;
  type?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input className="mt-1" name={name} type={type} defaultValue={defaultValue ?? ''} />
    </div>
  );
}
