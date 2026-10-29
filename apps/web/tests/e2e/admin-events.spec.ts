import type { Page } from '@playwright/test';
import {
  addressOf,
  createMember,
  database,
  expect,
  installInstance,
  installation,
  member,
  resetInstance,
  test,
  analyze,
} from './helpers';

// T-013: administrator screens of events and slots (F-04, F-05), at 360 px. The club is in Europe/Paris (RG-16):
// 08:00 typed is 07:00 UTC in March.

test.describe.configure({ mode: 'serial' });
test.afterAll(() => database.$disconnect());
test.beforeEach(async ({ request, baseURL }, testInfo) => {
  await resetInstance();
  await installInstance(request, baseURL!, addressOf(testInfo));
  await createMember();
});

const at = (iso: string) => new Date(iso);
let volunteerCount = 0;

/** An event written in the database, with slots and as many registered volunteers as asked. */
async function insertEvent(options: {
  title?: string;
  location?: string;
  startsAt?: string;
  endsAt?: string;
  slots?: { startsAt: string; endsAt: string; capacity: number | null; registered?: number }[];
}) {
  const event = await database.event.create({
    data: {
      title: options.title ?? 'Compétition du 14 mars',
      location: options.location ?? 'Stade de neige',
      startsAt: at(options.startsAt ?? '2030-03-14T07:00:00Z'),
      endsAt: at(options.endsAt ?? '2030-03-14T17:00:00Z'),
    },
  });
  for (const slot of options.slots ?? []) {
    const users = [];
    for (let i = 0; i < (slot.registered ?? 0); i++) {
      volunteerCount += 1;
      users.push(
        await database.user.create({
          data: {
            firstName: 'Bénévole',
            lastName: `N${volunteerCount}`,
            email: `benevole${volunteerCount}@exemple.fr`,
            passwordHash: 'not-a-real-hash',
          },
        }),
      );
    }
    await database.slot.create({
      data: {
        eventId: event.id,
        startsAt: at(slot.startsAt),
        endsAt: at(slot.endsAt),
        capacity: slot.capacity,
        registrations: { create: users.map((user) => ({ userId: user.id })) },
      },
    });
  }
  return event;
}

const morning = { startsAt: '2030-03-14T07:00:00Z', endsAt: '2030-03-14T09:00:00Z' }; // 08:00 – 10:00

async function signIn(page: Page, credentials = installation.admin) {
  await page.goto('/connexion');
  await page.getByLabel('E-mail').fill(credentials.email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/events$/);
}

/** axe without serious or critical violation, and no horizontal scroll at 360 px. */
async function checkScreen(page: Page) {
  const violations = (await analyze(page)).violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(
    false,
  );
}

async function fillEvent(page: Page, values: { title?: string; end?: string } = {}) {
  await page.getByLabel('Titre').fill(values.title ?? 'Course de ski du 15 janvier');
  await page.getByLabel('Description').fill('Ouverture de piste');
  await page.getByLabel('Lieu').fill('Station des Arcs');
  await page.getByLabel('Date de début').fill('2030-01-15');
  await page.getByLabel('Heure de début').fill('08:00');
  await page.getByLabel('Date de fin').fill('2030-01-15');
  await page.getByLabel('Heure de fin').fill(values.end ?? '17:00');
}

const slotDialog = (page: Page, name = 'Ajouter un créneau') => page.getByRole('dialog', { name });

test.describe('events (F-04)', () => {
  test('[F-04 S1] RG-16: an event created with a slot opens on its page and is listed for every user', async ({
    page,
    browser,
  }) => {
    await signIn(page);
    await checkScreen(page);
    await page.getByRole('button', { name: '+ Créer un événement' }).click();
    await expect(page.getByRole('heading', { name: 'Créer un événement' })).toBeVisible();
    await fillEvent(page);
    await checkScreen(page);

    await page.getByRole('button', { name: '+ Ajouter un créneau' }).click();
    const dialog = slotDialog(page);
    await expect(dialog.getByLabel('Date')).toHaveValue('2030-01-15');
    await dialog.getByLabel('Début').fill('08:00');
    await dialog.getByLabel('Fin').fill('10:00');
    await dialog.getByLabel(/Limite de places/).fill('4');
    await checkScreen(page);
    await dialog.getByRole('button', { name: 'Valider le créneau' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '15 janvier, 08:00 – 10:00' })).toBeVisible();

    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page).toHaveURL(/\/events\/\d+$/);
    await expect(page.getByRole('heading', { name: 'Course de ski du 15 janvier' })).toBeVisible();
    // RG-16: shown at 08:00, the time typed
    await expect(page.getByText('Station des Arcs · 15 janvier 08:00 → 17:00')).toBeVisible();
    await expect(page.getByRole('heading', { name: '08:00 – 10:00' })).toBeVisible();
    await expect(page.getByLabel('0 inscrit sur 4 places')).toBeVisible();
    await checkScreen(page);

    const stored = await database.event.findFirstOrThrow({ include: { slots: true } });
    expect(stored.startsAt.toISOString()).toBe('2030-01-15T07:00:00.000Z');
    expect(stored.slots).toHaveLength(1);

    // Visible to a user, in a device set to another zone
    const context = await browser.newContext({ timezoneId: 'America/New_York' });
    const userPage = await context.newPage();
    await signIn(userPage, member);
    await expect(userPage.getByText('Course de ski du 15 janvier')).toBeVisible();
    await expect(userPage.getByText('Station des Arcs · 15 janvier, 08:00')).toBeVisible();
    await context.close();
  });

  test('[F-04 S2] without a title nothing is created, « Le titre est obligatoire. » shows and values stay', async ({
    page,
  }) => {
    await signIn(page);
    await page.goto('/events/new');
    await fillEvent(page, { title: '' });
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText('Le titre est obligatoire.')).toBeVisible();
    await expect(page.getByLabel('Titre')).toBeFocused();
    await expect(page.getByLabel('Lieu')).toHaveValue('Station des Arcs');
    await checkScreen(page);
    expect(await database.event.count()).toBe(0);
  });

  test('[F-04 S3] RG-06: an event without slot is created, and its page offers to add one', async ({
    page,
  }) => {
    await signIn(page);
    await page.goto('/events/new');
    await fillEvent(page);
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page).toHaveURL(/\/events\/\d+$/);
    await expect(page.getByText('Aucun créneau pour le moment.')).toBeVisible();
    await expect(page.getByRole('button', { name: '+ Ajouter un créneau' })).toBeVisible();
  });

  test('[F-04 S3 bis] RG-06: an end before the start is refused under the end, nothing is created', async ({
    page,
  }) => {
    await signIn(page);
    await page.goto('/events/new');
    await fillEvent(page, { end: '07:00' });
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText('La fin doit être après le début.')).toBeVisible();
    await expect(page.getByLabel('Titre')).toHaveValue('Course de ski du 15 janvier');
    expect(await database.event.count()).toBe(0);
  });

  test('[F-04 S4] a new place is shown to everybody and the registrations are kept', async ({
    page,
  }) => {
    const event = await insertEvent({ slots: [{ ...morning, capacity: 4, registered: 3 }] });
    await signIn(page);
    await page.goto(`/events/${event.id}`);
    await page.getByRole('button', { name: "Modifier l'événement" }).click();
    await expect(page.getByRole('heading', { name: "Modifier l'événement" })).toBeVisible();
    await expect(page.getByLabel('Heure de début')).toHaveValue('08:00');
    await checkScreen(page);
    await page.getByLabel('Lieu').fill('Salle des fêtes');
    await page.getByRole('button', { name: 'Enregistrer' }).click();

    await expect(page).toHaveURL(new RegExp(`/events/${event.id}$`));
    await expect(page.getByText('Salle des fêtes · 14 mars 08:00 → 18:00')).toBeVisible();
    await expect(page.getByLabel('3 inscrits sur 4 places')).toBeVisible();
    expect(await database.registration.count()).toBe(3);
  });

  test('[F-04 S5] RG-10: deleting an event with 6 registrations asks first; cancelling deletes nothing', async ({
    page,
  }) => {
    const event = await insertEvent({
      slots: [
        { ...morning, capacity: 4, registered: 4 },
        {
          startsAt: '2030-03-14T09:00:00Z',
          endsAt: '2030-03-14T11:00:00Z',
          capacity: null,
          registered: 2,
        },
      ],
    });
    await signIn(page);
    await page.goto(`/events/${event.id}`);
    await checkScreen(page);
    await page.getByRole('button', { name: "Supprimer l'événement" }).click();

    const dialog = page.getByRole('dialog', { name: "Supprimer l'événement ?" });
    await expect(dialog).toContainText('6 inscriptions seront supprimées.');
    await checkScreen(page);
    await dialog.getByRole('button', { name: 'Annuler' }).click();
    await expect(dialog).toHaveCount(0);
    expect(await database.event.count()).toBe(1);

    await page.getByRole('button', { name: "Supprimer l'événement" }).click();
    await dialog.getByRole('button', { name: 'Supprimer' }).click();
    await expect(page).toHaveURL(/\/events$/);
    await expect(page.getByText('Aucun événement à venir pour le moment.')).toBeVisible();
    expect(await database.event.count()).toBe(0);
    expect(await database.registration.count()).toBe(0);
  });

  test('[F-04 S6] RG-10: an event without registration is deleted at once, without confirmation', async ({
    page,
  }) => {
    const event = await insertEvent({ slots: [{ ...morning, capacity: 4 }] });
    await signIn(page);
    await page.goto(`/events/${event.id}`);
    await page.getByRole('button', { name: "Supprimer l'événement" }).click();
    await expect(page).toHaveURL(/\/events$/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await database.event.count()).toBe(0);
  });

  test('[F-04 S7] RG-15: a past event is read only, listed under « Passés »', async ({ page }) => {
    const event = await insertEvent({
      title: 'Stage de décembre',
      location: 'Station',
      startsAt: '2020-12-12T08:00:00Z',
      endsAt: '2020-12-12T16:00:00Z',
      slots: [
        {
          startsAt: '2020-12-12T08:00:00Z',
          endsAt: '2020-12-12T10:00:00Z',
          capacity: 4,
          registered: 2,
        },
      ],
    });
    await signIn(page);
    await page.getByRole('link', { name: 'Passés' }).click();
    await expect(page.getByRole('heading', { name: 'Événements passés' })).toBeVisible();
    await expect(page.getByText('Station · 12 décembre, terminé')).toBeVisible();
    await checkScreen(page);

    await page.getByRole('link', { name: /Stage de décembre/ }).click();
    await expect(page).toHaveURL(new RegExp(`/events/${event.id}$`));
    await expect(page.getByRole('heading', { name: 'Stage de décembre' })).toBeVisible();
    await expect(page.getByLabel('2 inscrits sur 4 places')).toBeVisible();
    await expect(
      page.getByText("Cet événement est terminé, il n'est plus modifiable."),
    ).toBeVisible();
    for (const name of [/Modifier/, /Supprimer/, /Ajouter un créneau/]) {
      await expect(page.getByRole('button', { name })).toHaveCount(0);
    }
    await checkScreen(page);

    // The modification page, opened by its address, refuses too
    await page.goto(`/events/${event.id}/edit`);
    await expect(
      page.getByText("Cet événement est terminé, il n'est plus modifiable."),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enregistrer' })).toHaveCount(0);
  });
});

test.describe('slots (F-05)', () => {
  test('[F-05 S1] [F-05 S3 ter] RG-07: a slot outside the event is announced, then created unlimited', async ({
    page,
  }) => {
    const event = await insertEvent({});
    await signIn(page);
    await page.goto(`/events/${event.id}`);
    await page.getByRole('button', { name: '+ Ajouter un créneau' }).click();
    const dialog = slotDialog(page);
    await dialog.getByLabel('Début').fill('07:00');
    await dialog.getByLabel('Fin').fill('08:00');
    await expect(dialog.getByText("Ce créneau est hors des dates de l'événement.")).toBeVisible();
    await checkScreen(page);
    await dialog.getByRole('button', { name: 'Valider le créneau' }).click();

    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '07:00 – 08:00' })).toBeVisible();
    await expect(page.getByLabel('0 inscrit, sans limite')).toBeVisible();
    expect((await database.slot.findFirstOrThrow()).capacity).toBeNull();
  });

  test('[F-05 S3] [F-05 S3 bis] RG-07: incoherent hours and a limit of 0 are refused in the window', async ({
    page,
  }) => {
    const event = await insertEvent({});
    await signIn(page);
    await page.goto(`/events/${event.id}`);
    await page.getByRole('button', { name: '+ Ajouter un créneau' }).click();
    const dialog = slotDialog(page);
    await dialog.getByLabel('Début').fill('12:00');
    await dialog.getByLabel('Fin').fill('09:00');
    await dialog.getByLabel(/Limite de places/).fill('0');
    await dialog.getByRole('button', { name: 'Valider le créneau' }).click();
    await expect(dialog.getByText('La fin doit être après le début.')).toBeVisible();
    await expect(
      dialog.getByText("La limite doit être d'au moins 1 place (ou vide pour illimité)."),
    ).toBeVisible();
    await checkScreen(page);
    expect(await database.slot.count()).toBe(0);
  });

  test('[F-05 S4] RG-07: a limit under the registrations is refused with their number, unchanged', async ({
    page,
  }) => {
    const event = await insertEvent({ slots: [{ ...morning, capacity: 8, registered: 5 }] });
    await signIn(page);
    await page.goto(`/events/${event.id}`);
    await page.getByRole('button', { name: 'Modifier le créneau 08:00 – 10:00' }).click();
    const dialog = slotDialog(page, 'Modifier le créneau');
    await expect(dialog.getByLabel(/Limite de places/)).toHaveValue('8');
    await dialog.getByLabel(/Limite de places/).fill('3');
    await dialog.getByRole('button', { name: 'Valider le créneau' }).click();
    await expect(
      dialog.getByText(
        '5 personnes sont déjà inscrites : retire des inscrits avant de baisser la limite.',
      ),
    ).toBeVisible();
    await expect(dialog.getByLabel(/Limite de places/)).toHaveValue('3');
    await checkScreen(page);
    expect((await database.slot.findFirstOrThrow()).capacity).toBe(8);
  });

  test('[F-05 S5] RG-07: an unlimited slot with 5 registered gets a limit of 8', async ({
    page,
  }) => {
    const event = await insertEvent({ slots: [{ ...morning, capacity: null, registered: 5 }] });
    await signIn(page);
    await page.goto(`/events/${event.id}`);
    await expect(page.getByLabel('5 inscrits, sans limite')).toBeVisible();
    await page.getByRole('button', { name: 'Modifier le créneau 08:00 – 10:00' }).click();
    const dialog = slotDialog(page, 'Modifier le créneau');
    await dialog.getByLabel(/Limite de places/).fill('8');
    await dialog.getByRole('button', { name: 'Valider le créneau' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByLabel('5 inscrits sur 8 places')).toBeVisible();
  });

  test('[F-05 S6] RG-10: a slot with 3 registered is deleted after confirmation; the other is unchanged', async ({
    page,
  }) => {
    const event = await insertEvent({
      slots: [
        { ...morning, capacity: 4, registered: 3 },
        {
          startsAt: '2030-03-14T09:00:00Z',
          endsAt: '2030-03-14T11:00:00Z',
          capacity: 4,
          registered: 1,
        },
      ],
    });
    await signIn(page);
    await page.goto(`/events/${event.id}`);
    await page.getByRole('button', { name: 'Supprimer le créneau 08:00 – 10:00' }).click();
    const dialog = page.getByRole('dialog', { name: 'Supprimer le créneau ?' });
    await expect(dialog).toContainText('3 inscriptions seront supprimées.');
    await dialog.getByRole('button', { name: 'Supprimer' }).click();
    await expect(page.getByRole('heading', { name: '08:00 – 10:00' })).toHaveCount(0);
    await expect(page.getByLabel('1 inscrit sur 4 places')).toBeVisible();
    expect(await database.registration.count()).toBe(1);
  });

  test('[F-05 S7] [F-05 S8] RG-10, RG-06: a slot without registration goes at once; the event stays', async ({
    page,
  }) => {
    const event = await insertEvent({ slots: [{ ...morning, capacity: null }] });
    await signIn(page);
    await page.goto(`/events/${event.id}`);
    await page.getByRole('button', { name: 'Supprimer le créneau 08:00 – 10:00' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('Aucun créneau pour le moment.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Compétition du 14 mars' })).toBeVisible();
    expect(await database.event.count()).toBe(1);
  });
});
