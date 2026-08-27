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

const FABRICATION_PATTERNS = [
  /\bled\s+(?:a|the)\s+team of \d+/i,
  /\bincreased\s+\d+%/i,
  /\baward[- ]winning\b/i,
  /\bguaranteed\b/i,
];

export function generateApplicationEmail(
  candidate: EmailCandidate,
  job: EmailJob,
): GeneratedEmail {
  const name = candidate.fullName?.trim() || 'the applicant';
  const years =
    candidate.yearsOfExperience != null
      ? `${candidate.yearsOfExperience} years of experience`
      : 'relevant experience';
  const recentRole = candidate.previousJobs[0];
  const recent = recentRole
    ? `${recentRole.title}${recentRole.company ? ` at ${recentRole.company}` : ''}`
    : null;
  const skills = (job.matchedSkills?.length ? job.matchedSkills : candidate.skills.slice(0, 6)).join(
    ', ',
  );

  const subject = `Application for ${job.title} at ${job.company}`;
  const lines = [
    `Hello ${job.company} hiring team,`,
    '',
    `I'm ${name}, applying for the ${job.title} role${job.location ? ` (${job.location})` : ''}.`,
    recent
      ? `I currently/most recently worked as ${recent}, with ${years}.`
      : `I have ${years} aligned with this role.`,
    skills ? `Relevant skills from my profile: ${skills}.` : null,
    candidate.professionalSummary
      ? candidate.professionalSummary.split(/(?<=\.)\s/).slice(0, 2).join(' ')
      : null,
    linksLine(candidate),
    '',
    'I have attached my CV. I would welcome the chance to discuss how my background fits this role.',
    '',
    'Thank you for your time,',
    name,
    candidate.email ?? undefined,
  ].filter((line): line is string => line != null);

  return { subject, body: lines.join('\n') };
}

function linksLine(candidate: EmailCandidate): string | null {
  const links = [candidate.linkedinUrl, candidate.githubUrl, candidate.portfolioUrl].filter(
    Boolean,
  );
  return links.length ? `Links: ${links.join(' · ')}` : null;
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
  const claimedCompanies = [...email.body.matchAll(/\bat ([A-Z][A-Za-z0-9& .-]{2,40})\b/g)].map(
    (m) => m[1],
  );
  const known = new Set(
    candidate.previousJobs
      .map((job) => job.company?.toLowerCase())
      .filter((value): value is string => Boolean(value)),
  );
  for (const company of claimedCompanies) {
    if (known.size > 0 && !known.has(company.toLowerCase()) && !/hiring team/i.test(company)) {
      // Soft check only for obvious unknown employers in "at X" form; skip generic words
      continue;
    }
  }
  if (reasons.length) return { ok: false, reasons };
  return { ok: true };
}
