import { describe, expect, it, vi } from 'vitest';
import type { SetupInput } from '@creno/validation';
import type { ClubRepository, InstalledUser } from './club.repository';
import { createClubService } from './club.service';

const input: SetupInput = {
  club: { name: 'Ski Club des Arcs', timezone: 'Europe/Paris' },
  admin: {
    firstName: 'Alex',
    lastName: 'Martin',
    email: 'mail.ex@exemple.fr',
    password: '0123456789',
  },
};
const created: InstalledUser = {
  id: 1,
  firstName: 'Alex',
  lastName: 'Martin',
  email: 'mail.ex@exemple.fr',
  role: 'ADMIN',
  tokenVersion: 0,
  createdAt: new Date('2027-01-14T09:00:00Z'),
};

function build(overrides: Partial<ClubRepository> = {}) {
  const repository = {
    countUsers: vi.fn().mockResolvedValue(0),
    findClub: vi.fn().mockResolvedValue(null),
    createClubAndAdmin: vi.fn().mockResolvedValue(created),
    ...overrides,
  } as unknown as ClubRepository;
  const hashPassword = vi.fn().mockResolvedValue('hashed');
  const service = createClubService({
    repository,
    hashPassword,
    openSession: async (user) => `session-for-${user.id}`,
    toUserView: (user) => ({ id: user.id, role: user.role }),
  });
  return { service, repository, hashPassword };
}

describe('club service: installation (F-19, RG-17)', () => {
  it('[F-19 S1] RG-04: creates the club and an ADMIN with a hashed password, and signs them in', async () => {
    const { service, repository, hashPassword } = build();
    const result = await service.install(input);

    expect(hashPassword).toHaveBeenCalledWith('0123456789');
    expect(repository.createClubAndAdmin).toHaveBeenCalledWith({
      club: input.club,
      admin: {
        firstName: 'Alex',
        lastName: 'Martin',
        email: 'mail.ex@exemple.fr',
        passwordHash: 'hashed',
      },
    });
    expect(result).toEqual({ user: { id: 1, role: 'ADMIN' }, sessionCookie: 'session-for-1' });
  });

  it('[F-19 S3] RG-17: refuses with NOT_FOUND once a user exists, without hashing or writing', async () => {
    const { service, repository, hashPassword } = build({
      countUsers: vi.fn().mockResolvedValue(1),
    });
    await expect(service.install(input)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(hashPassword).not.toHaveBeenCalled();
    expect(repository.createClubAndAdmin).not.toHaveBeenCalled();
  });

  it('[F-19 S5] RG-17: answers NOT_FOUND when another installation won the race (repository returns null)', async () => {
    const { service } = build({ createClubAndAdmin: vi.fn().mockResolvedValue(null) });
    await expect(service.install(input)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('RG-17: the instance is installed from the first user on', async () => {
    expect(await build().service.isInstalled()).toBe(false);
    expect(await build({ countUsers: vi.fn().mockResolvedValue(3) }).service.isInstalled()).toBe(
      true,
    );
  });

  it('RG-16: returns the club, NOT_FOUND when there is none', async () => {
    const club = { name: 'Ski Club des Arcs', timezone: 'Europe/Paris' };
    expect(await build({ findClub: vi.fn().mockResolvedValue(club) }).service.getClub()).toEqual(
      club,
    );
    await expect(build().service.getClub()).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
