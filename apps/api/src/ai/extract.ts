import type { ExtractedProfile } from '@job-hunter/shared';
import { extractedProfileSchema } from '@job-hunter/shared';
import { logger } from '../logger.js';
import { HeuristicProvider, heuristicProfile } from './heuristic.js';
import { getAiProvider } from './providers.js';
import { cvExtractionPrompt } from './types.js';

export async function extractProfileFromCv(cvText: string): Promise<{
  profile: ExtractedProfile;
  provider: string;
}> {
  const heuristic = heuristicProfile(cvText);
  try {
    const provider = await getAiProvider();
    if (!(await provider.available())) {
      return { profile: heuristic, provider: 'heuristic' };
    }
    const profile = await provider.completeJson(cvExtractionPrompt(cvText), extractedProfileSchema);
    return { profile: mergeWithoutInvention(heuristic, profile), provider: provider.id };
  } catch (error) {
    logger.warn({ err: error }, 'AI CV extraction failed; using heuristic parser');
    return { profile: heuristic, provider: 'heuristic' };
  }
}

function mergeWithoutInvention(
  fallback: ExtractedProfile,
  ai: ExtractedProfile,
): ExtractedProfile {
  return {
    fullName: ai.fullName ?? fallback.fullName,
    email: ai.email ?? fallback.email,
    phone: ai.phone ?? fallback.phone,
    location: ai.location ?? fallback.location,
    yearsOfExperience: ai.yearsOfExperience ?? fallback.yearsOfExperience,
    professionalSummary: ai.professionalSummary ?? fallback.professionalSummary,
    skills: unique([...ai.skills, ...fallback.skills]),
    technologies: unique([...ai.technologies, ...fallback.technologies]),
    previousJobs: ai.previousJobs.length ? ai.previousJobs : fallback.previousJobs,
    education: ai.education.length ? ai.education : fallback.education,
    certifications: ai.certifications.length ? ai.certifications : fallback.certifications,
    preferredRoles: unique([...ai.preferredRoles, ...fallback.preferredRoles]),
    preferredLocations: unique([...ai.preferredLocations, ...fallback.preferredLocations]),
    remotePreference: ai.remotePreference ?? fallback.remotePreference,
    salaryMin: ai.salaryMin ?? fallback.salaryMin,
    salaryMax: ai.salaryMax ?? fallback.salaryMax,
    salaryCurrency: ai.salaryCurrency ?? fallback.salaryCurrency,
    workAuthorization: ai.workAuthorization ?? fallback.workAuthorization,
    portfolioUrl: ai.portfolioUrl ?? fallback.portfolioUrl,
    githubUrl: ai.githubUrl ?? fallback.githubUrl,
    linkedinUrl: ai.linkedinUrl ?? fallback.linkedinUrl,
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

export { HeuristicProvider };
