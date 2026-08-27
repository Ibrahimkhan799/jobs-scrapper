import { z } from 'zod';
import {
  APPLICATION_METHODS,
  APPLICATION_STATUSES,
  EMPLOYMENT_TYPES,
  MATCH_RECOMMENDATIONS,
  REMOTE_TYPES,
} from './constants.js';

export const remoteTypeSchema = z.enum(REMOTE_TYPES);
export const employmentTypeSchema = z.enum(EMPLOYMENT_TYPES);
export const matchRecommendationSchema = z.enum(MATCH_RECOMMENDATIONS);
export const applicationStatusSchema = z.enum(APPLICATION_STATUSES);
export const applicationMethodSchema = z.enum(APPLICATION_METHODS);

export const previousJobSchema = z.object({
  title: z.string(),
  company: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  current: z.boolean().optional(),
  description: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
});

export const educationSchema = z.object({
  school: z.string().nullable().optional(),
  degree: z.string().nullable().optional(),
  field: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
});

export const certificationSchema = z.object({
  name: z.string(),
  issuer: z.string().nullable().optional(),
  year: z.string().nullable().optional(),
});

export const extractedProfileSchema = z.object({
  fullName: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  location: z.string().nullable(),
  yearsOfExperience: z.number().nullable(),
  professionalSummary: z.string().nullable(),
  skills: z.array(z.string()),
  technologies: z.array(z.string()),
  previousJobs: z.array(previousJobSchema),
  education: z.array(educationSchema),
  certifications: z.array(certificationSchema),
  preferredRoles: z.array(z.string()),
  preferredLocations: z.array(z.string()),
  remotePreference: remoteTypeSchema.nullable(),
  salaryMin: z.number().nullable(),
  salaryMax: z.number().nullable(),
  salaryCurrency: z.string().nullable(),
  workAuthorization: z.string().nullable(),
  portfolioUrl: z.string().nullable(),
  githubUrl: z.string().nullable(),
  linkedinUrl: z.string().nullable(),
});

export type ExtractedProfile = z.infer<typeof extractedProfileSchema>;

export const candidateUpdateSchema = z.object({
  fullName: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  yearsOfExperience: z.number().nullable().optional(),
  professionalSummary: z.string().nullable().optional(),
  technologies: z.array(z.string()).optional(),
  previousJobs: z.array(previousJobSchema).optional(),
  education: z.array(educationSchema).optional(),
  certifications: z.array(certificationSchema).optional(),
  preferredRoles: z.array(z.string()).optional(),
  preferredLocations: z.array(z.string()).optional(),
  remotePreference: remoteTypeSchema.optional(),
  salaryMin: z.number().nullable().optional(),
  salaryMax: z.number().nullable().optional(),
  salaryCurrency: z.string().nullable().optional(),
  workAuthorization: z.string().nullable().optional(),
  portfolioUrl: z.string().nullable().optional(),
  githubUrl: z.string().nullable().optional(),
  linkedinUrl: z.string().nullable().optional(),
  skills: z.array(z.string()).optional(),
});

export const searchProfileSchema = z.object({
  name: z.string().min(1).max(80),
  targetTitles: z.array(z.string().min(1)).min(1).max(12),
  targetLocations: z.array(z.string().min(1)).min(1).max(12),
  salaryMin: z.number().int().nonnegative().nullable().optional(),
  salaryMax: z.number().int().nonnegative().nullable().optional(),
  currency: z.string().min(1).max(8).optional(),
  experienceMin: z.number().int().nonnegative().nullable().optional(),
  experienceMax: z.number().int().nonnegative().nullable().optional(),
  employmentTypes: z.array(employmentTypeSchema).default(['FULL_TIME']),
  remotePreference: remoteTypeSchema.default('ANY'),
  minMatchScore: z.number().int().min(0).max(100).default(80),
  dailyApplicationLimit: z.number().int().min(1).max(50).default(10),
  allowAutomatedSending: z.boolean().default(false),
  discoveryIntervalHours: z.number().int().min(1).max(168).default(12),
  enabled: z.boolean().default(true),
});

export const jobFilterSchema = z.object({
  q: z.string().optional(),
  minScore: z.coerce.number().int().min(0).max(100).optional(),
  maxScore: z.coerce.number().int().min(0).max(100).optional(),
  remoteType: remoteTypeSchema.optional(),
  location: z.string().optional(),
  source: z.string().optional(),
  employmentType: employmentTypeSchema.optional(),
  hasEmail: z.coerce.boolean().optional(),
  from: z.string().optional(),
  sort: z.enum(['match', 'date', 'salary', 'company', 'location']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const applicationStatusPatchSchema = z.object({
  status: applicationStatusSchema,
  notes: z.string().max(4000).optional(),
});

export const applicationEmailDraftSchema = z.object({
  subject: z.string().min(3).max(200),
  body: z.string().min(40).max(8000),
  recipientEmail: z.preprocess(
    (value) => (value === '' ? null : value),
    z.string().email().nullable().optional(),
  ),
  attachCv: z.boolean().optional(),
});

export const jobAnalysisSchema = z.object({
  matchScore: z.number().min(0).max(100),
  recommendation: matchRecommendationSchema,
  skillMatch: z.number().min(0).max(100),
  experienceMatch: z.number().min(0).max(100),
  roleMatch: z.number().min(0).max(100),
  locationMatch: z.number().min(0).max(100),
  seniorityMatch: z.number().min(0).max(100),
  salaryMatch: z.number().min(0).max(100),
  matchedSkills: z.array(z.string()),
  missingRequiredSkills: z.array(z.string()),
  matchedRequirements: z.array(z.string()),
  missingRequirements: z.array(z.string()),
  concerns: z.array(z.string()),
  reasoning: z.string(),
  confidence: z.number().min(0).max(1),
});

export const generatedEmailSchema = z.object({
  subject: z.string().min(3).max(200),
  body: z.string().min(40).max(8000),
});

export const userSettingsSchema = z.object({
  allowAutomatedSending: z.boolean().optional(),
  dailyApplicationLimit: z.number().int().min(1).max(50).optional(),
  discoveryIntervalHours: z.number().int().min(1).max(168).optional(),
  minMatchScore: z.number().int().min(0).max(100).optional(),
  followUpAfterDays: z.number().int().min(1).max(60).optional(),
  emailTemplateSubject: z.preprocess(
    (value) => (value === '' ? null : value),
    z.string().min(3).max(200).nullable().optional(),
  ),
  emailTemplateBody: z.preprocess(
    (value) => (value === '' ? null : value),
    z.string().min(40).max(8000).nullable().optional(),
  ),
  activeAiCredentialId: z.string().nullable().optional(),
  matchWeights: z
    .object({
      requiredSkills: z.number(),
      experience: z.number(),
      role: z.number(),
      location: z.number(),
      seniority: z.number(),
      education: z.number(),
      salary: z.number(),
    })
    .optional(),
});

export const aiCredentialSchema = z.object({
  provider: z.string().min(1).max(40),
  label: z.string().min(1).max(80),
  apiKey: z.string().max(500).optional(),
  baseUrl: z.string().max(300).optional(),
  model: z.string().max(120).optional(),
  enabled: z.boolean().optional(),
});

export const emailAccountSchema = z.object({
  provider: z.enum(['smtp', 'gmail', 'outlook']),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  username: z.string().min(1),
  password: z.string().min(1),
  fromEmail: z.string().email(),
  secure: z.boolean().optional(),
});
