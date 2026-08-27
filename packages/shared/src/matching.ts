import {
  DEFAULT_MATCH_WEIGHTS,
  recommendationFromScore,
  type MatchRecommendation,
  type MatchWeights,
  type RemoteType,
} from './constants.js';
import { locationMatchScore } from './locations.js';
import { salaryOverlapScore } from './salary.js';
import { normalizeSkillName } from './skills.js';
import {
  bestTitleMatch,
  experienceMatchScore,
  parseRequiredYears,
  seniorityMatchScore,
} from './titles.js';

export type CandidateSnapshot = {
  fullName?: string | null;
  yearsOfExperience?: number | null;
  skills: string[];
  previousJobs: Array<{ title: string; company?: string | null }>;
  preferredRoles: string[];
  preferredLocations: string[];
  remotePreference: RemoteType;
  salaryMin?: number | null;
  salaryMax?: number | null;
  education: Array<{ degree?: string | null; field?: string | null }>;
  professionalSummary?: string | null;
};

export type JobSnapshot = {
  title: string;
  company: string;
  location?: string | null;
  remoteType: RemoteType;
  skills: string[];
  requirements: string[];
  niceToHave: string[];
  descriptionText: string;
  experienceRequired?: string | null;
  educationRequired?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
};

export type MatchBreakdown = {
  matchScore: number;
  recommendation: MatchRecommendation;
  skillMatch: number;
  experienceMatch: number;
  roleMatch: number;
  locationMatch: number;
  seniorityMatch: number;
  educationMatch: number;
  salaryMatch: number;
  matchedSkills: string[];
  missingRequiredSkills: string[];
  matchedRequirements: string[];
  missingRequirements: string[];
  concerns: string[];
  reasoning: string;
  confidence: number;
};

export function skillCoverage(
  candidateSkills: string[],
  jobSkills: string[],
): { matched: string[]; missing: string[]; score: number } {
  const candidate = new Set(candidateSkills.map(normalizeSkillName).map((s) => s.toLowerCase()));
  const matched: string[] = [];
  const missing: string[] = [];

  for (const skill of jobSkills) {
    const normalized = normalizeSkillName(skill);
    if (candidate.has(normalized.toLowerCase())) matched.push(normalized);
    else missing.push(normalized);
  }

  if (jobSkills.length === 0) {
    return { matched: [], missing: [], score: 55 };
  }

  const coverage = matched.length / jobSkills.length;
  const score = Math.round(coverage * 100);
  return { matched, missing, score };
}

export function educationMatchScore(
  education: CandidateSnapshot['education'],
  required: string | null | undefined,
): number {
  if (!required) return 80;
  if (education.length === 0) return 40;
  const haystack = education
    .map((item) => `${item.degree ?? ''} ${item.field ?? ''}`)
    .join(' ')
    .toLowerCase();
  const req = required.toLowerCase();
  if (req.includes('phd') && haystack.includes('phd')) return 100;
  if (req.includes('master') && (haystack.includes('master') || haystack.includes('phd'))) {
    return 100;
  }
  if (
    (req.includes('bachelor') || req.includes('degree') || req.includes('b.s') || req.includes('bs')) &&
    (haystack.includes('bachelor') ||
      haystack.includes('master') ||
      haystack.includes('b.s') ||
      haystack.includes('degree'))
  ) {
    return 100;
  }
  return 50;
}

export function scoreJobMatch(
  candidate: CandidateSnapshot,
  job: JobSnapshot,
  weights: MatchWeights = DEFAULT_MATCH_WEIGHTS,
): MatchBreakdown {
  const skills = skillCoverage(candidate.skills, job.skills);
  const requiredYears = parseRequiredYears(job.experienceRequired ?? job.descriptionText);
  const experienceMatch = experienceMatchScore(candidate.yearsOfExperience, requiredYears);
  const candidateTitles = [
    ...candidate.preferredRoles,
    ...candidate.previousJobs.map((jobItem) => jobItem.title),
  ].filter(Boolean);
  const roleMatch = bestTitleMatch(job.title, candidateTitles);
  const locationMatch = locationMatchScore({
    candidateLocations: candidate.preferredLocations,
    candidateRemote: candidate.remotePreference,
    jobLocation: job.location,
    jobRemote: job.remoteType,
  });
  const seniorityMatch = seniorityMatchScore(
    candidate.previousJobs.map((item) => item.title),
    candidate.yearsOfExperience,
    job.title,
  );
  const educationMatch = educationMatchScore(candidate.education, job.educationRequired);
  const salaryMatch = salaryOverlapScore(
    candidate.salaryMin,
    candidate.salaryMax,
    job.salaryMin,
    job.salaryMax,
  );

  const weighted =
    skills.score * weights.requiredSkills +
    experienceMatch * weights.experience +
    roleMatch * weights.role +
    locationMatch * weights.location +
    seniorityMatch * weights.seniority +
    educationMatch * weights.education +
    salaryMatch * weights.salary;

  const matchScore = clamp(Math.round(weighted));
  const recommendation = recommendationFromScore(matchScore);

  const matchedRequirements = job.requirements.filter((req) =>
    candidate.skills.some((skill) => req.toLowerCase().includes(skill.toLowerCase())),
  );
  const missingRequirements = job.requirements
    .filter((req) => !matchedRequirements.includes(req))
    .slice(0, 8);

  const concerns: string[] = [];
  if (skills.missing.length > 0) {
    concerns.push(`Missing listed skills: ${skills.missing.slice(0, 5).join(', ')}`);
  }
  if (experienceMatch < 60 && requiredYears != null) {
    concerns.push(`Job mentions ${requiredYears}+ years; profile has ${candidate.yearsOfExperience ?? 'unknown'}.`);
  }
  if (locationMatch < 50) {
    concerns.push('Location / remote preference may not align.');
  }
  if (salaryMatch < 50) {
    concerns.push('Salary range may not overlap with expectations.');
  }

  const reasoning = buildReasoning({
    matchScore,
    skills,
    roleMatch,
    locationMatch,
    jobTitle: job.title,
    company: job.company,
  });

  const evidence =
    skills.matched.length +
    (candidate.yearsOfExperience != null ? 1 : 0) +
    (job.skills.length > 0 ? 1 : 0);
  const confidence = clamp01(0.45 + evidence * 0.08);

  return {
    matchScore,
    recommendation,
    skillMatch: skills.score,
    experienceMatch,
    roleMatch,
    locationMatch,
    seniorityMatch,
    educationMatch,
    salaryMatch,
    matchedSkills: skills.matched,
    missingRequiredSkills: skills.missing,
    matchedRequirements,
    missingRequirements,
    concerns,
    reasoning,
    confidence,
  };
}

function buildReasoning(input: {
  matchScore: number;
  skills: { matched: string[]; missing: string[]; score: number };
  roleMatch: number;
  locationMatch: number;
  jobTitle: string;
  company: string;
}): string {
  const parts = [
    `Job Match Score ${input.matchScore} for ${input.jobTitle} at ${input.company}.`,
    `Skill overlap ${input.skills.score}% (${input.skills.matched.slice(0, 6).join(', ') || 'none listed'}).`,
    `Role relevance ${input.roleMatch}%, location compatibility ${input.locationMatch}%.`,
  ];
  if (input.skills.missing.length > 0) {
    parts.push(`Gaps: ${input.skills.missing.slice(0, 4).join(', ')}.`);
  }
  parts.push('This is a profile-to-job similarity score, not a probability of being hired.');
  return parts.join(' ');
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}
