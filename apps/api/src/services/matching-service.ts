import { prisma } from '@job-hunter/database';
import {
  scoreJobMatch,
  DEFAULT_MATCH_WEIGHTS,
  type CandidateSnapshot,
  type JobSnapshot,
  type MatchWeights,
  jobAnalysisSchema,
} from '@job-hunter/shared';
import { logger } from '../logger.js';
import { getAiProvider } from '../ai/providers.js';
import { jobAnalysisPrompt } from '../ai/types.js';
import { notFound } from '../lib/errors.js';

export async function matchJobForProfile(candidateProfileId: string, jobId: string) {
  const profile = await prisma.candidateProfile.findUnique({
    where: { id: candidateProfileId },
    include: { skills: { include: { skill: true } }, user: { include: { settings: true } } },
  });
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { company: true, skills: { include: { skill: true } } },
  });
  if (!profile || !job) throw notFound('Profile or job missing');

  const weights = (profile.user.settings?.matchWeights as MatchWeights | null) ?? DEFAULT_MATCH_WEIGHTS;
  const candidate = toCandidateSnapshot(profile);
  const jobSnap = toJobSnapshot(job);
  let breakdown = scoreJobMatch(candidate, jobSnap, weights);

  try {
    const provider = await getAiProvider();
    if (await provider.available()) {
      const ai = await provider.completeJson(
        jobAnalysisPrompt(JSON.stringify(candidate), JSON.stringify(jobSnap)),
        jobAnalysisSchema,
      );
      breakdown = {
        ...breakdown,
        reasoning: ai.reasoning || breakdown.reasoning,
        concerns: unique([...breakdown.concerns, ...ai.concerns]),
        matchedSkills: unique([...breakdown.matchedSkills, ...ai.matchedSkills]),
        missingRequiredSkills: unique([
          ...breakdown.missingRequiredSkills,
          ...ai.missingRequiredSkills,
        ]),
        confidence: Math.max(breakdown.confidence, ai.confidence),
      };
    }
  } catch (error) {
    logger.info({ err: error }, 'AI analysis skipped; using deterministic Job Match Score');
  }

  return prisma.jobMatch.upsert({
    where: { candidateProfileId_jobId: { candidateProfileId, jobId } },
    create: {
      candidateProfileId,
      jobId,
      ...persist(breakdown),
    },
    update: persist(breakdown),
  });
}

function persist(breakdown: ReturnType<typeof scoreJobMatch>) {
  return {
    matchScore: breakdown.matchScore,
    recommendation: breakdown.recommendation,
    skillMatch: breakdown.skillMatch,
    experienceMatch: breakdown.experienceMatch,
    roleMatch: breakdown.roleMatch,
    locationMatch: breakdown.locationMatch,
    seniorityMatch: breakdown.seniorityMatch,
    educationMatch: breakdown.educationMatch,
    salaryMatch: breakdown.salaryMatch,
    matchedSkills: breakdown.matchedSkills,
    missingRequiredSkills: breakdown.missingRequiredSkills,
    matchedRequirements: breakdown.matchedRequirements,
    missingRequirements: breakdown.missingRequirements,
    concerns: breakdown.concerns,
    reasoning: breakdown.reasoning,
    confidence: breakdown.confidence,
    analyzedAt: new Date(),
  };
}

function toCandidateSnapshot(profile: {
  yearsOfExperience: number | null;
  skills: Array<{ skill: { name: string } }>;
  previousJobs: unknown;
  preferredRoles: unknown;
  preferredLocations: unknown;
  remotePreference: CandidateSnapshot['remotePreference'];
  salaryMin: number | null;
  salaryMax: number | null;
  education: unknown;
  professionalSummary: string | null;
  fullName: string | null;
}): CandidateSnapshot {
  return {
    fullName: profile.fullName,
    yearsOfExperience: profile.yearsOfExperience,
    skills: profile.skills.map((item) => item.skill.name),
    previousJobs: asJobs(profile.previousJobs),
    preferredRoles: asStrings(profile.preferredRoles),
    preferredLocations: asStrings(profile.preferredLocations),
    remotePreference: profile.remotePreference,
    salaryMin: profile.salaryMin,
    salaryMax: profile.salaryMax,
    education: asEducation(profile.education),
    professionalSummary: profile.professionalSummary,
  };
}

function toJobSnapshot(job: {
  title: string;
  company: { name: string };
  location: string | null;
  remoteType: JobSnapshot['remoteType'];
  skills: Array<{ skill: { name: string } }>;
  requirements: unknown;
  niceToHave: unknown;
  descriptionText: string;
  experienceRequired: string | null;
  educationRequired: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
}): JobSnapshot {
  return {
    title: job.title,
    company: job.company.name,
    location: job.location,
    remoteType: job.remoteType,
    skills: job.skills.map((item) => item.skill.name),
    requirements: asStrings(job.requirements),
    niceToHave: asStrings(job.niceToHave),
    descriptionText: job.descriptionText,
    experienceRequired: job.experienceRequired,
    educationRequired: job.educationRequired,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
  };
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function asJobs(value: unknown): CandidateSnapshot['previousJobs'] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as { title?: unknown; company?: unknown };
      if (typeof row.title !== 'string') return null;
      return { title: row.title, company: typeof row.company === 'string' ? row.company : null };
    })
    .filter((item): item is { title: string; company: string | null } => item !== null);
}

function asEducation(value: unknown): CandidateSnapshot['education'] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = (item ?? {}) as { degree?: string | null; field?: string | null };
    return { degree: row.degree ?? null, field: row.field ?? null };
  });
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}
