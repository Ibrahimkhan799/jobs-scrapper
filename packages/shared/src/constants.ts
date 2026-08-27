export const REMOTE_TYPES = ['REMOTE', 'HYBRID', 'ONSITE', 'ANY'] as const;
export type RemoteType = (typeof REMOTE_TYPES)[number];

export const EMPLOYMENT_TYPES = [
  'FULL_TIME',
  'PART_TIME',
  'CONTRACT',
  'INTERNSHIP',
  'UNKNOWN',
] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const MATCH_RECOMMENDATIONS = [
  'EXCELLENT_MATCH',
  'STRONG_MATCH',
  'POSSIBLE_MATCH',
  'WEAK_MATCH',
  'POOR_MATCH',
] as const;
export type MatchRecommendation = (typeof MATCH_RECOMMENDATIONS)[number];

export const APPLICATION_STATUSES = [
  'DISCOVERED',
  'MATCHED',
  'REVIEW',
  'APPROVED',
  'APPLIED',
  'FOLLOW_UP',
  'RESPONSE',
  'INTERVIEW',
  'OFFER',
  'REJECTED',
  'ARCHIVED',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_METHODS = ['EMAIL', 'MANUAL'] as const;
export type ApplicationMethod = (typeof APPLICATION_METHODS)[number];

export const DEFAULT_MIN_MATCH_SCORE = 80;
export const DEFAULT_DAILY_APPLICATION_LIMIT = 10;
export const DEFAULT_DISCOVERY_INTERVAL_HOURS = 12;

export const DEFAULT_MATCH_WEIGHTS = {
  requiredSkills: 0.35,
  experience: 0.2,
  role: 0.15,
  location: 0.1,
  seniority: 0.1,
  education: 0.05,
  salary: 0.05,
} as const;

export type MatchWeights = {
  requiredSkills: number;
  experience: number;
  role: number;
  location: number;
  seniority: number;
  education: number;
  salary: number;
};

export function recommendationFromScore(score: number): MatchRecommendation {
  if (score >= 90) return 'EXCELLENT_MATCH';
  if (score >= 80) return 'STRONG_MATCH';
  if (score >= 70) return 'POSSIBLE_MATCH';
  if (score >= 60) return 'WEAK_MATCH';
  return 'POOR_MATCH';
}

export function scoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Strong';
  if (score >= 70) return 'Possible';
  return 'Weak';
}

export const SENIORITY_LEVELS = [
  'intern',
  'junior',
  'mid',
  'senior',
  'staff',
  'principal',
  'lead',
  'manager',
  'director',
] as const;
export type SeniorityLevel = (typeof SENIORITY_LEVELS)[number];

export const SENIORITY_RANK: Record<SeniorityLevel, number> = {
  intern: 0,
  junior: 1,
  mid: 2,
  senior: 3,
  staff: 4,
  principal: 5,
  lead: 4,
  manager: 5,
  director: 6,
};
