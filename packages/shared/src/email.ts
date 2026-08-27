export type GeneratedEmail = {
  subject: string;
  body: string;
};

export type EmailCandidate = {
  fullName?: string | null;
  email?: string | null;
  location?: string | null;
  yearsOfExperience?: number | null;
  professionalSummary?: string | null;
  skills: string[];
  previousJobs: Array<{ title: string; company?: string | null }>;
  githubUrl?: string | null;
  linkedinUrl?: string | null;
  portfolioUrl?: string | null;
};

export type EmailJob = {
  title: string;
  company: string;
  location?: string | null;
  matchedSkills?: string[];
};

export type EmailTemplate = {
  subject?: string | null;
  body?: string | null;
};

export const DEFAULT_EMAIL_SUBJECT = 'Application for {{jobTitle}} at {{company}}';

export const DEFAULT_EMAIL_BODY = `Hello {{company}} hiring team,

I'm {{fullName}}, applying for the {{jobTitle}} role{{locationSuffix}}.
{{recentLine}}
{{skillsLine}}
{{summary}}
{{links}}

I have attached my CV. I would welcome the chance to discuss how my background fits this role.

Thank you for your time,
{{fullName}}
{{email}}`;

const FABRICATION_PATTERNS = [
  /\bled\s+(?:a|the)\s+team of \d+/i,
  /\bincreased\s+\d+%/i,
  /\baward[- ]winning\b/i,
  /\bguaranteed\b/i,
];

export function emailTemplateVars(candidate: EmailCandidate, job: EmailJob): Record<string, string> {
  const name = candidate.fullName?.trim() || 'the applicant';
  const years =
    candidate.yearsOfExperience != null
      ? `${candidate.yearsOfExperience} years of experience`
      : 'relevant experience';
  const recentRole = candidate.previousJobs[0];
  const recent = recentRole
    ? `${recentRole.title}${recentRole.company ? ` at ${recentRole.company}` : ''}`
    : '';
  const skills = (job.matchedSkills?.length ? job.matchedSkills : candidate.skills.slice(0, 6)).join(
    ', ',
  );
  const links = [candidate.linkedinUrl, candidate.githubUrl, candidate.portfolioUrl]
    .filter(Boolean)
    .join(' · ');

  return {
    fullName: name,
    email: candidate.email ?? '',
    jobTitle: job.title,
    company: job.company,
    location: job.location ?? '',
    locationSuffix: job.location ? ` (${job.location})` : '',
    years,
    recentRole: recent,
    recentLine: recent ? `I currently/most recently worked as ${recent}, with ${years}.` : `I have ${years} aligned with this role.`,
    skills,
    skillsLine: skills ? `Relevant skills from my profile: ${skills}.` : '',
    summary: candidate.professionalSummary
      ? candidate.professionalSummary.split(/(?<=\.)\s/).slice(0, 2).join(' ')
      : '',
    links: links ? `Links: ${links}` : '',
    github: candidate.githubUrl ?? '',
    linkedin: candidate.linkedinUrl ?? '',
    portfolio: candidate.portfolioUrl ?? '',
  };
}

export function interpolateTemplate(template: string, vars: Record<string, string>): string {
  return template
    .replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => vars[key] ?? '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function applyEmailTemplate(
  template: EmailTemplate | null | undefined,
  candidate: EmailCandidate,
  job: EmailJob,
): GeneratedEmail {
  const vars = emailTemplateVars(candidate, job);
  return {
    subject: interpolateTemplate(template?.subject || DEFAULT_EMAIL_SUBJECT, vars),
    body: interpolateTemplate(template?.body || DEFAULT_EMAIL_BODY, vars),
  };
}

export function generateApplicationEmail(
  candidate: EmailCandidate,
  job: EmailJob,
  template?: EmailTemplate | null,
): GeneratedEmail {
  return applyEmailTemplate(template, candidate, job);
}

export function validateGeneratedEmail(
  email: GeneratedEmail,
  candidate: EmailCandidate,
): { ok: true } | { ok: false; reasons: string[] } {
  const reasons: string[] = [];
  if (!email.subject.trim()) reasons.push('Subject is empty');
  if (email.body.trim().length < 80) reasons.push('Body is too short');
  if (email.body.length > 4000) reasons.push('Body is too long');
  for (const pattern of FABRICATION_PATTERNS) {
    if (pattern.test(email.body) && !pattern.test(candidate.professionalSummary ?? '')) {
      reasons.push('Email appears to invent achievements');
    }
  }
  if (reasons.length) return { ok: false, reasons };
  return { ok: true };
}
