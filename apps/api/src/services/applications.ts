import { prisma, type ApplicationStatus } from '@job-hunter/database';
import {
  generateApplicationEmail,
  validateGeneratedEmail,
  generatedEmailSchema,
  type ApplicationStatus as Status,
} from '@job-hunter/shared';
import { env } from '../env.js';
import { badRequest, notFound } from '../lib/errors.js';
import { storage } from '../storage/local.js';
import { accountEmailProvider, envEmailProvider } from '../email/providers.js';
import { logActivity, notify, requireProfile } from './context.js';
import { getAiProvider } from '../ai/providers.js';

export async function createOrGetApplication(userId: string, jobId: string) {
  const profile = await requireProfile(userId);
  const existing = await prisma.application.findUnique({
    where: { userId_jobId: { userId, jobId } },
  });
  if (existing) return existing;
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw notFound('Job not found');
  return prisma.application.create({
    data: {
      userId,
      jobId,
      candidateProfileId: profile.id,
      status: 'MATCHED',
      method: job.applicationEmail ? 'EMAIL' : 'MANUAL',
      recipientEmail: job.applicationEmail,
      statusEvents: { create: { toStatus: 'MATCHED' } },
    },
  });
}

export async function generateApplication(userId: string, jobId: string) {
  const profile = await requireProfile(userId);
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { company: true, matches: { where: { candidateProfileId: profile.id }, take: 1 } },
  });
  if (!job) throw notFound('Job not found');

  const candidate = {
    fullName: profile.fullName,
    email: profile.email,
    location: profile.location,
    yearsOfExperience: profile.yearsOfExperience,
    professionalSummary: profile.professionalSummary,
    skills: (await prisma.candidateSkill.findMany({
      where: { candidateProfileId: profile.id },
      include: { skill: true },
    })).map((row) => row.skill.name),
    previousJobs: asJobs(profile.previousJobs),
    githubUrl: profile.githubUrl,
    linkedinUrl: profile.linkedinUrl,
    portfolioUrl: profile.portfolioUrl,
  };

  let email = generateApplicationEmail(candidate, {
    title: job.title,
    company: job.company.name,
    location: job.location,
    matchedSkills: asStrings(job.matches[0]?.matchedSkills),
  });

  try {
    const provider = await getAiProvider();
    if (await provider.available()) {
      const ai = await provider.completeJson(
        `Write a concise, professional application email. Use only facts from the candidate. Never invent achievements.
Return JSON { "subject": string, "body": string }
Candidate: ${JSON.stringify(candidate)}
Job: ${JSON.stringify({ title: job.title, company: job.company.name, location: job.location })}`,
        generatedEmailSchema,
      );
      const parsed = generatedEmailSchema.parse(ai);
      const check = validateGeneratedEmail(parsed, candidate);
      if (check.ok) email = parsed;
    }
  } catch {
    // keep template email
  }

  const application = await createOrGetApplication(userId, jobId);
  const updated = await prisma.application.update({
    where: { id: application.id },
    data: {
      generatedSubject: email.subject,
      generatedBody: email.body,
      editedSubject: email.subject,
      editedBody: email.body,
      status: application.status === 'MATCHED' || application.status === 'DISCOVERED' ? 'REVIEW' : application.status,
      method: job.applicationEmail ? 'EMAIL' : 'MANUAL',
      recipientEmail: job.applicationEmail,
    },
  });
  if (updated.status === 'REVIEW') {
    await prisma.applicationStatusEvent.create({
      data: { applicationId: updated.id, fromStatus: application.status, toStatus: 'REVIEW' },
    });
    await notify(userId, {
      type: 'REVIEW',
      title: 'Application needs review',
      body: `${job.title} at ${job.company.name} is ready to review. Sending stays off until you approve.`,
      href: `/applications/${updated.id}`,
    });
  }
  return updated;
}

export async function approveApplication(userId: string, applicationId: string, draft?: {
  subject?: string;
  body?: string;
  recipientEmail?: string | null;
  attachCv?: boolean;
}) {
  const application = await getOwnedApplication(userId, applicationId);
  const updated = await prisma.application.update({
    where: { id: application.id },
    data: {
      status: 'APPROVED',
      approvedAt: new Date(),
      editedSubject: draft?.subject ?? application.editedSubject ?? application.generatedSubject,
      editedBody: draft?.body ?? application.editedBody ?? application.generatedBody,
      recipientEmail: draft?.recipientEmail ?? application.recipientEmail,
      attachCv: draft?.attachCv ?? application.attachCv,
    },
  });
  await prisma.applicationStatusEvent.create({
    data: { applicationId: application.id, fromStatus: application.status, toStatus: 'APPROVED' },
  });
  return updated;
}

export async function sendApplication(userId: string, applicationId: string, options?: { force?: boolean }) {
  const application = await getOwnedApplication(userId, applicationId);
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  if (application.status !== 'APPROVED' && !settings?.allowAutomatedSending && !options?.force) {
    throw badRequest('Approve the application before sending. Automated sending is off by default.');
  }
  if (!application.recipientEmail) {
    throw badRequest('No application email. Use the job application URL instead.');
  }

  const sentToday = await prisma.application.count({
    where: { userId, sentAt: { gte: startOfDay() } },
  });
  const limit = settings?.dailyApplicationLimit ?? 10;
  if (sentToday >= limit) {
    throw badRequest(`Daily application limit of ${limit} reached`);
  }

  const account = await prisma.emailAccount.findFirst({ where: { userId, enabled: true } });
  const provider = account ? accountEmailProvider(account) : envEmailProvider();
  if (!provider) {
    throw badRequest('No SMTP account configured. Add one in Settings or set SMTP_* env vars.');
  }

  const subject = application.editedSubject ?? application.generatedSubject;
  const body = application.editedBody ?? application.generatedBody;
  if (!subject || !body) throw badRequest('Generate an application email first');

  const attachments = [];
  if (application.attachCv) {
    const resume = await prisma.resume.findFirst({
      where: { userId, parseStatus: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
    });
    if (resume) {
      const content = await storage.get(resume.storageKey);
      attachments.push({
        filename: resume.originalFileName,
        content,
        contentType: resume.mimeType,
      });
    }
  }

  const from = account?.fromEmail ?? env.SMTP_FROM ?? env.DEFAULT_USER_EMAIL;
  const log = await prisma.applicationEmail.create({
    data: {
      applicationId: application.id,
      emailAccountId: account?.id,
      kind: 'application',
      recipient: application.recipientEmail,
      subject,
      body,
      status: 'QUEUED',
    },
  });

  try {
    await provider.send({
      from,
      to: application.recipientEmail,
      subject,
      text: body,
      attachments,
    });
    await prisma.applicationEmail.update({
      where: { id: log.id },
      data: { status: 'SENT', sentAt: new Date() },
    });
    const updated = await prisma.application.update({
      where: { id: application.id },
      data: { status: 'APPLIED', sentAt: new Date() },
    });
    await prisma.applicationStatusEvent.create({
      data: { applicationId: application.id, fromStatus: application.status, toStatus: 'APPLIED' },
    });
    await notify(userId, {
      type: 'APPLICATION_SENT',
      title: 'Application sent',
      body: `Email sent to ${application.recipientEmail}`,
      href: `/applications/${application.id}`,
    });
    await logActivity(userId, 'APPLICATION_SENT', `Sent application ${application.id}`);
    return updated;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Send failed';
    await prisma.applicationEmail.update({
      where: { id: log.id },
      data: { status: 'FAILED', error: message },
    });
    await notify(userId, {
      type: 'EMAIL_BOUNCED',
      title: 'Application email failed',
      body: message,
      href: `/applications/${application.id}`,
    });
    throw badRequest(message, 'EMAIL_FAILED');
  }
}

export async function sendFollowUp(userId: string, applicationId: string) {
  const application = await getOwnedApplication(userId, applicationId);
  if (!application.sentAt) throw badRequest('Send the original application first');
  const subject = `Follow-up: ${application.editedSubject ?? application.generatedSubject}`;
  const body = `Hello,\n\nI wanted to follow up on my application. Happy to share more detail if useful.\n\nThank you`;
  await prisma.application.update({
    where: { id: application.id },
    data: { status: 'FOLLOW_UP', followUpAt: new Date() },
  });
  const previous = application.status;
  await prisma.applicationStatusEvent.create({
    data: { applicationId: application.id, fromStatus: previous, toStatus: 'FOLLOW_UP' },
  });
  if (application.recipientEmail) {
    const account = await prisma.emailAccount.findFirst({ where: { userId, enabled: true } });
    const provider = account ? accountEmailProvider(account) : envEmailProvider();
    if (provider) {
      await provider.send({
        from: account?.fromEmail ?? env.SMTP_FROM ?? env.DEFAULT_USER_EMAIL,
        to: application.recipientEmail,
        subject,
        text: body,
      });
    }
  }
  return prisma.application.findUniqueOrThrow({ where: { id: application.id } });
}

export async function patchStatus(userId: string, applicationId: string, status: Status, notes?: string) {
  const application = await getOwnedApplication(userId, applicationId);
  if (application.status === status) return application;
  const data: Record<string, unknown> = { status, notes };
  if (status === 'ARCHIVED') data.archivedAt = new Date();
  if (status === 'REJECTED') data.rejectedAt = new Date();
  if (status === 'RESPONSE') data.responseAt = new Date();
  if (status === 'INTERVIEW') data.interviewAt = new Date();
  if (status === 'OFFER') data.offerAt = new Date();
  const updated = await prisma.application.update({
    where: { id: application.id },
    data,
  });
  await prisma.applicationStatusEvent.create({
    data: { applicationId: application.id, fromStatus: application.status, toStatus: status as ApplicationStatus },
  });
  return updated;
}

async function getOwnedApplication(userId: string, applicationId: string) {
  const application = await prisma.application.findFirst({
    where: { id: applicationId, userId },
  });
  if (!application) throw notFound('Application not found');
  return application;
}

function startOfDay() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function asJobs(value: unknown): Array<{ title: string; company?: string | null }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || typeof (item as { title?: unknown }).title !== 'string') {
      return [];
    }
    const row = item as { title: string; company?: string | null };
    return [{ title: row.title, company: row.company }];
  });
}
