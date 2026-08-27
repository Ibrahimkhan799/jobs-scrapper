export function recommendationFromScore(score: number) {
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
