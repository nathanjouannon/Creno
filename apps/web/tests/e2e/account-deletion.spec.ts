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

// T-020: deleting one's account (F-11, RG-04, RG-11), at 360 px.

test.describe.configure({ mode: 'serial' });
test.afterAll(() => database.$disconnect());
test.beforeEach(async ({ request, baseURL }, testInfo) => {
  await resetInstance();
  await installInstance(request, baseURL!, addressOf(testInfo));
  await createMember();
});

async function signIn(page: Page, credentials: { email: string; password: string }) {
  await page.goto('/connexion');
  await page.getByLabel('E-mail').fill(credentials.email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
}

const openDeletion = async (page: Page, firstName: string) => {
  await page.getByRole('button', { name: firstName }).click();
  await page.getByRole('button', { name: 'Supprimer mon compte' }).click();
};

/** An event under way: one slot already started, one that has not, the member registered to both. */
async function registerOnTwoSlots(): Promise<number> {
  const user = await database.user.findFirstOrThrow({ where: { email: member.email } });
  const hour = 3_600_000;
  const event = await database.event.create({
    data: {
      title: 'Fête du club',
      startsAt: new Date(Date.now() - 24 * hour),
      endsAt: new Date(Date.now() + 48 * hour),
    },
  });
  const started = await database.slot.create({
    data: {
      eventId: event.id,
      startsAt: new Date(Date.now() - 2 * hour),
      endsAt: new Date(Date.now() + 2 * hour),
    },
  });
  const future = await database.slot.create({
    data: {
      eventId: event.id,
      startsAt: new Date(Date.now() + 24 * hour),
      endsAt: new Date(Date.now() + 26 * hour),
    },
  });
  await database.registration.createMany({
    data: [
      { slotId: started.id, userId: user.id },
      { slotId: future.id, userId: user.id },
    ],
  });
  return event.id;
}

test.describe('account deletion (F-11)', () => {
  test('[F-11 S1] confirming signs out, erases the person and keeps the started slot as "ancien membre"', async ({
    page,
  }) => {
    const eventId = await registerOnTwoSlots();
    await signIn(page, member);
    await expect(page).toHaveURL(/\/events$/);

    await page.getByRole('button', { name: member.firstName }).click();
    await expect(page.getByRole('button', { name: 'Supprimer mon compte' })).toBeVisible(); // E1
    await page.getByRole('button', { name: 'Supprimer mon compte' }).click();
    const dialog = page.getByRole('dialog', { name: 'Supprimer mon compte ?' }); // E2
    await expect(dialog).toBeVisible();
    const violations = (await new AxeBuilder({ page }).analyze()).violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(violations).toEqual([]);
    await dialog.getByRole('button', { name: 'Supprimer' }).click();

    await expect(page).toHaveURL(/\/connexion$/);
    expect(await database.user.count({ where: { email: member.email } })).toBe(0);
    expect(await database.registration.count()).toBe(1);
    expect(await database.registration.count({ where: { userId: null } })).toBe(1);

    await signIn(page, installation.admin);
    await expect(page).toHaveURL(/\/events$/);
    await page.goto(`/events/${eventId}`);
    await expect(page.getByText('ancien membre')).toBeVisible();
  });

  test('[F-11 S2] "Annuler" leaves the account and the registrations unchanged', async ({
    page,
  }) => {
    await registerOnTwoSlots();
    await signIn(page, member);
    await expect(page).toHaveURL(/\/events$/);

    await openDeletion(page, member.firstName);
    await page.getByRole('dialog').getByRole('button', { name: 'Annuler' }).click();

    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await database.user.count({ where: { email: member.email } })).toBe(1);
    expect(await database.registration.count({ where: { userId: { not: null } } })).toBe(2);
  });

  test('[F-11 S3] the last administrator is refused at the click, without confirmation', async ({
    page,
  }) => {
    await signIn(page, installation.admin);
    await expect(page).toHaveURL(/\/events$/);

    await openDeletion(page, installation.admin.firstName);

    // E3: the route announcer of Next.js is an alert too, so the toast is found by its message
    await expect(page.getByRole('alert').filter({ hasText: /Nomme d'abord/ })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await database.user.count({ where: { email: installation.admin.email } })).toBe(1);
  });

  test('[F-11 S4] the former holder cannot sign in again', async ({ page }) => {
    await signIn(page, member);
    await expect(page).toHaveURL(/\/events$/);
    await openDeletion(page, member.firstName);
    await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click();
    await expect(page).toHaveURL(/\/connexion$/);

    await signIn(page, member);

    await expect(page.getByText('E-mail ou mot de passe incorrect')).toBeVisible();
    await expect(page).toHaveURL(/\/connexion$/);
  });
});
