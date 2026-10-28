import type { Clock } from '@/modules/shared';
import type { MaintenanceRepository } from './maintenance.repository';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// security.md, section 4: attempts without a block for 24 h, reset tokens expired or used for 30 days.
export const LOGIN_ATTEMPT_RETENTION_MS = 24 * HOUR_MS;
export const RESET_TOKEN_RETENTION_MS = 30 * DAY_MS;

export interface PurgeResult {
  loginAttempts: number;
  resetTokens: number;
}

export function createMaintenanceService({
  repository,
  clock,
}: {
  repository: MaintenanceRepository;
  clock: Clock;
}) {
  return {
    /** Deletes the rows that security.md says are no longer kept; safe to run as often as wanted. */
    async purge(): Promise<PurgeResult> {
      const now = clock.now().getTime();
      const loginAttempts = await repository.deleteIdleLoginAttempts(
        new Date(now - LOGIN_ATTEMPT_RETENTION_MS),
      );
      const resetTokens = await repository.deleteStaleResetTokens(
        new Date(now - RESET_TOKEN_RETENTION_MS),
      );
      return { loginAttempts, resetTokens };
    },
  };
}

export type MaintenanceService = ReturnType<typeof createMaintenanceService>;
