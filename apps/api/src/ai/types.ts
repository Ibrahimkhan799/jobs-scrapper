import { z, type ZodType } from 'zod';
import { extractedProfileSchema, jobAnalysisSchema, generatedEmailSchema } from '@job-hunter/shared';

export interface AiProvider {
  id: string;
  available(): Promise<boolean>;
  completeJson<T>(prompt: string, schema: ZodType<T>): Promise<T>;
}

export const cvExtractionPrompt = (cvText: string) => `Extract a structured professional profile from the CV text.
Rules:
- Use only information present in the CV.
- If a field is not present, return null or an empty array.
- Never invent employers, dates, skills, or achievements.
- yearsOfExperience must be a number if stated, otherwise null.

Return JSON matching this shape:
{
  "fullName": string|null,
  "email": string|null,
  "phone": string|null,
  "location": string|null,
  "yearsOfExperience": number|null,
  "professionalSummary": string|null,
  "skills": string[],
  "technologies": string[],
  "previousJobs": [{"title": string, "company": string|null, "startDate": string|null, "endDate": string|null, "current": boolean, "description": string|null, "location": string|null}],
  "education": [{"school": string|null, "degree": string|null, "field": string|null, "startDate": string|null, "endDate": string|null}],
  "certifications": [{"name": string, "issuer": string|null, "year": string|null}],
  "preferredRoles": string[],
  "preferredLocations": string[],
  "remotePreference": "REMOTE"|"HYBRID"|"ONSITE"|"ANY"|null,
  "salaryMin": number|null,
  "salaryMax": number|null,
  "salaryCurrency": string|null,
  "workAuthorization": string|null,
  "portfolioUrl": string|null,
  "githubUrl": string|null,
  "linkedinUrl": string|null
}

CV:
"""
${cvText.slice(0, 20000)}
"""`;

export const jobAnalysisPrompt = (profileJson: string, jobJson: string) => `Analyze how well this candidate profile matches the job.
The matchScore is a Job Match Score (profile-to-job similarity), NOT a probability of being hired.
Do not invent requirements or experience.
Return JSON:
{
  "matchScore": 0-100,
  "recommendation": "EXCELLENT_MATCH"|"STRONG_MATCH"|"POSSIBLE_MATCH"|"WEAK_MATCH"|"POOR_MATCH",
  "skillMatch": 0-100,
  "experienceMatch": 0-100,
  "roleMatch": 0-100,
  "locationMatch": 0-100,
  "seniorityMatch": 0-100,
  "salaryMatch": 0-100,
  "matchedSkills": string[],
  "missingRequiredSkills": string[],
  "matchedRequirements": string[],
  "missingRequirements": string[],
  "concerns": string[],
  "reasoning": string,
  "confidence": 0-1
}

Candidate:
${profileJson}

Job:
${jobJson}`;

export { extractedProfileSchema, jobAnalysisSchema, generatedEmailSchema };

export function parseJsonFromModel(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const payload = fenced ? fenced[1] : trimmed;
  const start = payload.indexOf('{');
  const end = payload.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Model did not return JSON');
  return JSON.parse(payload.slice(start, end + 1));
}

export function validateJson<T>(schema: ZodType<T>, value: unknown): T {
  return schema.parse(value);
}

export { z };
