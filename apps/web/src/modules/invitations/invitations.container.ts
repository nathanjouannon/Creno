import { getAuthService, hashPassword, toUserView } from '@/modules/auth';
import { clock, getConfig, getPrisma } from '@/modules/shared';
import { createInvitationsRepository } from './invitations.repository';
import { createInvitationsService, type InvitationsService } from './invitations.service';

let service: InvitationsService | undefined;

export function getInvitationsService(): InvitationsService {
  service ??= createInvitationsService({
    repository: createInvitationsRepository(getPrisma()),
    clock,
    appUrl: getConfig().APP_URL,
    hashPassword,
    openSession: (user) => getAuthService().openSession(user),
    toUserView,
  });
  return service;
}
