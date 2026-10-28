import AxeBuilder from '@axe-core/playwright';
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
} from './helpers';

// T-024: description of a slot (F-21, RG-07), at 360 px. The club is in Europe/Paris (RG-16).

test.describe.configure({ mode: 'serial' });
test.afterAll(() => database.$disconnect());
test.beforeEach(async ({ request, baseURL }, testInfo) => {
  await resetInstance();
  await installInstance(request, baseURL!, addressOf(testInfo));
  await createMember();
});

async function signIn(page: Page, credentials = installation.admin) {
  await page.goto('/connexion');
  await page.getByLabel('E-mail').fill(credentials.email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/events$/);
}

/** axe without serious or critical violation, and no horizontal scroll at 360 px. */
async function checkScreen(page: Page) {
  const violations = (await new AxeBuilder({ page }).analyze()).violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(
    false,
  );
}

const dialog = (page: Page, name = 'Ajouter un créneau') => page.getByRole('dialog', { name });

async function insertEvent(options: {
  startsAt?: string;
  endsAt?: string;
  slot: { startsAt: string; endsAt: string; description?: string | null; registered?: number };
}) {
  const users = [];
  for (let i = 0; i < (options.slot.registered ?? 0); i++) {
    users.push(
      await database.user.create({
        data: {
          firstName: 'Bénévole',
          lastName: `N${i}`,
          email: `benevole${i}@exemple.fr`,
          passwordHash: 'not-a-real-hash',
        },
      }),
    );
  }
  return database.event.create({
    data: {
      title: 'Compétition du 14 mars',
      startsAt: new Date(options.startsAt ?? '2030-03-14T07:00:00Z'),
      endsAt: new Date(options.endsAt ?? '2030-03-14T17:00:00Z'),
      slots: {
        create: {
          startsAt: new Date(options.slot.startsAt),
          endsAt: new Date(options.slot.endsAt),
          description: options.slot.description ?? null,
          registrations: { create: users.map((user) => ({ userId: user.id })) },
        },
      },
    },
  });
}

const morning = { startsAt: '2030-03-14T07:00:00Z', endsAt: '2030-03-14T09:00:00Z' }; // 08:00 – 10:00

async function openNewEventWithSlot(page: Page) {
  await page.goto('/events/new');
  await page.getByLabel('Titre').fill('Course de ski du 15 janvier');
  await page.getByLabel('Date de début').fill('2030-01-15');
  await page.getByLabel('Heure de début').fill('08:00');
  await page.getByLabel('Date de fin').fill('2030-01-15');
  await page.getByLabel('Heure de fin').fill('17:00');
  await page.getByRole('button', { name: '+ Ajouter un créneau' }).click();
  const window = dialog(page);
  await window.getByLabel('Début').fill('08:00');
  await window.getByLabel('Fin').fill('10:00');
  return window;
}

test.describe('slot description (F-21)', () => {
  test('[F-21 S1] a slot without description is created and shows no description', async ({
    page,
  }) => {
    await signIn(page);
    const window = await openNewEventWithSlot(page);
    await window.getByRole('button', { name: 'Valider le créneau' }).click();
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page).toHaveURL(/\/events\/\d+$/);
    await expect(page.getByRole('heading', { name: '08:00 – 10:00' })).toBeVisible();
    expect((await database.slot.findFirstOrThrow()).description).toBeNull();
    await checkScreen(page);
  });

  test('[F-21 S2] a description typed with the event is read by the administrator and by a volunteer', async ({
    page,
    browser,
  }) => {
    await signIn(page);
    const window = await openNewEventWithSlot(page);
    await window.getByLabel(/Description/).fill('Prévoir de quoi se changer');
    await checkScreen(page);
    await window.getByRole('button', { name: 'Valider le créneau' }).click();
    // the slot being added already shows it
    await expect(page.getByText('Prévoir de quoi se changer')).toBeVisible();
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page).toHaveURL(/\/events\/\d+$/);
    await expect(page.getByText('Prévoir de quoi se changer')).toBeVisible();
    await checkScreen(page);
    expect((await database.slot.findFirstOrThrow()).description).toBe('Prévoir de quoi se changer');

    const context = await browser.newContext();
    const volunteer = await context.newPage();
    await signIn(volunteer, member);
    await volunteer.getByText('Course de ski du 15 janvier').click();
    await expect(volunteer.getByText('Prévoir de quoi se changer')).toBeVisible();
    await expect(volunteer.getByRole('button', { name: /Je m'inscris/ })).toBeVisible();
    await checkScreen(volunteer);
    await context.close();
  });

  test('[F-21 S3] over 500 characters is refused under the field and what was typed stays', async ({
    page,
  }) => {
    const event = await insertEvent({ slot: morning });
    await signIn(page);
    await page.goto(`/events/${event.id}`);
    await page.getByRole('button', { name: '+ Ajouter un créneau' }).click();
    const window = dialog(page);
    await window.getByLabel('Début').fill('11:00');
    await window.getByLabel('Fin').fill('12:00');
    await window.getByLabel(/Description/).fill('a'.repeat(501));
    await window.getByRole('button', { name: 'Valider le créneau' }).click();
    await expect(
      window.getByText('La description ne peut pas dépasser 500 caractères.'),
    ).toBeVisible();
    await expect(window.getByLabel(/Description/)).toHaveValue('a'.repeat(501));
    await expect(window.getByLabel('Début')).toHaveValue('11:00');
    await checkScreen(page);
    expect(await database.slot.count()).toBe(1);

    // 500 pass
    await window.getByLabel(/Description/).fill('a'.repeat(500));
    await window.getByRole('button', { name: 'Valider le créneau' }).click();
    await expect(dialog(page)).toHaveCount(0);
    expect(await database.slot.count()).toBe(2);
  });

  test('[F-21 S4] a tag typed in the description shows as text, and a long text never scrolls sideways', async ({
    page,
  }) => {
    const long = `<b>Gants</b> fournis ${'x'.repeat(300)}`;
    const event = await insertEvent({ slot: { ...morning, description: long } });
    await signIn(page);
    await page.goto(`/events/${event.id}`);
    await expect(page.getByText('<b>Gants</b> fournis', { exact: false })).toBeVisible();
    await expect(page.locator('b')).toHaveCount(0);
    await checkScreen(page);
  });

  test('[F-21 S5] RG-15: the description of a started slot is edited, the registrations stay', async ({
    page,
  }) => {
    // the slot began (and ended) long ago, but the event it belongs to is not over (RG-15)
    const event = await insertEvent({
      startsAt: '2020-01-01T08:00:00Z',
      endsAt: '2090-01-01T08:00:00Z',
      slot: {
        startsAt: '2020-01-01T08:00:00Z',
        endsAt: '2020-01-01T10:00:00Z',
        description: 'Avant',
        registered: 3,
      },
    });
    await signIn(page);
    await page.goto(`/events/${event.id}`);
    await expect(page.getByText('Avant')).toBeVisible();
    await page.getByRole('button', { name: /^Modifier le créneau/ }).click();
    const window = dialog(page, 'Modifier le créneau');
    await expect(window.getByLabel(/Description/)).toHaveValue('Avant');
    await window.getByLabel(/Description/).fill('Après : gants fournis');
    await window.getByRole('button', { name: 'Valider le créneau' }).click();
    await expect(dialog(page, 'Modifier le créneau')).toHaveCount(0);
    await expect(page.getByText('Après : gants fournis')).toBeVisible();
    await expect(page.getByText('3 inscrits')).toBeVisible();
    const slot = await database.slot.findFirstOrThrow({ include: { registrations: true } });
    expect(slot.description).toBe('Après : gants fournis');
    expect(slot.registrations).toHaveLength(3);
  });

  test('[F-21 S6] RG-15: a past event shows the description without any action', async ({
    page,
  }) => {
    const event = await insertEvent({
      startsAt: '2020-01-01T08:00:00Z',
      endsAt: '2020-01-01T16:00:00Z',
      slot: {
        startsAt: '2020-01-01T08:00:00Z',
        endsAt: '2020-01-01T12:00:00Z',
        description: 'Montage des barrières, gants fournis',
      },
    });
    await signIn(page);
    await page.goto(`/events/${event.id}`);
    await expect(page.getByText('Montage des barrières, gants fournis')).toBeVisible();
    await expect(page.getByRole('button', { name: /Modifier le créneau/ })).toHaveCount(0);
    await checkScreen(page);
  });
});
