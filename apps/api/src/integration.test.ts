import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@job-hunter/database';
import { ingestRawJobs } from './services/ingestion.js';
import { generateApplication, processAutomatedSends, sendApplication } from './services/applications.js';
import { MemoryEmailProvider, setEmailProviderForTests } from './email/providers.js';
import { registerSources } from './scrapers/index.js';

registerSources();

describe('job ingestion and matching', () => {
  let userId: string;

  beforeAll(async () => {
    const user = await prisma.user.findUnique({ where: { email: 'demo@jobhunter.local' } });
    if (!user) throw new Error('Seed the database before running API integration tests');
    userId = user.id;
  });

  it('ingests a job once and matches it', async () => {
    const stamp = Date.now();
    const raw = {
      source: 'demo',
      sourceJobId: `test-${stamp}`,
      title: `React Developer ${stamp}`,
      company: `Integration Fixture ${stamp} (Demo)`,
      location: 'Remote',
      description: 'React TypeScript Next.js. 4 years experience. Demo listing.',
      originalUrl: `https://example.com/jobs/test-${stamp}`,
      skills: ['React', 'TypeScript', 'Next.js'],
    };
    const first = await ingestRawJobs([raw], userId);
    const second = await ingestRawJobs([raw], userId);
    expect(first.created).toBe(1);
    expect(second.created).toBe(0);
    expect(second.updated).toBe(1);

    const job = await prisma.job.findFirst({
      where: { sourceJobId: raw.sourceJobId },
      include: { matches: true },
    });
    expect(job).toBeTruthy();
    expect(job?.matches.length).toBeGreaterThan(0);
    expect(job?.matches[0]?.matchScore).toBeGreaterThan(50);
  });
});

describe('application + mock email', () => {
  const memory = new MemoryEmailProvider();

  beforeAll(() => {
    setEmailProviderForTests(memory);
  });

  afterAll(() => {
    setEmailProviderForTests(null);
  });

  it('creates an application and sends through the mock provider', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'demo@jobhunter.local' } });
    const job = await prisma.job.findFirst({
      where: { applicationEmail: { not: null }, isDemo: true },
    });
    if (!job) throw new Error('Expected seeded job with email');

    const uniqueJob = await prisma.job.create({
      data: {
        title: 'TypeScript Developer',
        normalizedTitle: 'typescript developer',
        companyId: job.companyId,
        location: 'Remote',
        normalizedLocation: 'Remote',
        remoteType: 'REMOTE',
        employmentType: 'FULL_TIME',
        description: 'Demo',
        descriptionText: 'Demo React TypeScript',
        applicationEmail: 'jobs@fixture.example',
        applicationUrl: `https://example.com/apply/fixture-${Date.now()}`,
        originalUrl: `https://example.com/jobs/fixture-${Date.now()}`,
        canonicalUrl: `https://example.com/jobs/fixture-${Date.now()}`,
        fingerprint: `fixture-${Date.now()}`,
        sourceId: job.sourceId,
        sourceJobId: `fixture-${Date.now()}`,
        isDemo: true,
      },
    });

    const generated = await generateApplication(user.id, uniqueJob.id);
    expect(generated.generatedBody).toBeTruthy();

    await prisma.application.update({
      where: { id: generated.id },
      data: { status: 'APPROVED', approvedAt: new Date(), recipientEmail: 'jobs@fixture.example' },
    });

    const sent = await sendApplication(user.id, generated.id);
    expect(sent.status).toBe('APPLIED');
    expect(memory.sent.length).toBeGreaterThan(0);
    expect(memory.sent.at(-1)?.to).toBe('jobs@fixture.example');
    expect(memory.sent.at(-1)?.subject).toContain('TypeScript Developer');
  });

  it('does not auto-send unless Settings allowAutomatedSending is on', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'demo@jobhunter.local' } });
    await prisma.userSettings.upsert({
      where: { userId: user.id },
      update: { allowAutomatedSending: false },
      create: { userId: user.id, allowAutomatedSending: false },
    });
    const before = memory.sent.length;
    const result = await processAutomatedSends(user.id);
    expect(result.reason).toBe('auto-send is off');
    expect(result.sent).toBe(0);
    expect(memory.sent.length).toBe(before);
  });
});
