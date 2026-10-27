import { createHealthRepository } from './health.repository';
import { createHealthService, type HealthService } from './health.service';
import { getPrisma } from './prisma';

let service: HealthService | undefined;

export function getHealthService(): HealthService {
  service ??= createHealthService({ repository: createHealthRepository(getPrisma()) });
  return service;
}
