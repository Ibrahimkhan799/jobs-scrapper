import { config } from 'dotenv';
import { resolve } from 'node:path';
import { PrismaClient, type ApplicationStatus, type RemoteType } from '@prisma/client';
import { jobFingerprint, normalizeTitle, normalizeLocation, recommendationFromScore } from '@job-hunter/shared';

config({ path: resolve(process.cwd(), '../../.env') });
config({ path: resolve(process.cwd(), '.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding demo data...');

  await prisma.notification.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.applicationEmail.deleteMany();
  await prisma.applicationStatusEvent.deleteMany();
  await prisma.application.deleteMany();
  await prisma.jobMatch.deleteMany();
  await prisma.jobContactEmail.deleteMany();
  await prisma.jobSkill.deleteMany();
  await prisma.job.deleteMany();
  await prisma.searchQuery.deleteMany();
  await prisma.scrapeRun.deleteMany();
  await prisma.searchProfile.deleteMany();
  await prisma.candidateSkill.deleteMany();
  await prisma.resume.deleteMany();
  await prisma.candidateProfile.deleteMany();
  await prisma.emailAccount.deleteMany();
  await prisma.userSettings.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();
  await prisma.jobSource.deleteMany();
  await prisma.skill.deleteMany();

  const skillNames = [
    'React',
    'TypeScript',
    'Next.js',
    'Node.js',
    'JavaScript',
    'Tailwind CSS',
    'PostgreSQL',
    'GraphQL',
    'AWS',
    'Docker',
    'Playwright',
    'Python',
    'Java',
    'Spring',
    'Kafka',
    'Go',
    'Kubernetes',
    'Figma',
  ];

  const skills = await Promise.all(
    skillNames.map((name) =>
      prisma.skill.create({
        data: { name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-') },
      }),
    ),
  );
  const skillByName = Object.fromEntries(skills.map((s) => [s.name, s]));

  const user = await prisma.user.create({
    data: {
      email: 'demo@jobhunter.local',
      name: 'Sam Rivera (Demo)',
      settings: {
        create: {
          allowAutomatedSending: false,
          dailyApplicationLimit: 10,
          discoveryIntervalHours: 12,
          minMatchScore: 80,
        },
      },
    },
  });

  const profile = await prisma.candidateProfile.create({
    data: {
      userId: user.id,
      fullName: 'Sam Rivera',
      email: 'sam.rivera.demo@example.com',
      phone: '+971 50 000 0000',
      location: 'Dubai',
      yearsOfExperience: 6,
      professionalSummary:
        'Frontend engineer focused on React, TypeScript, and Next.js. Builds compact product UIs and cares about accessibility, performance, and honest communication. Demo profile for local development.',
      technologies: ['React', 'TypeScript', 'Next.js', 'Node.js', 'Tailwind CSS', 'PostgreSQL'],
      previousJobs: [
        {
          title: 'Senior Frontend Developer',
          company: 'Northwind Labs (Demo)',
          startDate: '2022-03',
          endDate: null,
          current: true,
          location: 'Remote',
          description: 'Shipped product UI in React and TypeScript.',
        },
        {
          title: 'Frontend Developer',
          company: 'Cedar & Oak Studio (Demo)',
          startDate: '2019-06',
          endDate: '2022-02',
          location: 'Dubai',
          description: 'Built marketing and dashboard interfaces.',
        },
      ],
      education: [
        {
          school: 'Demo University',
          degree: 'B.S.',
          field: 'Computer Science',
          startDate: '2014',
          endDate: '2018',
        },
      ],
      certifications: [{ name: 'Demo Accessibility Certificate', issuer: 'Demo Org', year: '2023' }],
      preferredRoles: ['Frontend Developer', 'React Developer', 'Next.js Developer'],
      preferredLocations: ['Remote', 'Dubai', 'Riyadh', 'Doha', 'Abu Dhabi'],
      remotePreference: 'REMOTE',
      salaryMin: 90000,
      salaryMax: 140000,
      salaryCurrency: 'USD',
      workAuthorization: 'UAE resident (demo)',
      githubUrl: 'https://github.com/example',
      linkedinUrl: 'https://linkedin.com/in/example',
      portfolioUrl: 'https://example.com',
    },
  });

  await prisma.candidateSkill.createMany({
    data: ['React', 'TypeScript', 'Next.js', 'Node.js', 'JavaScript', 'Tailwind CSS', 'PostgreSQL', 'GraphQL', 'Playwright'].map(
      (name, index) => ({
        candidateProfileId: profile.id,
        skillId: skillByName[name].id,
        isPrimary: index < 4,
        years: Math.max(2, 6 - index),
      }),
    ),
  });

  const remotive = await prisma.jobSource.create({
    data: {
      sourceKey: 'remotive',
      name: 'Remotive',
      description: 'Public remote job API. Reference implementation.',
      enabled: true,
    },
  });
  const remoteok = await prisma.jobSource.create({
    data: {
      sourceKey: 'remoteok',
      name: 'RemoteOK',
      description: 'Public remote job JSON feed.',
      enabled: true,
    },
  });
  const arbeitnow = await prisma.jobSource.create({
    data: {
      sourceKey: 'arbeitnow',
      name: 'Arbeitnow',
      description: 'Public job board API.',
      enabled: true,
    },
  });
  const rss = await prisma.jobSource.create({
    data: {
      sourceKey: 'rss',
      name: 'RSS feeds',
      description: 'Configurable public RSS/Atom job feeds.',
      enabled: true,
      config: { feeds: [] },
    },
  });
  const greenhouse = await prisma.jobSource.create({
    data: {
      sourceKey: 'greenhouse',
      name: 'Greenhouse boards',
      description: 'Public Greenhouse job board JSON. Requires company board tokens.',
      enabled: false,
      config: { boards: [] },
    },
  });
  const demoSource = await prisma.jobSource.create({
    data: {
      sourceKey: 'demo',
      name: 'Demo catalog',
      description: 'Seeded listings labeled as demo data. Not real openings.',
      enabled: false,
    },
  });

  void remoteok;
  void arbeitnow;
  void rss;
  void greenhouse;

  const companies = await Promise.all(
    [
      'Northwind Labs (Demo)',
      'Harbor Pine Digital (Demo)',
      'Cedar & Oak Studio (Demo)',
      'Lumen Field Software (Demo)',
      'Mirage Systems (Demo)',
      'Paperclip Robotics (Demo)',
    ].map((name) =>
      prisma.company.create({
        data: {
          name,
          slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
          website: 'https://example.com',
          isDemo: true,
        },
      }),
    ),
  );

  const jobsSpec: Array<{
    title: string;
    company: number;
    location: string;
    remote: RemoteType;
    salaryMin: number | null;
    salaryMax: number | null;
    skills: string[];
    email?: string | null;
    description: string;
    daysAgo: number;
  }> = [
    {
      title: 'Senior React Developer',
      company: 1,
      location: 'Remote',
      remote: 'REMOTE',
      salaryMin: 110000,
      salaryMax: 140000,
      skills: ['React', 'TypeScript', 'Next.js'],
      email: 'careers@harborpine.example',
      daysAgo: 1,
      description: 'Demo listing. Build product UI with React, TypeScript, and Next.js. 5 years experience.',
    },
    {
      title: 'Frontend Developer',
      company: 0,
      location: 'Dubai',
      remote: 'HYBRID',
      salaryMin: 95000,
      salaryMax: 125000,
      skills: ['React', 'TypeScript', 'Tailwind CSS'],
      email: 'jobs@northwind.example',
      daysAgo: 2,
      description: 'Demo listing. Frontend work in React and TypeScript. Hybrid in Dubai.',
    },
    {
      title: 'Next.js Developer',
      company: 2,
      location: 'Remote',
      remote: 'REMOTE',
      salaryMin: 100000,
      salaryMax: 130000,
      skills: ['Next.js', 'React', 'TypeScript'],
      daysAgo: 0,
      description: 'Demo listing. App Router, server components, and TypeScript.',
    },
    {
      title: 'React Developer',
      company: 3,
      location: 'Riyadh',
      remote: 'ONSITE',
      salaryMin: 85000,
      salaryMax: 110000,
      skills: ['React', 'JavaScript'],
      daysAgo: 4,
      description: 'Demo listing. On-site React work in Riyadh.',
    },
    {
      title: 'Full-Stack TypeScript Engineer',
      company: 4,
      location: 'Doha',
      remote: 'HYBRID',
      salaryMin: 105000,
      salaryMax: 135000,
      skills: ['TypeScript', 'Node.js', 'React', 'PostgreSQL'],
      email: 'talent@mirage.example',
      daysAgo: 3,
      description: 'Demo listing. TypeScript across React and Node.js with PostgreSQL.',
    },
    {
      title: 'UI Engineer',
      company: 1,
      location: 'Abu Dhabi',
      remote: 'HYBRID',
      salaryMin: 90000,
      salaryMax: 120000,
      skills: ['React', 'Figma', 'TypeScript'],
      daysAgo: 6,
      description: 'Demo listing. Design-system minded UI engineer.',
    },
    {
      title: 'JavaScript Developer',
      company: 2,
      location: 'Remote',
      remote: 'REMOTE',
      salaryMin: 70000,
      salaryMax: 95000,
      skills: ['JavaScript', 'React'],
      daysAgo: 1,
      description: 'Demo listing. Mid-level JavaScript and React.',
    },
    {
      title: 'Frontend Engineer (Playwright)',
      company: 3,
      location: 'Remote',
      remote: 'REMOTE',
      salaryMin: 100000,
      salaryMax: 128000,
      skills: ['React', 'TypeScript', 'Playwright'],
      daysAgo: 2,
      description: 'Demo listing. Frontend plus browser testing with Playwright.',
    },
    {
      title: 'Staff Frontend Engineer',
      company: 0,
      location: 'Remote',
      remote: 'REMOTE',
      salaryMin: 160000,
      salaryMax: 200000,
      skills: ['React', 'TypeScript', 'GraphQL'],
      daysAgo: 8,
      description: 'Demo listing. Staff-level frontend leadership. 10 years experience.',
    },
    {
      title: 'Junior Frontend Developer',
      company: 5,
      location: 'Dubai',
      remote: 'ONSITE',
      salaryMin: 45000,
      salaryMax: 60000,
      skills: ['HTML', 'CSS', 'JavaScript'],
      daysAgo: 5,
      description: 'Demo listing. Entry-level frontend role.',
    },
    {
      title: 'Java Backend Engineer',
      company: 4,
      location: 'Berlin',
      remote: 'ONSITE',
      salaryMin: 90000,
      salaryMax: 120000,
      skills: ['Java', 'Spring', 'Kafka'],
      daysAgo: 3,
      description: 'Demo listing. Java, Spring, Kafka. 8 years experience. Not a frontend role.',
    },
    {
      title: 'Platform Engineer',
      company: 5,
      location: 'London',
      remote: 'HYBRID',
      salaryMin: 120000,
      salaryMax: 150000,
      skills: ['Go', 'Kubernetes', 'AWS', 'Docker'],
      daysAgo: 7,
      description: 'Demo listing. Infrastructure and platform work.',
    },
    {
      title: 'GraphQL Frontend Developer',
      company: 1,
      location: 'Remote',
      remote: 'REMOTE',
      salaryMin: 108000,
      salaryMax: 132000,
      skills: ['React', 'GraphQL', 'TypeScript'],
      email: 'recruiting@harborpine.example',
      daysAgo: 1,
      description: 'Demo listing. React clients talking to GraphQL APIs.',
    },
    {
      title: 'Next.js Contractor',
      company: 2,
      location: 'Remote',
      remote: 'REMOTE',
      salaryMin: 90000,
      salaryMax: 120000,
      skills: ['Next.js', 'TypeScript'],
      daysAgo: 0,
      description: 'Demo listing. Contract Next.js work. Labeled demo data, not a real opening.',
    },
    {
      title: 'Accessibility-focused Frontend Developer',
      company: 0,
      location: 'Remote',
      remote: 'REMOTE',
      salaryMin: 98000,
      salaryMax: 125000,
      skills: ['React', 'TypeScript', 'JavaScript'],
      daysAgo: 2,
      description: 'Demo listing. Frontend with a focus on accessible UI.',
    },
  ];

  const createdJobs = [];
  for (const [index, spec] of jobsSpec.entries()) {
    const company = companies[spec.company];
    const titleNorm = normalizeTitle(spec.title);
    const locNorm = normalizeLocation(spec.location);
    const job = await prisma.job.create({
      data: {
        title: spec.title,
        normalizedTitle: titleNorm,
        companyId: company.id,
        location: spec.location,
        normalizedLocation: locNorm,
        remoteType: spec.remote,
        employmentType: spec.title.includes('Contract') ? 'CONTRACT' : 'FULL_TIME',
        salaryMin: spec.salaryMin,
        salaryMax: spec.salaryMax,
        currency: 'USD',
        description: `<p>${spec.description}</p><p>This is seeded demo data, not a real job opening.</p>`,
        descriptionText: `${spec.description} This is seeded demo data, not a real job opening.`,
        requirements: spec.skills,
        niceToHave: [],
        applicationUrl: `https://example.com/apply/demo-${index + 1}`,
        applicationEmail: spec.email ?? null,
        postedAt: new Date(Date.now() - spec.daysAgo * 86400000),
        sourceId: demoSource.id,
        sourceJobId: `demo-${index + 1}`,
        originalUrl: `https://example.com/jobs/demo-${index + 1}`,
        canonicalUrl: `https://example.com/jobs/demo-${index + 1}`,
        fingerprint: jobFingerprint({
          company: company.name,
          title: titleNorm,
          location: locNorm,
        }),
        isDemo: true,
      },
    });
    await prisma.jobSkill.createMany({
      data: spec.skills
        .filter((name) => skillByName[name])
        .map((name) => ({ jobId: job.id, skillId: skillByName[name].id, required: true })),
    });
    if (spec.email) {
      await prisma.jobContactEmail.create({
        data: {
          jobId: job.id,
          email: spec.email,
          source: 'job_listing',
          confidence: 0.9,
          verified: false,
        },
      });
    }
    createdJobs.push(job);
  }

  const { scoreJobMatch } = await import('@job-hunter/shared');
  const candidateSnap = {
    skills: ['React', 'TypeScript', 'Next.js', 'Node.js', 'JavaScript', 'Tailwind CSS', 'PostgreSQL', 'GraphQL', 'Playwright'],
    previousJobs: [
      { title: 'Senior Frontend Developer', company: 'Northwind Labs (Demo)' },
      { title: 'Frontend Developer', company: 'Cedar & Oak Studio (Demo)' },
    ],
    preferredRoles: ['Frontend Developer', 'React Developer', 'Next.js Developer'],
    preferredLocations: ['Remote', 'Dubai', 'Riyadh', 'Doha', 'Abu Dhabi'],
    remotePreference: 'REMOTE' as const,
    yearsOfExperience: 6,
    education: [{ degree: 'B.S.', field: 'Computer Science' }],
    salaryMin: 90000,
    salaryMax: 140000,
  };

  const matches = [];
  for (const job of createdJobs) {
    const jobSkills = jobsSpec[createdJobs.indexOf(job)].skills;
    const breakdown = scoreJobMatch(candidateSnap, {
      title: job.title,
      company: companies.find((c) => c.id === job.companyId)?.name ?? 'Demo',
      location: job.location,
      remoteType: job.remoteType,
      skills: jobSkills,
      requirements: jobSkills,
      niceToHave: [],
      descriptionText: job.descriptionText,
      experienceRequired: job.title.includes('Staff') ? '10 years' : '5 years',
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
    });
    const match = await prisma.jobMatch.create({
      data: {
        candidateProfileId: profile.id,
        jobId: job.id,
        matchScore: breakdown.matchScore,
        recommendation: recommendationFromScore(breakdown.matchScore),
        skillMatch: breakdown.skillMatch,
        experienceMatch: breakdown.experienceMatch,
        roleMatch: breakdown.roleMatch,
        locationMatch: breakdown.locationMatch,
        seniorityMatch: breakdown.seniorityMatch,
        educationMatch: breakdown.educationMatch,
        salaryMatch: breakdown.salaryMatch,
        matchedSkills: breakdown.matchedSkills,
        missingRequiredSkills: breakdown.missingRequiredSkills,
        matchedRequirements: breakdown.matchedRequirements,
        missingRequirements: breakdown.missingRequirements,
        concerns: breakdown.concerns,
        reasoning: breakdown.reasoning,
        confidence: breakdown.confidence,
      },
    });
    matches.push({ job, match, breakdown });
  }

  const searchProfile = await prisma.searchProfile.create({
    data: {
      userId: user.id,
      candidateProfileId: profile.id,
      name: 'Frontend · GCC + Remote',
      targetTitles: ['Frontend Developer', 'React Developer', 'Next.js Developer'],
      targetLocations: ['Remote', 'Dubai', 'Riyadh', 'Doha', 'Abu Dhabi'],
      salaryMin: 80000,
      salaryMax: 150000,
      currency: 'USD',
      experienceMin: 3,
      experienceMax: 10,
      employmentTypes: ['FULL_TIME', 'CONTRACT'],
      remotePreference: 'REMOTE',
      minMatchScore: 80,
      dailyApplicationLimit: 10,
      allowAutomatedSending: false,
      discoveryIntervalHours: 12,
      enabled: true,
    },
  });

  await prisma.searchQuery.createMany({
    data: [
      { searchProfileId: searchProfile.id, query: 'React Developer remote', location: 'Remote', sourceId: remotive.id },
      { searchProfileId: searchProfile.id, query: 'Next.js Developer Dubai', location: 'Dubai' },
      { searchProfileId: searchProfile.id, query: 'Frontend Developer Riyadh', location: 'Riyadh' },
      { searchProfileId: searchProfile.id, query: 'TypeScript Developer Doha', location: 'Doha' },
    ],
  });

  const statuses: ApplicationStatus[] = [
    'REVIEW',
    'APPROVED',
    'APPLIED',
    'FOLLOW_UP',
    'RESPONSE',
    'INTERVIEW',
    'OFFER',
    'REJECTED',
    'ARCHIVED',
    'MATCHED',
  ];

  const ranked = [...matches].sort((a, b) => b.match.matchScore - a.match.matchScore);
  for (let i = 0; i < statuses.length; i += 1) {
    const item = ranked[i];
    const status = statuses[i];
    const method = item.job.applicationEmail ? 'EMAIL' : 'MANUAL';
    const application = await prisma.application.create({
      data: {
        userId: user.id,
        jobId: item.job.id,
        candidateProfileId: profile.id,
        status,
        method,
        generatedSubject: `Application for ${item.job.title} at ${companies.find((c) => c.id === item.job.companyId)?.name}`,
        generatedBody: `Hello,\n\nI'm Sam Rivera, applying for the ${item.job.title} role. This is seeded demo copy.\n\nThank you,\nSam Rivera`,
        recipientEmail: item.job.applicationEmail,
        approvedAt: ['APPROVED', 'APPLIED', 'FOLLOW_UP', 'RESPONSE', 'INTERVIEW', 'OFFER'].includes(status)
          ? new Date()
          : null,
        sentAt: ['APPLIED', 'FOLLOW_UP', 'RESPONSE', 'INTERVIEW', 'OFFER', 'REJECTED'].includes(status)
          ? new Date(Date.now() - i * 86400000)
          : null,
      },
    });
    await prisma.applicationStatusEvent.create({
      data: { applicationId: application.id, fromStatus: 'DISCOVERED', toStatus: status },
    });
    if (application.sentAt) {
      await prisma.applicationEmail.create({
        data: {
          applicationId: application.id,
          kind: 'application',
          recipient: application.recipientEmail ?? 'manual@example.com',
          subject: application.generatedSubject ?? 'Application',
          body: application.generatedBody ?? '',
          status: 'SENT',
          sentAt: application.sentAt,
        },
      });
    }
  }

  await prisma.notification.createMany({
    data: [
      {
        userId: user.id,
        type: 'EXCELLENT_MATCH',
        title: 'Excellent match found',
        body: 'A seeded demo role scored 90+ Job Match Score.',
        href: '/jobs',
      },
      {
        userId: user.id,
        type: 'REVIEW',
        title: 'Application needs review',
        body: 'A generated application is waiting for approval. Sending is never automatic by default.',
        href: '/applications',
      },
    ],
  });

  await prisma.activityLog.createMany({
    data: [
      { userId: user.id, type: 'SEED', message: 'Loaded labeled demo data. Not real companies or openings.' },
      { userId: user.id, type: 'PROFILE', message: 'Demo candidate profile created from seed.' },
    ],
  });

  console.log(`Seed complete. User ${user.email}. Jobs ${createdJobs.length}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
