import { toUserView } from '@/modules/auth';
import { clock, getPrisma } from '@/modules/shared';
import { createMembersRepository } from './members.repository';
import { createMembersService, type MembersService } from './members.service';

let service: MembersService | undefined;

export function getMembersService(): MembersService {
  service ??= createMembersService({
    repository: createMembersRepository(getPrisma()),
    clock,
    toUserView,
  });
  return service;
}
