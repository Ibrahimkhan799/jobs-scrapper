import type { ZodType } from 'zod';
import {
  extractContactFromText,
  extractSkillsFromText,
  type ExtractedProfile,
} from '@job-hunter/shared';
import type { AiProvider } from './types.js';
import { parseJsonFromModel } from './types.js';

export class HeuristicProvider implements AiProvider {
  id = 'heuristic';

  async available() {
    return true;
  }

  async completeJson<T>(prompt: string, schema: ZodType<T>): Promise<T> {
    if (prompt.includes('Extract a structured professional profile')) {
      const cv = prompt.split('CV:')[1] ?? prompt;
      return schema.parse(heuristicProfile(cv)) as T;
    }
    throw new Error('Heuristic provider cannot complete this prompt');
  }
}

export function heuristicProfile(cvText: string): ExtractedProfile {
  const contact = extractContactFromText(cvText);
  const skills = extractSkillsFromText(cvText);
  const previousJobs = extractJobs(cvText);
  return {
    fullName: contact.fullName,
    email: contact.email,
    phone: contact.phone,
    location: extractLocation(cvText),
    yearsOfExperience: contact.yearsOfExperience,
    professionalSummary: extractSummary(cvText),
    skills,
    technologies: skills,
    previousJobs,
    education: extractEducation(cvText),
    certifications: [],
    preferredRoles: previousJobs[0]?.title ? [previousJobs[0].title] : [],
    preferredLocations: [],
    remotePreference: /\bremote\b/i.test(cvText) ? 'REMOTE' : null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    workAuthorization: null,
    portfolioUrl: contact.portfolioUrl,
    githubUrl: contact.githubUrl,
    linkedinUrl: contact.linkedinUrl,
  };
}

function extractSummary(text: string): string | null {
  const block = text.split('\n\n')[0]?.trim();
  if (!block || block.length < 40) return null;
  return block.slice(0, 600);
}

function extractLocation(text: string): string | null {
  const match = text.match(
    /\b(Dubai|Riyadh|Doha|Abu Dhabi|London|Berlin|Remote|New York|San Francisco|Singapore|Toronto)\b/i,
  );
  return match ? match[1] : null;
}

function extractJobs(text: string): ExtractedProfile['previousJobs'] {
  const jobs: ExtractedProfile['previousJobs'] = [];
  const lines = text.split('\n');
  for (const line of lines) {
    const match = line.match(
      /^(.{3,80}?)\s+(?:at|@|-)\s+(.{2,80}?)(?:\s+\(?((?:19|20)\d{2}).{0,20}((?:19|20)\d{2}|present|current)?)?/i,
    );
    if (match) {
      jobs.push({
        title: match[1].trim(),
        company: match[2].trim(),
        startDate: match[3] ?? null,
        endDate: match[4] ?? null,
        current: /present|current/i.test(match[4] ?? ''),
        description: null,
        location: null,
      });
    }
  }
  return jobs.slice(0, 8);
}

function extractEducation(text: string): ExtractedProfile['education'] {
  const match = text.match(
    /\b(B\.?S\.?|M\.?S\.?|PhD|Bachelor|Master)[^,\n]{0,60}(Computer Science|Engineering|Information)?/i,
  );
  if (!match) return [];
  return [{ degree: match[1], field: match[2] ?? null, school: null, startDate: null, endDate: null }];
}

export function tryParseModelJson<T>(text: string, parse: (v: unknown) => T): T | null {
  try {
    return parse(parseJsonFromModel(text));
  } catch {
    return null;
  }
}
