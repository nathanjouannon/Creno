// Scheduled purge (security.md, section 4): run daily by the host's cron through `docker compose run` (README.md).
import { getMaintenanceService } from '@/modules/maintenance';
import { getLogger, getPrisma } from '@/modules/shared';

const logger = getLogger();
try {
  const result = await getMaintenanceService().purge();
  logger.info('purge done', {
    purgedLoginAttempts: result.loginAttempts,
    purgedResets: result.resetTokens, // not named after the table: the logger hides any field called *token*
  });
} catch (error) {
  logger.error('purge failed', { error });
  process.exitCode = 1;
} finally {
  await getPrisma().$disconnect();
}
