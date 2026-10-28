import { clock, getPrisma } from '@/modules/shared';
import { createSlotsRepository } from './slots.repository';
import { createSlotsService, type SlotsService } from './slots.service';

let service: SlotsService | undefined;

export function getSlotsService(): SlotsService {
  service ??= createSlotsService({ repository: createSlotsRepository(getPrisma()), clock });
  return service;
}
