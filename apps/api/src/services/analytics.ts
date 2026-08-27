import { prisma } from '@job-hunter/database';
import { getCurrentUser } from './context.js';

export async function getAnalytics() {
  const user = await getCurrentUser();
  const [jobs, matches, applications, avg] = await Promise.all([
    prisma.job.count({ where: { archived: false } }),
    prisma.jobMatch.count({
      where: { candidateProfile: { userId: user.id }, matchScore: { gte: 70 } },
    }),
    prisma.application.findMany({ where: { userId: user.id } }),
    prisma.jobMatch.aggregate({
      where: { candidateProfile: { userId: user.id } },
      _avg: { matchScore: true },
    }),
  ]);

  const sent = applications.filter((a) => a.sentAt).length;
  const responses = applications.filter((a) =>
    ['RESPONSE', 'INTERVIEW', 'OFFER'].includes(a.status),
  ).length;
  const interviews = applications.filter((a) =>
    ['INTERVIEW', 'OFFER'].includes(a.status),
  ).length;
  const offers = applications.filter((a) => a.status === 'OFFER').length;

  const byStatus = countBy(applications.map((a) => a.status));
  const jobsForApps = await prisma.application.findMany({
    where: { userId: user.id },
    include: { job: { include: { company: true, source: true } } },
  });

  return {
    jobsDiscovered: jobs,
    jobsMatched: matches,
    applicationsSent: sent,
    responseRate: rate(responses, sent),
    interviewRate: rate(interviews, sent),
    offerRate: rate(offers, sent),
    averageMatchScore: Math.round(avg._avg.matchScore ?? 0),
    byStatus,
    byLocation: countBy(jobsForApps.map((a) => a.job.normalizedLocation ?? a.job.location ?? 'Unknown')),
    byRole: countBy(jobsForApps.map((a) => a.job.normalizedTitle || a.job.title)),
    bySource: countBy(jobsForApps.map((a) => a.job.source.name)),
    disclaimer:
      'Job Match Score measures profile-to-job similarity. It is not a probability of being hired.',
  };
}

export async function getDashboard() {
  const user = await getCurrentUser();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const profile = user.candidateProfile;
  const [newJobs, strong, review, sent, responses, interviews, offers, recentJobs, notifications] =
    await Promise.all([
      prisma.job.count({ where: { createdAt: { gte: start }, archived: false } }),
      profile
        ? prisma.jobMatch.count({
            where: { candidateProfileId: profile.id, matchScore: { gte: 80 } },
          })
        : 0,
      prisma.application.count({ where: { userId: user.id, status: 'REVIEW' } }),
      prisma.application.count({ where: { userId: user.id, sentAt: { not: null } } }),
      prisma.application.count({
        where: { userId: user.id, status: { in: ['RESPONSE', 'INTERVIEW', 'OFFER'] } },
      }),
      prisma.application.count({
        where: { userId: user.id, status: { in: ['INTERVIEW', 'OFFER'] } },
      }),
      prisma.application.count({ where: { userId: user.id, status: 'OFFER' } }),
      prisma.job.findMany({
        where: { archived: false },
        include: {
          company: true,
          source: true,
          matches: profile ? { where: { candidateProfileId: profile.id }, take: 1 } : false,
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
    ]);

  return {
    metrics: {
      newJobs,
      strongMatches: strong,
      readyToApply: review,
      applicationsSent: sent,
      responses,
      interviews,
      offers,
    },
    recentJobs,
    notifications,
  };
}

function countBy(values: string[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const value of values) {
    const key = value || 'Unknown';
    result[key] = (result[key] ?? 0) + 1;
  }
  return result;
}

function rate(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}
