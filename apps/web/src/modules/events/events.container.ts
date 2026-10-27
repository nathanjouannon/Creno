import { clock, getPrisma } from '@/modules/shared';
import { createEventsRepository } from './events.repository';
import { createEventsService, type EventsService } from './events.service';

let service: EventsService | undefined;

export function getEventsService(): EventsService {
  service ??= createEventsService({ repository: createEventsRepository(getPrisma()), clock });
  return service;
}
