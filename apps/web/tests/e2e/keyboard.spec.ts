import type { Locator, Page } from '@playwright/test';
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

// T-021: the critical paths (sign in, register to a slot, create an event) with the keyboard only (testing.md,
// section 6). Every control is reached with Tab and activated with Enter or Space; the focus must also be visible.

test.describe.configure({ mode: 'serial' });
test.afterAll(() => database.$disconnect());
test.beforeEach(async ({ request, baseURL }, testInfo) => {
  await resetInstance();
  await installInstance(request, baseURL!, addressOf(testInfo));
  await createMember();
});

const MAX_TABS = 60;

/** Presses Tab until the control has the focus, or fails: a control that cannot be reached is a defect. */
async function tabTo(page: Page, control: Locator) {
  for (let presses = 0; presses <= MAX_TABS; presses++) {
    if (await control.evaluate((el) => el === document.activeElement).catch(() => false)) {
      // WCAG 2.4.7: the focused control shows an outline
      const outline = await control.evaluate((el) => getComputedStyle(el).outlineStyle);
      expect(outline, 'visible focus').not.toBe('none');
      return;
    }
    await page.keyboard.press('Tab');
  }
  throw new Error(`not reachable with Tab within ${MAX_TABS} presses: ${control}`);
}

async function typeInto(page: Page, field: Locator, value: string) {
  await tabTo(page, field);
  await field.fill(value);
}

async function signInByKeyboard(page: Page, credentials: { email: string; password: string }) {
  await page.goto('/connexion');
  await typeInto(page, page.getByLabel('E-mail'), credentials.email);
  await typeInto(page, page.getByLabel('Mot de passe', { exact: true }), credentials.password);
  await tabTo(page, page.getByRole('button', { name: 'Se connecter' }));
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/events$/);
}

test('[T-021] sign in and register to a slot with the keyboard only', async ({ page }) => {
  const hour = 3_600_000;
  const event = await database.event.create({
    data: {
      title: 'Compétition du 14 mars',
      startsAt: new Date(Date.now() + 24 * hour),
      endsAt: new Date(Date.now() + 36 * hour),
    },
  });
  await database.slot.create({
    data: {
      eventId: event.id,
      startsAt: new Date(Date.now() + 25 * hour),
      endsAt: new Date(Date.now() + 28 * hour),
      capacity: 3,
    },
  });

  await signInByKeyboard(page, member);

  await tabTo(page, page.getByRole('link', { name: /Compétition du 14 mars/ }));
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/events/${event.id}$`));

  await tabTo(page, page.getByRole('button', { name: /Je m'inscris au créneau/ }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /Me désinscrire/ })).toBeVisible();
  expect(await database.registration.count()).toBe(1);
});

test('[T-021] an administrator creates an event with the keyboard only', async ({ page }) => {
  await signInByKeyboard(page, installation.admin);

  await tabTo(page, page.getByRole('button', { name: '+ Créer un événement' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Créer un événement' })).toBeVisible();

  await typeInto(page, page.getByLabel('Titre'), 'Course de ski du 15 janvier');
  await typeInto(page, page.getByLabel('Description'), 'Ouverture de piste');
  await typeInto(page, page.getByLabel('Lieu'), 'Station des Arcs');
  await typeInto(page, page.getByLabel('Date de début'), '2030-01-15');
  await typeInto(page, page.getByLabel('Heure de début'), '08:00');
  await typeInto(page, page.getByLabel('Date de fin'), '2030-01-15');
  await typeInto(page, page.getByLabel('Heure de fin'), '17:00');
  await tabTo(page, page.getByRole('button', { name: 'Enregistrer' }));
  await page.keyboard.press('Enter');

  await expect(page.getByRole('heading', { name: 'Course de ski du 15 janvier' })).toBeVisible();
  expect(await database.event.count({ where: { title: 'Course de ski du 15 janvier' } })).toBe(1);
});

test('[T-021] the account menu opens and closes with the keyboard only', async ({ page }) => {
  await signInByKeyboard(page, member);

  const trigger = page.getByRole('button', { name: member.firstName });
  await tabTo(page, trigger);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Supprimer mon compte' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Supprimer mon compte' })).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
