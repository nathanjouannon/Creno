import { toUserView } from '@/modules/auth';
import { getPrisma } from '@/modules/shared';
import { createMembersRepository } from './members.repository';
import { createMembersService, type MembersService } from './members.service';

let service: MembersService | undefined;

export function getMembersService(): MembersService {
  service ??= createMembersService({
    repository: createMembersRepository(getPrisma()),
    toUserView,
  });
  return service;
}
