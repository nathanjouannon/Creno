// Development data set. Re-runnable: it empties the tables first, so it refuses to run in production.
import { PrismaClient } from '@prisma/client';

if (process.env.NODE_ENV === 'production') throw new Error('The seed never runs in production.');

const prisma = new PrismaClient();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
// Not a real hash: the hashing algorithm is chosen with the authentication ticket.
const PLACEHOLDER_HASH = 'seed-placeholder-not-a-valid-hash';

async function main(): Promise<void> {
  const now = Date.now();
  const at = (offset: number) => new Date(now + offset);

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      'TRUNCATE club, login_attempts, users, reset_tokens, events, slots, registrations, invitations RESTART IDENTITY CASCADE',
    );
    await tx.club.create({ data: { name: 'Association Démo', timezone: 'Europe/Paris' } });
    const user = (lastName: string, firstName: string, email: string, role: 'USER' | 'ADMIN') =>
      tx.user.create({
        data: { lastName, firstName, email, role, passwordHash: PLACEHOLDER_HASH },
      });
    const admin = await user('Durand', 'Claire', 'admin@example.org', 'ADMIN');
    const alice = await user('Martin', 'Alice', 'alice@example.org', 'USER');
    const bob = await user('Petit', 'Bob', 'bob@example.org', 'USER');

    const upcoming = await tx.event.create({
      data: {
        title: 'Vide-grenier de printemps',
        description: 'Installation des stands et tenue de la buvette.',
        location: 'Place du marché',
        startsAt: at(7 * DAY),
        endsAt: at(7 * DAY + 8 * HOUR),
        slots: {
          create: [
            { startsAt: at(7 * DAY), endsAt: at(7 * DAY + 4 * HOUR), capacity: 3 },
            { startsAt: at(7 * DAY + 4 * HOUR), endsAt: at(7 * DAY + 8 * HOUR), capacity: null },
          ],
        },
        invitations: { create: { token: 'seed-invitation-upcoming' } },
      },
      include: { slots: true },
    });
    const ongoing = await tx.event.create({
      data: {
        title: 'Tournoi du club',
        location: 'Gymnase',
        startsAt: at(-2 * HOUR),
        endsAt: at(4 * HOUR),
        slots: { create: [{ startsAt: at(-2 * HOUR), endsAt: at(4 * HOUR), capacity: 1 }] },
      },
      include: { slots: true },
    });
    await tx.event.create({
      data: {
        title: 'Assemblée générale',
        startsAt: at(-10 * DAY),
        endsAt: at(-10 * DAY + 2 * HOUR),
        slots: {
          create: [{ startsAt: at(-10 * DAY), endsAt: at(-10 * DAY + 2 * HOUR), capacity: 2 }],
        },
      },
    });

    await tx.registration.createMany({
      data: [
        { slotId: upcoming.slots[0]!.id, userId: alice.id },
        { slotId: upcoming.slots[0]!.id, userId: bob.id },
        { slotId: upcoming.slots[1]!.id, userId: alice.id },
        { slotId: ongoing.slots[0]!.id, userId: admin.id },
      ],
    });
  });
}

main().finally(() => prisma.$disconnect());
