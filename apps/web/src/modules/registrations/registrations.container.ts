import { clock, getPrisma } from '@/modules/shared';
import { createRegistrationsRepository } from './registrations.repository';
import { createRegistrationsService, type RegistrationsService } from './registrations.service';

let service: RegistrationsService | undefined;

export function getRegistrationsService(): RegistrationsService {
  service ??= createRegistrationsService({
    repository: createRegistrationsRepository(getPrisma()),
    clock,
  });
  return service;
}
