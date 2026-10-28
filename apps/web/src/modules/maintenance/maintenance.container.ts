import { clock, getPrisma } from '@/modules/shared';
import { createMaintenanceRepository } from './maintenance.repository';
import { createMaintenanceService, type MaintenanceService } from './maintenance.service';

let service: MaintenanceService | undefined;

export function getMaintenanceService(): MaintenanceService {
  service ??= createMaintenanceService({
    repository: createMaintenanceRepository(getPrisma()),
    clock,
  });
  return service;
}
