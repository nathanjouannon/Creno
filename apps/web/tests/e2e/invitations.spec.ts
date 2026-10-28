import AxeBuilder from '@axe-core/playwright';
import { createHash } from 'node:crypto';
import type { Page } from '@playwright/test';
import {
  addressOf,
  database,
  expect,
  installInstance,
  installation,
  resetInstance,
  test,
} from './helpers';

// T-017: invitations (F-01), at 360 px. The club is in Europe/Paris (RG-16): 08:00 shown is 07:00 UTC in March.

test.describe.configure({ mode: 'serial' });
test.afterAll(() => database.$disconnect());
test.beforeEach(async ({ request, baseURL }, testInfo) => {
  await resetInstance();
  await installInstance(request, baseURL!, addressOf(testInfo));
});

const newcomer = {
  lastName: 'Bernard',
  firstName: 'Léa',
  email: 'lea@exemple.fr',
  password: '9876543210',
};

let counter = 0;

async function insertEvent(startsAt = '2030-03-14T07:00:00Z', endsAt = '2030-03-14T17:00:00Z') {
  return database.event.create({
    data: {
      title: 'Compétition du 14 mars',
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
    },
  });
}

/** A link stored as the application does: only the hash of the token. */
async function insertInvitation(eventId: number) {
  counter += 1;
  const token = `e2e-token-${counter}-${'x'.repeat(30)}`;
  await database.invitation.create({
    data: { eventId, token: createHash('sha256').update(token).digest('hex') },
  });
  return token;
}

async function signInAsAdmin(page: Page) {
  await page.goto('/connexion');
  await page.getByLabel('E-mail').fill(installation.admin.email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(installation.admin.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/events$/);
}

/** axe without serious or critical violation, and no horizontal scroll at 360 px. */
async function checkScreen(page: Page) {
  await page.mouse.move(0, 0);
  const violations = (await new AxeBuilder({ page }).analyze()).violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(
    false,
  );
}

async function fillSignup(page: Page, values: Partial<typeof newcomer> = {}) {
  const v = { ...newcomer, ...values };
  await page.getByLabel('Nom', { exact: true }).fill(v.lastName);
  await page.getByLabel('Prénom').fill(v.firstName);
  await page.getByLabel('E-mail').fill(v.email);
  await page.getByLabel('Mot de passe').fill(v.password);
}

test.describe('invitation (F-01)', () => {
  test('[F-01 S1] [F-01 S7] RG-02: the link is shown with its validity; no button once the event has started', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const upcoming = await insertEvent();
    const started = await insertEvent('2020-01-01T08:00:00Z', '2100-01-01T08:00:00Z');
    await signInAsAdmin(page);

    await page.goto(`/events/${started.id}`);
    await expect(page.getByRole('heading', { name: 'Compétition du 14 mars' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Inviter des bénévoles' })).toHaveCount(0);

    await page.goto(`/events/${upcoming.id}`);
    await checkScreen(page);
    await page.getByRole('button', { name: 'Inviter des bénévoles' }).click();
    const dialog = page.getByRole('dialog', { name: "Lien d'invitation" });
    await expect(dialog).toContainText('14 mars, 08:00');
    const link = await dialog.getByLabel('Lien').inputValue();
    expect(link).toMatch(/\/invitation\/[A-Za-z0-9_-]{43}$/);
    await checkScreen(page);
    await dialog.getByRole('button', { name: 'Copier le lien' }).click();
    await expect(dialog.getByRole('button', { name: 'Lien copié' })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);
    const stored = await database.invitation.findFirstOrThrow();
    expect(stored.token).not.toContain(link.split('/invitation/')[1]!);
  });

  test('[F-01 S2] RG-01, RG-02: an account is created, the user lands on the event with their first name', async ({
    page,
  }) => {
    const event = await insertEvent();
    const token = await insertInvitation(event.id);
    await page.goto(`/invitation/${token}`);
    await expect(page.getByRole('heading', { name: 'Créer mon compte' })).toBeVisible();
    await expect(page.getByText('Ski Club des Arcs')).toBeVisible();
    await checkScreen(page);

    await fillSignup(page);
    await page.getByRole('button', { name: 'Créer mon compte' }).click();
    await expect(page).toHaveURL(new RegExp(`/events/${event.id}$`));
    await expect(page.getByRole('heading', { name: 'Compétition du 14 mars' })).toBeVisible();
    await expect(page.getByText('Léa')).toBeVisible();
    const user = await database.user.findFirstOrThrow({ where: { email: newcomer.email } });
    expect(user.role).toBe('USER');
  });

  test('[F-01 S3] RG-01: a 9-character password is refused with its message, the fields stay filled', async ({
    page,
  }) => {
    const token = await insertInvitation((await insertEvent()).id);
    await page.goto(`/invitation/${token}`);
    await fillSignup(page, { password: '123456789' });
    await page.getByRole('button', { name: 'Créer mon compte' }).click();
    await expect(
      page.getByText('Le mot de passe doit contenir au moins 10 caractères'),
    ).toBeVisible();
    await expect(page.getByLabel('Prénom')).toHaveValue('Léa');
    await expect(page.getByLabel('E-mail')).toHaveValue(newcomer.email);
    await checkScreen(page);
    expect(await database.user.count({ where: { email: newcomer.email } })).toBe(0);
  });

  test('[F-01 S4] RG-02: the link of a started event shows the message and no form', async ({
    page,
  }) => {
    const event = await insertEvent('2020-01-01T08:00:00Z', '2100-01-01T08:00:00Z');
    const token = await insertInvitation(event.id);
    await page.goto(`/invitation/${token}`);
    await expect(
      page.getByText("Ce lien n'est plus valide, demande un nouveau lien à un administrateur."),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Créer mon compte' })).toHaveCount(0);
    await checkScreen(page);
  });

  test('[F-01 S4] an unknown link says the same', async ({ page }) => {
    await page.goto('/invitation/not-a-real-token');
    await expect(page.getByText("Ce lien n'est plus valide", { exact: false })).toBeVisible();
  });

  test('[F-01 S5] [F-01 S5 bis] RG-01: a used address, whatever its case, offers the sign-in which leads to the event', async ({
    page,
  }) => {
    const event = await insertEvent();
    const token = await insertInvitation(event.id);
    await page.goto(`/invitation/${token}`);
    await fillSignup(page, { email: installation.admin.email.toUpperCase() });
    await page.getByRole('button', { name: 'Créer mon compte' }).click();
    await expect(page.getByText('Un compte existe déjà avec cette adresse')).toBeVisible();
    expect(await database.user.count()).toBe(1);
    await checkScreen(page);

    await page.getByRole('button', { name: 'Aller à la connexion' }).click();
    await expect(page).toHaveURL(/\/connexion/);
    await page.getByLabel('E-mail').fill(installation.admin.email);
    await page.getByLabel('Mot de passe', { exact: true }).fill(installation.admin.password);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(new RegExp(`/events/${event.id}$`));
  });

  test('[F-01 S6] RG-01: a missing name or a malformed address gives one toast and keeps the fields', async ({
    page,
  }) => {
    const token = await insertInvitation((await insertEvent()).id);
    await page.goto(`/invitation/${token}`);
    await fillSignup(page, { lastName: '', email: 'pas-un-mail' });
    await page.getByRole('button', { name: 'Créer mon compte' }).click();
    await expect(
      page.getByText('Renseigne ton nom, ton prénom et une adresse e-mail valide'),
    ).toBeVisible();
    await expect(page.getByLabel('Prénom')).toHaveValue('Léa');
    expect(await database.user.count()).toBe(1);
  });

  test('keyboard: the form is filled and sent without the mouse', async ({ page }) => {
    const event = await insertEvent();
    const token = await insertInvitation(event.id);
    await page.goto(`/invitation/${token}`);
    await page.getByLabel('Nom', { exact: true }).focus();
    await page.keyboard.type(newcomer.lastName);
    await page.keyboard.press('Tab');
    await page.keyboard.type(newcomer.firstName);
    await page.keyboard.press('Tab');
    await page.keyboard.type(newcomer.email);
    await page.keyboard.press('Tab');
    await page.keyboard.type(newcomer.password);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`/events/${event.id}$`));
  });
});
