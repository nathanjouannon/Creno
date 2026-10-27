import { AppError } from '@creno/validation';
import type { HealthRepository } from './health.repository';

const DATABASE_TIMEOUT_MS = 2000;

export function createHealthService({ repository }: { repository: HealthRepository }) {
  return {
    /** 200 `{ status: 'ok' }` when the database answers; otherwise SERVICE_UNAVAILABLE (errors.md). */
    async check(): Promise<{ status: 'ok' }> {
      let timer: NodeJS.Timeout | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('database ping timed out')), DATABASE_TIMEOUT_MS);
      });
      try {
        await Promise.race([repository.ping(), timeout]);
        return { status: 'ok' };
      } catch {
        throw new AppError('SERVICE_UNAVAILABLE');
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

export type HealthService = ReturnType<typeof createHealthService>;
