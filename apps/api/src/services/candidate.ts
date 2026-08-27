import { randomUUID } from 'node:crypto';
import { prisma } from '@job-hunter/database';
import { candidateUpdateSchema, normalizeSkillName } from '@job-hunter/shared';
import type { ExtractedProfile } from '@job-hunter/shared';
import { env } from '../env.js';
import { extractProfileFromCv } from '../ai/extract.js';
import { storage } from '../storage/local.js';
import { assertResumeType, safeFileName } from '../lib/sanitize.js';
import { extractResumeText } from './resume-text.js';
import { getCurrentUser, logActivity } from './context.js';
import { badRequest } from '../lib/errors.js';

export async function uploadResume(file: {
  filename: string;
  mimetype: string;
  buffer: Buffer;
}) {
  if (file.buffer.length > env.MAX_FILE_SIZE) {
    throw badRequest(`File exceeds ${env.MAX_FILE_SIZE} bytes`);
  }
  assertResumeType(file.mimetype, file.filename);
  const user = await getCurrentUser();
  const storedFileName = `${Date.now()}-${randomUUID()}-${safeFileName(file.filename)}`;
  const storageKey = `${user.id}/${storedFileName}`;
  await storage.put(storageKey, file.buffer, file.mimetype);

  const resume = await prisma.resume.create({
    data: {
      userId: user.id,
      originalFileName: file.filename,
      storedFileName,
      mimeType: file.mimetype,
      sizeBytes: file.buffer.length,
      storageKey,
      parseStatus: 'PENDING',
      isPrimary: true,
    },
  });

  await prisma.resume.updateMany({
    where: { userId: user.id, id: { not: resume.id } },
    data: { isPrimary: false },
  });

  try {
    const text = await extractResumeText(file.buffer, file.mimetype, file.filename);
    const { profile, provider } = await extractProfileFromCv(text);
    const saved = await upsertCandidateFromExtraction(user.id, profile);
    await prisma.resume.update({
      where: { id: resume.id },
      data: {
        extractedText: text,
        parseStatus: 'COMPLETED',
        candidateProfileId: saved.id,
      },
    });
    await logActivity(user.id, 'RESUME_PARSED', `Parsed CV with ${provider} extractor`);
    return { resume: { ...resume, parseStatus: 'COMPLETED' }, profile: saved, provider };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Parse failed';
    await prisma.resume.update({
      where: { id: resume.id },
      data: { parseStatus: 'FAILED', parseError: message },
    });
    throw error;
  }
}

export async function upsertCandidateFromExtraction(userId: string, extracted: ExtractedProfile) {
  const profile = await prisma.candidateProfile.upsert({
    where: { userId },
    create: {
      userId,
      fullName: extracted.fullName,
      email: extracted.email,
      phone: extracted.phone,
      location: extracted.location,
      yearsOfExperience: extracted.yearsOfExperience,
      professionalSummary: extracted.professionalSummary,
      technologies: extracted.technologies,
      previousJobs: extracted.previousJobs,
      education: extracted.education,
      certifications: extracted.certifications,
      preferredRoles: extracted.preferredRoles,
      preferredLocations: extracted.preferredLocations,
      remotePreference: extracted.remotePreference ?? 'ANY',
      salaryMin: extracted.salaryMin,
      salaryMax: extracted.salaryMax,
      salaryCurrency: extracted.salaryCurrency,
      workAuthorization: extracted.workAuthorization,
      portfolioUrl: extracted.portfolioUrl,
      githubUrl: extracted.githubUrl,
      linkedinUrl: extracted.linkedinUrl,
    },
    update: {
      fullName: extracted.fullName,
      email: extracted.email,
      phone: extracted.phone,
      location: extracted.location,
      yearsOfExperience: extracted.yearsOfExperience,
      professionalSummary: extracted.professionalSummary,
      technologies: extracted.technologies,
      previousJobs: extracted.previousJobs,
      education: extracted.education,
      certifications: extracted.certifications,
      preferredRoles: extracted.preferredRoles,
      preferredLocations: extracted.preferredLocations,
      remotePreference: extracted.remotePreference ?? undefined,
      salaryMin: extracted.salaryMin,
      salaryMax: extracted.salaryMax,
      salaryCurrency: extracted.salaryCurrency,
      workAuthorization: extracted.workAuthorization,
      portfolioUrl: extracted.portfolioUrl,
      githubUrl: extracted.githubUrl,
      linkedinUrl: extracted.linkedinUrl,
    },
  });

  await syncSkills(profile.id, [...extracted.skills, ...extracted.technologies]);
  return prisma.candidateProfile.findUniqueOrThrow({
    where: { id: profile.id },
    include: { skills: { include: { skill: true } } },
  });
}

export async function updateCandidate(userId: string, input: unknown) {
  const data = candidateUpdateSchema.parse(input);
  const profile = await prisma.candidateProfile.upsert({
    where: { userId },
    create: {
      userId,
      ...omitSkills(data),
      remotePreference: data.remotePreference ?? 'ANY',
    },
    update: omitSkills(data),
  });
  if (data.skills) await syncSkills(profile.id, data.skills);
  await logActivity(userId, 'PROFILE_UPDATED', 'Candidate profile updated');
  return prisma.candidateProfile.findUniqueOrThrow({
    where: { id: profile.id },
    include: { skills: { include: { skill: true } } },
  });
}

function omitSkills<T extends { skills?: string[] }>(data: T) {
  const { skills: _skills, ...rest } = data;
  return rest;
}

export async function syncSkills(profileId: string, names: string[]) {
  const normalized = [...new Set(names.map(normalizeSkillName).filter(Boolean))];
  const skillRecords = await Promise.all(
    normalized.map((name) =>
      prisma.skill.upsert({
        where: { slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-') },
        update: { name },
        create: { name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-') },
      }),
    ),
  );
  await prisma.candidateSkill.deleteMany({
    where: { candidateProfileId: profileId, skillId: { notIn: skillRecords.map((s) => s.id) } },
  });
  for (const skill of skillRecords) {
    await prisma.candidateSkill.upsert({
      where: { candidateProfileId_skillId: { candidateProfileId: profileId, skillId: skill.id } },
      update: {},
      create: { candidateProfileId: profileId, skillId: skill.id },
    });
  }
}
