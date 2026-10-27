import { AppError } from '@creno/validation';
import { describe, expect, it } from 'vitest';
import { createHealthService } from './health.service';

describe('health service', () => {
  it('answers ok when the database answers', async () => {
    const service = createHealthService({ repository: { ping: async () => {} } });
    expect(await service.check()).toEqual({ status: 'ok' });
  });

  it('throws SERVICE_UNAVAILABLE when the database fails, hiding the cause', async () => {
    const service = createHealthService({
      repository: {
        ping: async () => Promise.reject(new Error("Can't reach database server at db:5432")),
      },
    });
    const error = await service.check().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('SERVICE_UNAVAILABLE');
    expect((error as AppError).message).not.toContain('5432');
  });
});
