import type { EmploymentType, RemoteType } from './constants.js';
import { canonicalizeUrl, companySlug, jobFingerprint } from './dedupe.js';
import { inferRemoteType, normalizeLocation } from './locations.js';
import { parseSalary } from './salary.js';
import { extractSkillsFromText, normalizeSkillName } from './skills.js';
import { normalizeTitle, parseRequiredYears } from './titles.js';

export type RawJob = {
  source: string;
  sourceJobId: string;
  title: string;
  company: string;
  companyUrl?: string | null;
  location?: string | null;
  remoteType?: RemoteType | string | null;
  employmentType?: EmploymentType | string | null;
  salary?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  currency?: string | null;
  description?: string | null;
  requirements?: string[] | null;
  niceToHave?: string[] | null;
  skills?: string[] | null;
  experienceRequired?: string | null;
  educationRequired?: string | null;
  applicationUrl?: string | null;
  applicationEmail?: string | null;
  postedAt?: string | Date | null;
  originalUrl: string;
};

export type NormalizedJob = {
  title: string;
  normalizedTitle: string;
  company: string;
  companySlug: string;
  companyUrl: string | null;
  location: string | null;
  normalizedLocation: string | null;
  remoteType: RemoteType;
  employmentType: EmploymentType;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  description: string;
  descriptionText: string;
  requirements: string[];
  niceToHave: string[];
  skills: string[];
  experienceRequired: string | null;
  educationRequired: string | null;
  applicationUrl: string | null;
  applicationEmail: string | null;
  postedAt: Date | null;
  source: string;
  sourceJobId: string;
  originalUrl: string;
  canonicalUrl: string | null;
  fingerprint: string;
};

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseEmploymentType(raw: string | null | undefined): EmploymentType {
  if (!raw) return 'UNKNOWN';
  const value = raw.toLowerCase().replace(/[_-]/g, ' ');
  if (value.includes('full')) return 'FULL_TIME';
  if (value.includes('part')) return 'PART_TIME';
  if (value.includes('contract') || value.includes('freelance') || value.includes('temp')) {
    return 'CONTRACT';
  }
  if (value.includes('intern')) return 'INTERNSHIP';
  return 'UNKNOWN';
}

export function parsePostedAt(raw: string | Date | null | undefined): Date | null {
  if (!raw) return null;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function extractEmail(text: string): string | null {
  const match = text.match(
    /(?:mailto:)?([a-zA-Z0-9._%+-]+@(?:careers|jobs|recruiting|talent|hr|apply|people)[a-zA-Z0-9.-]*\.[a-zA-Z]{2,})/i,
  );
  if (match) return match[1].toLowerCase();
  const generic = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (!generic) return null;
  const email = generic[0].toLowerCase();
  if (/(noreply|no-reply|donotreply|example\.com|sentry|github\.com)/i.test(email)) return null;
  return email;
}

export function splitRequirementLines(text: string): { required: string[]; nice: string[] } {
  const required: string[] = [];
  const nice: string[] = [];
  const lines = text
    .split(/\n|•|\u2022|\- |\* /)
    .map((line) => line.trim())
    .filter((line) => line.length > 8 && line.length < 280);

  let bucket: 'required' | 'nice' | null = null;
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (/nice to have|bonus|preferred|plus/.test(lower)) {
      bucket = 'nice';
      continue;
    }
    if (/requirement|must have|you will|qualifications|what you/.test(lower)) {
      bucket = 'required';
      continue;
    }
    if (bucket === 'nice') nice.push(line);
    else if (bucket === 'required') required.push(line);
  }
  return { required: required.slice(0, 20), nice: nice.slice(0, 12) };
}

export function normalizeJob(raw: RawJob): NormalizedJob {
  const description = raw.description ?? '';
  const descriptionText = stripHtml(description);
  const salary =
    raw.salaryMin != null || raw.salaryMax != null
      ? {
          min: raw.salaryMin ?? null,
          max: raw.salaryMax ?? null,
          currency: raw.currency ?? null,
        }
      : parseSalary(raw.salary);

  const location = raw.location ? normalizeLocation(raw.location) : null;
  const remoteType =
    (raw.remoteType as RemoteType | undefined) &&
    ['REMOTE', 'HYBRID', 'ONSITE', 'ANY'].includes(String(raw.remoteType))
      ? (raw.remoteType as RemoteType)
      : inferRemoteType(raw.location, [descriptionText, raw.title]);

  const skillsFromList = (raw.skills ?? []).map(normalizeSkillName);
  const skillsFromText = extractSkillsFromText(`${raw.title} ${descriptionText}`);
  const skills = unique([...skillsFromList, ...skillsFromText]);

  const split = splitRequirementLines(descriptionText);
  const requirements = unique([...(raw.requirements ?? []), ...split.required]);
  const niceToHave = unique([...(raw.niceToHave ?? []), ...split.nice]);

  const applicationUrl = canonicalizeUrl(raw.applicationUrl ?? raw.originalUrl);
  const originalUrl = canonicalizeUrl(raw.originalUrl) ?? raw.originalUrl;
  const applicationEmail = raw.applicationEmail?.toLowerCase() ?? extractEmail(descriptionText);

  const title = raw.title.trim();
  const company = raw.company.trim();
  const normalizedTitle = normalizeTitle(title);
  const normalizedLocation = location ? normalizeLocation(location) : null;

  return {
    title,
    normalizedTitle,
    company,
    companySlug: companySlug(company),
    companyUrl: canonicalizeUrl(raw.companyUrl ?? null),
    location,
    normalizedLocation,
    remoteType,
    employmentType: parseEmploymentType(raw.employmentType ?? descriptionText),
    salaryMin: salary.min,
    salaryMax: salary.max,
    currency: salary.currency ?? raw.currency ?? null,
    description,
    descriptionText,
    requirements,
    niceToHave,
    skills,
    experienceRequired: raw.experienceRequired ?? yearsHint(descriptionText),
    educationRequired: raw.educationRequired ?? educationHint(descriptionText),
    applicationUrl,
    applicationEmail,
    postedAt: parsePostedAt(raw.postedAt),
    source: raw.source,
    sourceJobId: String(raw.sourceJobId),
    originalUrl,
    canonicalUrl: canonicalizeUrl(originalUrl),
    fingerprint: jobFingerprint({
      company,
      title: normalizedTitle,
      location: normalizedLocation,
    }),
  };
}

function yearsHint(text: string): string | null {
  const years = parseRequiredYears(text);
  return years != null ? `${years} years` : null;
}

function educationHint(text: string): string | null {
  if (/\b(bachelor|master|phd|degree|b\.?s\.?|m\.?s\.?|computer science)\b/i.test(text)) {
    const match = text.match(
      /\b((?:bachelor|master|phd|b\.?s\.?|m\.?s\.?)[^.]{0,80}(?:degree)?)/i,
    );
    return match ? match[1].trim() : 'Degree mentioned';
  }
  return null;
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (!value.trim() || seen.has(key)) continue;
    seen.add(key);
    result.push(value.trim());
  }
  return result;
}
