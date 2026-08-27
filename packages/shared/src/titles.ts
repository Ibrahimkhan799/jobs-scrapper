import { SENIORITY_RANK, type SeniorityLevel } from './constants.js';

const TITLE_SYNONYMS: Record<string, string> = {
  'front end': 'frontend',
  'front-end': 'frontend',
  'front end developer': 'frontend developer',
  'front-end developer': 'frontend developer',
  'front end engineer': 'frontend engineer',
  'front-end engineer': 'frontend engineer',
  'ui engineer': 'frontend engineer',
  'ui developer': 'frontend developer',
  'react.js developer': 'react developer',
  'reactjs developer': 'react developer',
  'nextjs developer': 'next.js developer',
  'next js developer': 'next.js developer',
  'full stack': 'fullstack',
  'full-stack': 'fullstack',
  'back end': 'backend',
  'back-end': 'backend',
  'software engineer': 'software engineer',
  'software developer': 'software engineer',
  'web developer': 'frontend developer',
  'javascript engineer': 'javascript developer',
  'typescript engineer': 'typescript developer',
};

const SENIORITY_PATTERNS: Array<[RegExp, SeniorityLevel]> = [
  [/\bintern\b|\binternship\b/, 'intern'],
  [/\bjunior\b|\bjr\b|\bentry[- ]level\b|\bgraduate\b/, 'junior'],
  [/\bmid[- ]level\b|\bintermediate\b/, 'mid'],
  [/\bsenior\b|\bsr\b/, 'senior'],
  [/\bstaff\b/, 'staff'],
  [/\bprincipal\b/, 'principal'],
  [/\blead\b/, 'lead'],
  [/\bmanager\b|\bengineering manager\b/, 'manager'],
  [/\bdirector\b|\bhead of\b|\bvp\b/, 'director'],
];

export function normalizeTitle(raw: string | null | undefined): string {
  if (!raw) return '';
  let value = raw.toLowerCase().replace(/\s+/g, ' ').trim();
  value = value.replace(/\b(i{1,3}|iv|v)?\b$/i, '').trim();
  if (TITLE_SYNONYMS[value]) return TITLE_SYNONYMS[value];

  for (const [from, to] of Object.entries(TITLE_SYNONYMS)) {
    value = value.replace(new RegExp(`\\b${from}\\b`, 'g'), to);
  }

  return value.replace(/[^a-z0-9.+# ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function titleTokens(title: string): string[] {
  return normalizeTitle(title)
    .split(' ')
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

const STOP_WORDS = new Set([
  'the',
  'and',
  'or',
  'of',
  'for',
  'a',
  'an',
  'to',
  'in',
  'with',
]);

export function titleSimilarity(a: string, b: string): number {
  const left = new Set(titleTokens(a));
  const right = new Set(titleTokens(b));
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection += 1;
  }
  const union = new Set([...left, ...right]).size;
  return Math.round((intersection / union) * 100);
}

export function bestTitleMatch(jobTitle: string, candidateTitles: string[]): number {
  if (candidateTitles.length === 0) return 50;
  return Math.max(...candidateTitles.map((title) => titleSimilarity(jobTitle, title)));
}

export function extractSeniority(title: string | null | undefined): SeniorityLevel | null {
  if (!title) return null;
  const lower = title.toLowerCase();
  for (const [pattern, level] of SENIORITY_PATTERNS) {
    if (pattern.test(lower)) return level;
  }
  return 'mid';
}

export function seniorityMatchScore(
  candidateTitles: string[],
  yearsOfExperience: number | null | undefined,
  jobTitle: string,
): number {
  const candidateLevel = inferCandidateSeniority(candidateTitles, yearsOfExperience);
  const jobLevel = extractSeniority(jobTitle);
  if (!candidateLevel || !jobLevel) return 70;

  const delta = Math.abs(SENIORITY_RANK[candidateLevel] - SENIORITY_RANK[jobLevel]);
  if (delta === 0) return 100;
  if (delta === 1) return 80;
  if (delta === 2) return 55;
  return 25;
}

export function inferCandidateSeniority(
  titles: string[],
  years: number | null | undefined,
): SeniorityLevel | null {
  const fromTitles = titles
    .map((title) => extractSeniority(title))
    .filter((level): level is SeniorityLevel => Boolean(level));
  if (fromTitles.length > 0) {
    return fromTitles.reduce((best, current) =>
      SENIORITY_RANK[current] > SENIORITY_RANK[best] ? current : best,
    );
  }
  if (years == null) return null;
  if (years < 2) return 'junior';
  if (years < 5) return 'mid';
  if (years < 8) return 'senior';
  if (years < 12) return 'staff';
  return 'principal';
}

export function experienceMatchScore(
  candidateYears: number | null | undefined,
  requiredYears: number | null | undefined,
): number {
  if (requiredYears == null) return 75;
  if (candidateYears == null) return 50;
  if (candidateYears >= requiredYears) return 100;
  const ratio = candidateYears / Math.max(requiredYears, 1);
  if (ratio >= 0.8) return 80;
  if (ratio >= 0.6) return 60;
  if (ratio >= 0.4) return 40;
  return 20;
}

export function parseRequiredYears(text: string | null | undefined): number | null {
  if (!text) return null;
  const match = text.match(/(\d+)\s*\+?\s*(?:years?|yrs?)/i);
  if (!match) return null;
  return Number.parseInt(match[1], 10);
}
