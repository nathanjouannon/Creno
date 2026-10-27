import { AppError, type SetupInput } from '@creno/validation';
import type { ClubRepository, InstalledUser } from './club.repository';

interface Dependencies {
  repository: ClubRepository;
  hashPassword: (password: string) => Promise<string>;
  /** `Set-Cookie` value that signs the new administrator in. */
  openSession: (user: { id: number; tokenVersion: number }) => Promise<string>;
  toUserView: (user: InstalledUser) => unknown;
}

export function createClubService({
  repository,
  hashPassword,
  openSession,
  toUserView,
}: Dependencies) {
  /** RG-17: the instance is installed as soon as one user exists. */
  async function isInstalled(): Promise<boolean> {
    return (await repository.countUsers()) > 0;
  }

  return {
    isInstalled,

    /**
     * F-19, RG-17, RG-04, RG-16: creates the club and the first administrator, then signs them in.
     * Once installed, the installation does not exist any more (NOT_FOUND), whoever asks first or second.
     */
    async install(input: SetupInput) {
      if (await isInstalled()) throw new AppError('NOT_FOUND');

      // Hashed before the transaction: argon2 takes tens of milliseconds and must not hold the database
      const passwordHash = await hashPassword(input.admin.password);
      const created = await repository.createClubAndAdmin({
        club: input.club,
        admin: {
          firstName: input.admin.firstName,
          lastName: input.admin.lastName,
          email: input.admin.email,
          passwordHash,
        },
      });
      // RG-17: another installation won the race
      if (!created) throw new AppError('NOT_FOUND');

      return { user: toUserView(created), sessionCookie: await openSession(created) };
    },

    async getClub() {
      const club = await repository.findClub();
      if (!club) throw new AppError('NOT_FOUND');
      return club;
    },
  };
}

export type ClubService = ReturnType<typeof createClubService>;
