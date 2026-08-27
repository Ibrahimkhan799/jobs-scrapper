import cron from 'node-cron';
import { prisma } from '@job-hunter/database';
import { logger } from './logger.js';
import { runDiscovery } from './services/ingestion.js';
import { notify } from './services/context.js';
import { processAutomatedSends } from './services/applications.js';

let started = false;

export function startScheduler(): void {
  if (started) return;
  started = true;

  cron.schedule('15 * * * *', async () => {
    try {
      const profiles = await prisma.searchProfile.findMany({
        where: { enabled: true },
        include: { user: { include: { settings: true } } },
      });
      for (const profile of profiles) {
        const hours = profile.discoveryIntervalHours || profile.user.settings?.discoveryIntervalHours || 12;
        const last = profile.lastRunAt?.getTime() ?? 0;
        if (Date.now() - last < hours * 60 * 60 * 1000) continue;
        logger.info({ searchProfileId: profile.id }, 'Scheduled discovery starting');
        await runDiscovery(profile.userId, profile.id);
        if (profile.user.settings?.allowAutomatedSending) {
          const result = await processAutomatedSends(profile.userId);
          logger.info({ userId: profile.userId, ...result }, 'Automated send pass');
        }
      }

      const due = await prisma.application.findMany({
        where: {
          sentAt: { not: null },
          followUpAt: null,
          status: 'APPLIED',
        },
        include: { user: { include: { settings: true } }, job: true },
      });
      for (const application of due) {
        const days = application.user.settings?.followUpAfterDays ?? 7;
        if (!application.sentAt) continue;
        if (Date.now() - application.sentAt.getTime() < days * 86400000) continue;
        await notify(application.userId, {
          type: 'FOLLOW_UP_DUE',
          title: 'Follow-up is due',
          body: `Consider following up on ${application.job.title}. Nothing is sent automatically.`,
          href: `/applications/${application.id}`,
        });
      }
    } catch (error) {
      logger.error({ err: error }, 'Scheduler tick failed');
    }
  });

  logger.info('Discovery scheduler started (hourly check, default every 12 hours)');
}
