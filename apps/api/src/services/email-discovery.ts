import { extractEmail } from '@job-hunter/shared';
import { prisma } from '@job-hunter/database';
import { logger } from '../logger.js';
import { notify } from './context.js';

const RECRUITING_HINT = /(careers|jobs|recruiting|talent|hr|apply)@/i;

export async function discoverJobEmail(jobId: string) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { company: true, matches: { take: 1 } },
  });
  if (!job) return null;
  if (job.applicationEmail) {
    await prisma.jobContactEmail.upsert({
      where: { jobId_email: { jobId, email: job.applicationEmail } },
      update: {},
      create: {
        jobId,
        email: job.applicationEmail,
        source: 'job_listing',
        confidence: 0.95,
      },
    });
    return job.applicationEmail;
  }

  const fromDescription = extractEmail(`${job.descriptionText}\n${job.description}`);
  if (fromDescription) {
    const confidence = RECRUITING_HINT.test(fromDescription) ? 0.8 : 0.45;
    await prisma.job.update({ where: { id: jobId }, data: { applicationEmail: fromDescription } });
    await prisma.jobContactEmail.upsert({
      where: { jobId_email: { jobId, email: fromDescription } },
      update: { confidence },
      create: { jobId, email: fromDescription, source: 'job_listing', confidence },
    });
    const userId = job.matches[0]
      ? (await prisma.candidateProfile.findUnique({ where: { id: job.matches[0].candidateProfileId } }))
          ?.userId
      : undefined;
    if (userId) {
      await notify(userId, {
        type: 'EMAIL_DISCOVERED',
        title: 'Application email found',
        body: `A public recruiting email was found for ${job.title}.`,
        href: `/jobs/${job.id}`,
      });
    }
    return fromDescription;
  }

  logger.debug({ jobId }, 'No application email found; manual apply required');
  return null;
}
