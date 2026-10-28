import { describe, expect, it, vi } from 'vitest';
import { fixedClock } from '@/modules/shared';
import { createMaintenanceService } from './maintenance.service';

const NOW = '2027-03-14T08:00:00Z';

describe('maintenance purge cutoffs (security.md, section 4)', () => {
  it('keeps login attempts for 24 h and reset tokens for 30 days', async () => {
    const repository = {
      deleteIdleLoginAttempts: vi.fn().mockResolvedValue(3),
      deleteStaleResetTokens: vi.fn().mockResolvedValue(2),
    };
    const service = createMaintenanceService({ repository, clock: fixedClock(NOW) });

    const result = await service.purge();

    expect(result).toEqual({ loginAttempts: 3, resetTokens: 2 });
    expect(repository.deleteIdleLoginAttempts).toHaveBeenCalledWith(
      new Date('2027-03-13T08:00:00Z'),
    );
    expect(repository.deleteStaleResetTokens).toHaveBeenCalledWith(
      new Date('2027-02-12T08:00:00Z'),
    );
  });
});
