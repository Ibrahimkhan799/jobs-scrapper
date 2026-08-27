import { prisma, type Prisma } from '@job-hunter/database';
import { notFound } from '../lib/errors.js';

export async function getCurrentUser() {
  const email = process.env.DEFAULT_USER_EMAIL ?? 'demo@jobhunter.local';
  const user = await prisma.user.findUnique({
    where: { email },
    include: { settings: true, candidateProfile: true },
  });
  if (user) return user;
  return prisma.user.create({
    data: {
      email,
      name: 'Local user',
      settings: { create: {} },
    },
    include: { settings: true, candidateProfile: true },
  });
}

export async function requireProfile(userId: string) {
  const profile = await prisma.candidateProfile.findUnique({
    where: { userId },
    include: { skills: { include: { skill: true } } },
  });
  if (!profile) throw notFound('Candidate profile not found. Upload a CV first.');
  return profile;
}

export async function logActivity(
  userId: string,
  type: string,
  message: string,
  metadata?: Prisma.InputJsonValue,
) {
  await prisma.activityLog.create({ data: { userId, type, message, metadata } });
}

export async function notify(
  userId: string,
  input: { type: string; title: string; body: string; href?: string },
) {
  await prisma.notification.create({
    data: { userId, type: input.type, title: input.title, body: input.body, href: input.href },
  });
}
