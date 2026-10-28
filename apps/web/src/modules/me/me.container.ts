import { toUserView, verifyPassword } from '@/modules/auth';
import { getPrisma } from '@/modules/shared';
import { createMeRepository } from './me.repository';
import { createMeService, type MeService } from './me.service';

let service: MeService | undefined;

export function getMeService(): MeService {
  service ??= createMeService({
    repository: createMeRepository(getPrisma()),
    verifyPassword,
    toUserView,
  });
  return service;
}
