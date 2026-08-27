import { prisma } from '@job-hunter/database';
import {
  generateSearchQueries,
  normalizeJob,
  type RawJob,
  type NormalizedJob,
} from '@job-hunter/shared';
import { env } from '../env.js';
import { logger } from '../logger.js';
import { sanitizeJobHtml } from '../lib/sanitize.js';
import { sourceRegistry } from '../scrapers/index.js';
import { notify, requireProfile, logActivity } from './context.js';
import { matchJobForProfile } from './matching-service.js';
import { discoverJobEmail } from './email-discovery.js';

export async function ingestRawJobs(rawJobs: RawJob[], userId: string) {
  let created = 0;
  let updated = 0;
  const jobIds: string[] = [];

  for (const raw of rawJobs) {
    const normalized = normalizeJob({
      ...raw,
      description: sanitizeJobHtml(raw.description ?? ''),
    });
    const result = await upsertNormalizedJob(normalized);
    if (result.created) created += 1;
    else updated += 1;
    jobIds.push(result.job.id);
  }

  const profile = await prisma.candidateProfile.findUnique({ where: { userId } });
  if (profile) {
    for (const jobId of jobIds) {
      await matchJobForProfile(profile.id, jobId);
      await discoverJobEmail(jobId);
    }
  }

  return { created, updated, total: jobIds.length, jobIds };
}

export async function upsertNormalizedJob(job: NormalizedJob) {
  const source = await prisma.jobSource.upsert({
    where: { sourceKey: job.source },
    update: {},
    create: { sourceKey: job.source, name: job.source, enabled: true },
  });

  const existing =
    (await prisma.job.findUnique({
      where: { sourceId_sourceJobId: { sourceId: source.id, sourceJobId: job.sourceJobId } },
    })) ??
    (job.applicationUrl
      ? await prisma.job.findFirst({ where: { applicationUrl: job.applicationUrl } })
      : null) ??
    (job.canonicalUrl
      ? await prisma.job.findFirst({ where: { canonicalUrl: job.canonicalUrl } })
      : null) ??
    (await prisma.job.findUnique({ where: { fingerprint: job.fingerprint } }));

  const company = await prisma.company.upsert({
    where: { slug: job.companySlug || job.fingerprint.slice(0, 40) },
    update: { name: job.company, website: job.companyUrl ?? undefined },
    create: {
      name: job.company,
      slug: job.companySlug || `${source.sourceKey}-${job.sourceJobId}`.slice(0, 80),
      website: job.companyUrl,
    },
  });

  const data = {
    title: job.title,
    normalizedTitle: job.normalizedTitle,
    companyId: company.id,
    location: job.location,
    normalizedLocation: job.normalizedLocation,
    remoteType: job.remoteType,
    employmentType: job.employmentType,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    currency: job.currency,
    description: job.description,
    descriptionText: job.descriptionText,
    requirements: job.requirements,
    niceToHave: job.niceToHave,
    experienceRequired: job.experienceRequired,
    educationRequired: job.educationRequired,
    applicationUrl: job.applicationUrl,
    applicationEmail: job.applicationEmail,
    postedAt: job.postedAt,
    sourceId: source.id,
    sourceJobId: job.sourceJobId,
    originalUrl: job.originalUrl,
    canonicalUrl: job.canonicalUrl,
    fingerprint: existing?.fingerprint ?? job.fingerprint,
  };

  if (existing) {
    const updated = await prisma.job.update({ where: { id: existing.id }, data });
    await syncJobSkills(updated.id, job.skills);
    return { job: updated, created: false };
  }

  try {
    const createdJob = await prisma.job.create({ data });
    await syncJobSkills(createdJob.id, job.skills);
    return { job: createdJob, created: true };
  } catch (error) {
    const fallback = await prisma.job.findUnique({ where: { fingerprint: job.fingerprint } });
    if (fallback) {
      const updated = await prisma.job.update({ where: { id: fallback.id }, data });
      return { job: updated, created: false };
    }
    throw error;
  }
}

async function syncJobSkills(jobId: string, names: string[]) {
  const records = await Promise.all(
    names.slice(0, 24).map((name) =>
      prisma.skill.upsert({
        where: { slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-') },
        update: { name },
        create: { name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-') },
      }),
    ),
  );
  await prisma.jobSkill.deleteMany({ where: { jobId } });
  if (records.length) {
    await prisma.jobSkill.createMany({
      data: records.map((skill) => ({ jobId, skillId: skill.id, required: true })),
      skipDuplicates: true,
    });
  }
}

export async function runDiscovery(userId: string, searchProfileId?: string) {
  const profile = await requireProfile(userId);
  const searchProfiles = await prisma.searchProfile.findMany({
    where: { userId, enabled: true, ...(searchProfileId ? { id: searchProfileId } : {}) },
  });
  if (searchProfiles.length === 0) {
    return { created: 0, updated: 0, runs: [] as unknown[] };
  }

  const enabledSources = await prisma.jobSource.findMany({ where: { enabled: true } });
  const runs = [];
  let created = 0;
  let updated = 0;

  for (const search of searchProfiles) {
    const queries = generateSearchQueries({
      targetTitles: asStringArray(search.targetTitles),
      targetLocations: asStringArray(search.targetLocations),
      remotePreference: search.remotePreference,
    });

    await prisma.searchQuery.deleteMany({ where: { searchProfileId: search.id } });
    await prisma.searchQuery.createMany({
      data: queries.map((q) => ({
        searchProfileId: search.id,
        query: q.query,
        location: q.location,
      })),
    });

    for (const query of queries) {
      for (const sourceRow of enabledSources) {
        const source = sourceRegistry.get(sourceRow.sourceKey);
        if (!source) continue;
        const run = await prisma.scrapeRun.create({
          data: { sourceId: sourceRow.id, status: 'RUNNING' },
        });
        try {
          const raw = await source.search({ query: query.query, location: query.location });
          const limited = raw.slice(0, env.SCRAPE_MAX_JOBS_PER_SOURCE);
          const result = await ingestRawJobs(limited, userId);
          created += result.created;
          updated += result.updated;
          await prisma.scrapeRun.update({
            where: { id: run.id },
            data: {
              status: 'COMPLETED',
              finishedAt: new Date(),
              jobsFound: limited.length,
              jobsCreated: result.created,
              jobsUpdated: result.updated,
            },
          });
          await prisma.jobSource.update({
            where: { id: sourceRow.id },
            data: { lastRunAt: new Date(), lastError: null },
          });
          runs.push({ source: source.id, query: query.query, ...result, status: 'COMPLETED' });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Source failed';
          logger.warn({ err: error, source: source.id, query: query.query }, 'Source failed');
          await prisma.scrapeRun.update({
            where: { id: run.id },
            data: { status: 'FAILED', finishedAt: new Date(), error: message },
          });
          await prisma.jobSource.update({
            where: { id: sourceRow.id },
            data: { lastError: message, lastRunAt: new Date() },
          });
          await notify(userId, {
            type: 'SOURCE_FAILED',
            title: `${source.name} failed`,
            body: message,
            href: '/settings',
          });
          runs.push({ source: source.id, query: query.query, status: 'FAILED', error: message });
        }
      }
    }

    await prisma.searchProfile.update({
      where: { id: search.id },
      data: { lastRunAt: new Date() },
    });
  }

  const strong = await prisma.jobMatch.count({
    where: {
      candidateProfileId: profile.id,
      matchScore: { gte: 80 },
      analyzedAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
    },
  });
  if (strong > 0) {
    await notify(userId, {
      type: 'STRONG_MATCH',
      title: `${strong} strong Job Match Score${strong === 1 ? '' : 's'}`,
      body: 'New roles met your minimum Job Match Score. This is not a hiring probability.',
      href: '/jobs?minScore=80',
    });
  }

  await logActivity(userId, 'DISCOVERY', `Discovery finished. Created ${created}, updated ${updated}.`);
  return { created, updated, runs };
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}
