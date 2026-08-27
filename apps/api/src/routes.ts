import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '@job-hunter/database';
import {
  applicationEmailDraftSchema,
  applicationStatusPatchSchema,
  candidateUpdateSchema,
  jobFilterSchema,
  searchProfileSchema,
  userSettingsSchema,
  emailAccountSchema,
} from '@job-hunter/shared';
import { getCurrentUser, requireProfile } from './services/context.js';
import { updateCandidate, uploadResume } from './services/candidate.js';
import { runDiscovery } from './services/ingestion.js';
import { matchJobForProfile } from './services/matching-service.js';
import {
  approveApplication,
  generateApplication,
  patchStatus,
  sendApplication,
  sendFollowUp,
} from './services/applications.js';
import { getAnalytics, getDashboard } from './services/analytics.js';
import { sourceRegistry } from './scrapers/index.js';
import { badRequest, notFound } from './lib/errors.js';

async function userId() {
  return (await getCurrentUser()).id;
}

function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw badRequest(result.error.issues.map((i) => i.message).join('; '));
  }
  return result.data;
}

export async function registerRoutes(app: FastifyInstance) {
  app.get('/health', async () => ({ ok: true }));
  app.get('/api/health', async () => ({ ok: true, service: 'job-hunter-api' }));

  app.get('/api/dashboard', async () => getDashboard());
  app.get('/api/analytics', async () => getAnalytics());

  app.post('/api/resumes', async (request) => {
    const file = await request.file();
    if (!file) throw badRequest('Resume file is required');
    const buffer = await file.toBuffer();
    return uploadResume({ filename: file.filename, mimetype: file.mimetype, buffer });
  });

  app.get('/api/resumes', async () => {
    const id = await userId();
    return prisma.resume.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' } });
  });

  app.get('/api/candidate', async () => {
    const user = await getCurrentUser();
    if (!user.candidateProfile) return { profile: null };
    return {
      profile: await prisma.candidateProfile.findUnique({
        where: { id: user.candidateProfile.id },
        include: { skills: { include: { skill: true } }, resumes: true },
      }),
    };
  });

  app.put('/api/candidate', async (request) => {
    const id = await userId();
    parse(candidateUpdateSchema, request.body);
    return { profile: await updateCandidate(id, request.body) };
  });

  app.get('/api/search-profiles', async () => {
    const id = await userId();
    return prisma.searchProfile.findMany({
      where: { userId: id },
      include: { queries: true },
      orderBy: { createdAt: 'desc' },
    });
  });

  app.post('/api/search-profiles', async (request) => {
    const id = await userId();
    const profile = await requireProfile(id);
    const data = parse(searchProfileSchema, request.body);
    return prisma.searchProfile.create({
      data: { ...data, userId: id, candidateProfileId: profile.id },
    });
  });

  app.put('/api/search-profiles/:id', async (request) => {
    const id = await userId();
    const params = request.params as { id: string };
    const existing = await prisma.searchProfile.findFirst({ where: { id: params.id, userId: id } });
    if (!existing) throw notFound('Search profile not found');
    const data = parse(searchProfileSchema.partial(), request.body);
    return prisma.searchProfile.update({ where: { id: existing.id }, data });
  });

  app.delete('/api/search-profiles/:id', async (request) => {
    const id = await userId();
    const params = request.params as { id: string };
    await prisma.searchProfile.deleteMany({ where: { id: params.id, userId: id } });
    return { ok: true };
  });

  app.post('/api/jobs/search', async (request) => {
    const id = await userId();
    const body = z.object({ searchProfileId: z.string().optional() }).parse(request.body ?? {});
    return runDiscovery(id, body.searchProfileId);
  });

  app.get('/api/jobs', async (request) => {
    const id = await userId();
    const profile = await prisma.candidateProfile.findUnique({ where: { userId: id } });
    const query = parse(jobFilterSchema, request.query);
    const where: Record<string, unknown> = { archived: false };
    if (query.q) {
      where.OR = [
        { title: { contains: query.q, mode: 'insensitive' } },
        { company: { name: { contains: query.q, mode: 'insensitive' } } },
        { location: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    if (query.remoteType) where.remoteType = query.remoteType;
    if (query.location) where.normalizedLocation = { contains: query.location, mode: 'insensitive' };
    if (query.employmentType) where.employmentType = query.employmentType;
    if (query.hasEmail === true) where.applicationEmail = { not: null };
    if (query.hasEmail === false) where.applicationEmail = null;
    if (query.source) where.source = { sourceKey: query.source };
    if (query.from) where.postedAt = { gte: new Date(query.from) };

    const matchesWhere: Record<string, unknown> = {};
    if (profile) matchesWhere.candidateProfileId = profile.id;
    if (query.minScore != null) matchesWhere.matchScore = { gte: query.minScore };
    if (query.maxScore != null) {
      matchesWhere.matchScore = {
        ...(typeof matchesWhere.matchScore === 'object' ? matchesWhere.matchScore : {}),
        lte: query.maxScore,
      };
    }

    const orderBy = sortJobs(query.sort, query.order);
    const [items, total] = await Promise.all([
      prisma.job.findMany({
        where: {
          ...where,
          ...(query.minScore != null || query.maxScore != null
            ? { matches: { some: matchesWhere } }
            : {}),
        },
        include: {
          company: true,
          source: true,
          skills: { include: { skill: true } },
          matches: profile ? { where: { candidateProfileId: profile.id }, take: 1 } : false,
          applications: { where: { userId: id }, take: 1 },
        },
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.job.count({
        where: {
          ...where,
          ...(query.minScore != null || query.maxScore != null
            ? { matches: { some: matchesWhere } }
            : {}),
        },
      }),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize };
  });

  app.get('/api/jobs/:id', async (request) => {
    const id = await userId();
    const params = request.params as { id: string };
    const profile = await prisma.candidateProfile.findUnique({ where: { userId: id } });
    const job = await prisma.job.findUnique({
      where: { id: params.id },
      include: {
        company: true,
        source: true,
        skills: { include: { skill: true } },
        contactEmails: true,
        matches: profile ? { where: { candidateProfileId: profile.id } } : false,
        applications: { where: { userId: id }, include: { emails: true } },
      },
    });
    if (!job) throw notFound('Job not found');
    return job;
  });

  app.post('/api/jobs/:id/analyze', async (request) => {
    const id = await userId();
    const profile = await requireProfile(id);
    const params = request.params as { id: string };
    return matchJobForProfile(profile.id, params.id);
  });

  app.post('/api/jobs/:id/generate-application', async (request) => {
    const id = await userId();
    const params = request.params as { id: string };
    return generateApplication(id, params.id);
  });

  app.get('/api/matches', async (request) => {
    const id = await userId();
    const profile = await requireProfile(id);
    const query = request.query as { minScore?: string };
    return prisma.jobMatch.findMany({
      where: {
        candidateProfileId: profile.id,
        ...(query.minScore ? { matchScore: { gte: Number(query.minScore) } } : {}),
      },
      include: { job: { include: { company: true, source: true } } },
      orderBy: { matchScore: 'desc' },
      take: 100,
    });
  });

  app.get('/api/matches/:id', async (request) => {
    const params = request.params as { id: string };
    const match = await prisma.jobMatch.findUnique({
      where: { id: params.id },
      include: { job: { include: { company: true, source: true, skills: { include: { skill: true } } } } },
    });
    if (!match) throw notFound('Match not found');
    return match;
  });

  app.get('/api/applications', async () => {
    const id = await userId();
    return prisma.application.findMany({
      where: { userId: id },
      include: {
        job: { include: { company: true, source: true, matches: { take: 1 } } },
        emails: true,
        statusEvents: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  });

  app.get('/api/applications/:id', async (request) => {
    const id = await userId();
    const params = request.params as { id: string };
    const application = await prisma.application.findFirst({
      where: { id: params.id, userId: id },
      include: {
        job: { include: { company: true, source: true, matches: true } },
        emails: true,
        statusEvents: true,
        candidateProfile: true,
      },
    });
    if (!application) throw notFound('Application not found');
    return application;
  });

  app.post('/api/applications/:id/approve', async (request) => {
    const id = await userId();
    const params = request.params as { id: string };
    const draft = request.body ? parse(applicationEmailDraftSchema.partial(), request.body) : undefined;
    return approveApplication(id, params.id, draft);
  });

  app.post('/api/applications/:id/send', async (request) => {
    const id = await userId();
    const params = request.params as { id: string };
    return sendApplication(id, params.id);
  });

  app.post('/api/applications/:id/follow-up', async (request) => {
    const id = await userId();
    const params = request.params as { id: string };
    return sendFollowUp(id, params.id);
  });

  app.patch('/api/applications/:id/status', async (request) => {
    const id = await userId();
    const params = request.params as { id: string };
    const body = parse(applicationStatusPatchSchema, request.body);
    return patchStatus(id, params.id, body.status, body.notes);
  });

  app.get('/api/sources', async () => {
    const rows = await prisma.jobSource.findMany({ orderBy: { name: 'asc' } });
    return rows.map((row) => ({
      ...row,
      implemented: Boolean(sourceRegistry.get(row.sourceKey)),
    }));
  });

  app.post('/api/sources/:id/test', async (request) => {
    const params = request.params as { id: string };
    const row = await prisma.jobSource.findFirst({
      where: { OR: [{ id: params.id }, { sourceKey: params.id }] },
    });
    if (!row) throw notFound('Source not found');
    const source = sourceRegistry.get(row.sourceKey);
    if (!source) throw badRequest('Source is not implemented');
    return source.test();
  });

  app.patch('/api/sources/:id', async (request) => {
    const params = request.params as { id: string };
    const body = z
      .object({ enabled: z.boolean().optional(), config: z.unknown().optional() })
      .parse(request.body ?? {});
    const row = await prisma.jobSource.findFirst({
      where: { OR: [{ id: params.id }, { sourceKey: params.id }] },
    });
    if (!row) throw notFound('Source not found');
    return prisma.jobSource.update({
      where: { id: row.id },
      data: {
        enabled: body.enabled,
        config: body.config === undefined ? undefined : (body.config as object),
      },
    });
  });

  app.get('/api/notifications', async () => {
    const id = await userId();
    return prisma.notification.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  });

  app.post('/api/notifications/:id/read', async (request) => {
    const id = await userId();
    const params = request.params as { id: string };
    await prisma.notification.updateMany({ where: { id: params.id, userId: id }, data: { read: true } });
    return { ok: true };
  });

  app.post('/api/notifications/read-all', async () => {
    const id = await userId();
    await prisma.notification.updateMany({ where: { userId: id, read: false }, data: { read: true } });
    return { ok: true };
  });

  app.get('/api/settings', async () => {
    const user = await getCurrentUser();
    const accounts = await prisma.emailAccount.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        provider: true,
        host: true,
        port: true,
        username: true,
        fromEmail: true,
        secure: true,
        enabled: true,
      },
    });
    return { settings: user.settings, emailAccounts: accounts };
  });

  app.put('/api/settings', async (request) => {
    const id = await userId();
    const data = parse(userSettingsSchema, request.body);
    return prisma.userSettings.upsert({
      where: { userId: id },
      update: data,
      create: { userId: id, ...data },
    });
  });

  app.post('/api/email-accounts', async (request) => {
    const id = await userId();
    const data = parse(emailAccountSchema, request.body);
    return prisma.emailAccount.create({
      data: { ...data, userId: id },
      select: {
        id: true,
        provider: true,
        host: true,
        port: true,
        username: true,
        fromEmail: true,
        enabled: true,
      },
    });
  });

  app.get('/api/activity', async () => {
    const id = await userId();
    return prisma.activityLog.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  });

  void (0 as unknown as FastifyRequest);
}

function sortJobs(sort?: string, order?: string) {
  const dir = order === 'asc' ? 'asc' : 'desc';
  switch (sort) {
    case 'date':
      return { postedAt: dir } as const;
    case 'salary':
      return { salaryMax: dir } as const;
    case 'company':
      return { company: { name: dir } } as const;
    case 'location':
      return { normalizedLocation: dir } as const;
    case 'match':
    default:
      return { createdAt: 'desc' } as const;
  }
}
