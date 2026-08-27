import { describe, expect, it } from 'vitest';
import { parseSalary, salaryOverlapScore } from './salary.js';
import { extractSkillsFromText, normalizeSkillName } from './skills.js';
import { normalizeJob } from './normalize.js';
import { findDuplicate, jobFingerprint, canonicalizeUrl } from './dedupe.js';
import { scoreJobMatch } from './matching.js';
import { generateSearchQueries } from './queries.js';
import { generateApplicationEmail, validateGeneratedEmail } from './email.js';
import { recommendationFromScore } from './constants.js';

describe('salary parsing', () => {
  it('parses k-notation ranges', () => {
    expect(parseSalary('$80k-$120k')).toMatchObject({
      min: 80000,
      max: 120000,
      currency: 'USD',
    });
  });

  it('annualizes monthly salaries', () => {
    const parsed = parseSalary('AED 15,000 per month');
    expect(parsed.min).toBe(180000);
    expect(parsed.currency).toBe('AED');
    expect(parsed.period).toBe('month');
  });

  it('handles up-to phrasing', () => {
    expect(parseSalary('up to 150000 USD').max).toBe(150000);
    expect(parseSalary('up to 150000 USD').min).toBeNull();
  });
});

describe('skill normalization', () => {
  it('maps synonyms to canonical names', () => {
    expect(normalizeSkillName('React.js')).toBe('React');
    expect(normalizeSkillName('nextjs')).toBe('Next.js');
    expect(normalizeSkillName('ts')).toBe('TypeScript');
    expect(normalizeSkillName('nodejs')).toBe('Node.js');
  });

  it('extracts skills from a job description', () => {
    const skills = extractSkillsFromText('We use React, TypeScript, Next.js and PostgreSQL.');
    expect(skills).toEqual(expect.arrayContaining(['React', 'TypeScript', 'Next.js', 'PostgreSQL']));
  });
});

describe('job normalization', () => {
  it('normalizes a raw listing', () => {
    const job = normalizeJob({
      source: 'remotive',
      sourceJobId: '1',
      title: 'Senior Front-End Developer',
      company: 'Harbor Pine Digital',
      location: 'Dubai, UAE',
      employmentType: 'full_time',
      salary: '$90,000 - $120,000',
      description:
        '<p>We need React and TypeScript. Requirements: 5 years experience. Nice to have: AWS.</p>',
      originalUrl: 'https://example.com/jobs/1?utm_source=board',
    });
    expect(job.normalizedTitle).toContain('frontend');
    expect(job.normalizedLocation).toBe('Dubai');
    expect(job.employmentType).toBe('FULL_TIME');
    expect(job.salaryMin).toBe(90000);
    expect(job.skills).toEqual(expect.arrayContaining(['React', 'TypeScript']));
    expect(job.canonicalUrl).toBe('https://example.com/jobs/1');
  });
});

describe('deduplication', () => {
  it('prefers source job id, then application URL, then canonical URL, then fingerprint', () => {
    const existing = [
      {
        id: 'a',
        sourceKey: 'remotive',
        sourceJobId: '99',
        canonicalUrl: 'https://jobs.example/x',
        applicationUrl: 'https://apply.example/x',
        fingerprint: jobFingerprint({ company: 'Acme', title: 'react developer', location: 'remote' }),
      },
    ];
    expect(
      findDuplicate(
        {
          sourceKey: 'remotive',
          sourceJobId: '99',
          canonicalUrl: 'https://other.example',
          applicationUrl: null,
          fingerprint: 'other',
        },
        existing,
      ),
    ).toMatchObject({ kind: 'existing', strategy: 'sourceJobId' });

    expect(
      findDuplicate(
        {
          sourceKey: 'rss',
          sourceJobId: '1',
          canonicalUrl: 'https://jobs.example/x',
          applicationUrl: null,
          fingerprint: 'other',
        },
        existing,
      ),
    ).toMatchObject({ strategy: 'canonicalUrl' });
  });

  it('canonicalizes tracking parameters', () => {
    expect(canonicalizeUrl('https://WWW.Example.com/jobs/1/?utm_source=x')).toBe(
      'https://example.com/jobs/1',
    );
  });
});

describe('match scoring', () => {
  const candidate = {
    skills: ['React', 'TypeScript', 'Next.js', 'Node.js'],
    previousJobs: [{ title: 'Senior Frontend Developer', company: 'Northwind Labs (Demo)' }],
    preferredRoles: ['Frontend Developer', 'React Developer'],
    preferredLocations: ['Remote', 'Dubai'],
    remotePreference: 'REMOTE' as const,
    yearsOfExperience: 6,
    education: [{ degree: 'B.S.', field: 'Computer Science' }],
    salaryMin: 80000,
    salaryMax: 140000,
  };

  it('scores a strong frontend role highly', () => {
    const result = scoreJobMatch(candidate, {
      title: 'Senior React Developer',
      company: 'Demo Co',
      location: 'Remote',
      remoteType: 'REMOTE',
      skills: ['React', 'TypeScript', 'Next.js'],
      requirements: ['React', 'TypeScript'],
      niceToHave: [],
      descriptionText: '5 years experience. Bachelor degree.',
      experienceRequired: '5 years',
      salaryMin: 90000,
      salaryMax: 130000,
    });
    expect(result.matchScore).toBeGreaterThanOrEqual(80);
    expect(['STRONG_MATCH', 'EXCELLENT_MATCH']).toContain(result.recommendation);
    expect(recommendationFromScore(result.matchScore)).toBe(result.recommendation);
  });

  it('penalizes missing skills and onsite mismatch', () => {
    const result = scoreJobMatch(candidate, {
      title: 'Java Backend Engineer',
      company: 'Demo Co',
      location: 'Berlin',
      remoteType: 'ONSITE',
      skills: ['Java', 'Spring', 'Kafka'],
      requirements: ['Java'],
      niceToHave: [],
      descriptionText: '10 years Java experience required',
      experienceRequired: '10 years',
    });
    expect(result.matchScore).toBeLessThan(70);
    expect(result.missingRequiredSkills.length).toBeGreaterThan(0);
  });
});

describe('search query generation', () => {
  it('does not explode into hundreds of queries', () => {
    const queries = generateSearchQueries({
      targetTitles: ['Frontend Developer', 'React Developer', 'Next.js Developer'],
      targetLocations: ['Remote', 'Dubai', 'Riyadh', 'Doha', 'Abu Dhabi'],
      remotePreference: 'REMOTE',
    });
    expect(queries.length).toBeGreaterThan(0);
    expect(queries.length).toBeLessThanOrEqual(12);
    expect(queries.some((q) => q.query.includes('React Developer Dubai'))).toBe(true);
  });
});

describe('email generation', () => {
  it('produces a truthful professional email', () => {
    const candidate = {
      fullName: 'Sam Rivera',
      email: 'sam@example.com',
      yearsOfExperience: 6,
      skills: ['React', 'TypeScript'],
      previousJobs: [{ title: 'Frontend Developer', company: 'Northwind Labs (Demo)' }],
      professionalSummary: 'Frontend engineer focused on React and TypeScript.',
    };
    const email = generateApplicationEmail(candidate, {
      title: 'React Developer',
      company: 'Harbor Pine Digital (Demo)',
      matchedSkills: ['React', 'TypeScript'],
    });
    expect(email.subject).toContain('React Developer');
    expect(email.body).toContain('Sam Rivera');
    expect(email.body).not.toMatch(/increased \d+%/i);
    expect(validateGeneratedEmail(email, candidate)).toEqual({ ok: true });
  });
});
