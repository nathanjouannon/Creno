import { getAuthService, hashPassword, toUserView } from '@/modules/auth';
import { getPrisma } from '@/modules/shared';
import { createClubRepository } from './club.repository';
import { createClubService, type ClubService } from './club.service';

let service: ClubService | undefined;

export function getClubService(): ClubService {
  service ??= createClubService({
    repository: createClubRepository(getPrisma()),
    hashPassword,
    openSession: (user) => getAuthService().openSession(user),
    toUserView,
  });
  return service;
}
