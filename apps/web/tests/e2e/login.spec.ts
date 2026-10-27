import AxeBuilder from '@axe-core/playwright';
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

test.describe.configure({ mode: 'serial' });
test.afterAll(() => database.$disconnect());
test.beforeEach(async ({ request, baseURL }, testInfo) => {
  await resetInstance();
  await installInstance(request, baseURL!, addressOf(testInfo));
});

const { email, password } = installation.admin;

async function signIn(page: Page, address = email, secret = password) {
  await page.getByLabel('E-mail').fill(address);
  await page.getByLabel('Mot de passe', { exact: true }).fill(secret);
  await page.getByRole('button', { name: 'Se connecter' }).click();
}

const wrongCredentials = 'E-mail ou mot de passe incorrect.';
const blocked = 'Trop de tentatives. Réessaie dans 15 minutes.';

test('[F-02 S1] a user signs in, lands on the event list and sees their first name', async ({
  page,
}) => {
  await page.goto('/connexion');
  await signIn(page);
  await expect(page).toHaveURL(/\/events$/);
  await expect(page.getByRole('banner').getByText('Alex')).toBeVisible();
  await expect(page.getByText('Aucun événement à venir pour le moment')).toBeVisible();
});

test('[F-02 S1 bis] after signing in, the user arrives on the page they had asked for', async ({
  page,
}) => {
  await page.goto('/connexion?suite=%2Fevents%3Ffrom%3Dguard');
  await signIn(page);
  await expect(page).toHaveURL(/\/events\?from=guard$/);
});

test('[F-02 S1 bis] a destination on another site is ignored', async ({ page }) => {
  await page.goto('/connexion?suite=%2F%2Fevil.example');
  await signIn(page);
  await expect(page).toHaveURL(/\/events$/);
});

test('[F-02 S2] a wrong password keeps the user on the page, with one undetailed message and an empty password', async ({
  page,
}) => {
  await page.goto('/connexion');
  await signIn(page, email, 'wrong-password');
  await expect(page.getByRole('alert').filter({ hasText: wrongCredentials })).toBeVisible();
  await expect(page).toHaveURL(/\/connexion$/);
  await expect(page.getByLabel('E-mail')).toHaveValue(email);
  await expect(page.getByLabel('Mot de passe', { exact: true })).toHaveValue('');
});

test('[F-02 S2] RG-03: an unknown address gets the very same message', async ({ page }) => {
  await page.goto('/connexion');
  await signIn(page, 'nobody@exemple.fr', 'wrong-password');
  await expect(page.getByRole('alert').filter({ hasText: wrongCredentials })).toBeVisible();
});

test('[F-02 S3] RG-03: after 5 failures the 6th attempt is blocked, even with the right password', async ({
  page,
}) => {
  await page.goto('/connexion');
  for (let i = 0; i < 5; i++) {
    await signIn(page, email, 'wrong-password');
    await expect(page.getByRole('alert').filter({ hasText: wrongCredentials })).toBeVisible();
  }
  await signIn(page);
  await expect(page.getByRole('alert').filter({ hasText: blocked })).toBeVisible();
  await expect(page).toHaveURL(/\/connexion$/);
});

test('[F-02 S3 ter] RG-03: an address without account is blocked with the same message', async ({
  page,
}) => {
  await page.goto('/connexion');
  for (let i = 0; i < 5; i++) {
    await signIn(page, 'nobody@exemple.fr', 'wrong-password');
    await expect(page.getByRole('alert').filter({ hasText: wrongCredentials })).toBeVisible();
  }
  await signIn(page, 'nobody@exemple.fr', 'wrong-password');
  await expect(page.getByRole('alert').filter({ hasText: blocked })).toBeVisible();
});

test('[F-02 S4] signing out leads back to the sign-in page and protected data is gone', async ({
  page,
}) => {
  await page.goto('/connexion');
  await signIn(page);
  await expect(page).toHaveURL(/\/events$/);

  await page.getByRole('button', { name: 'Alex' }).click();
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(page).toHaveURL(/\/connexion$/);
  expect((await page.request.get('/api/me')).status()).toBe(401);

  // The first name is gone from the header of the event page
  await page.goto('/events');
  await expect(page.getByRole('button', { name: 'Se déconnecter' })).toHaveCount(0);
});

test('a signed-in user who opens the sign-in page is sent on to the events', async ({ page }) => {
  await page.goto('/connexion');
  await signIn(page);
  await expect(page).toHaveURL(/\/events$/);
  await page.goto('/connexion');
  await expect(page).toHaveURL(/\/events$/);
});

test('accessibility and 360 px: the sign-in page and its error state', async ({ page }) => {
  await page.goto('/connexion');
  const scrolls = () =>
    page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  const serious = async () =>
    (await new AxeBuilder({ page }).analyze()).violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
  expect(await scrolls()).toBe(false);
  expect(await serious()).toEqual([]);

  await signIn(page, email, 'wrong-password');
  await expect(page.getByRole('alert').filter({ hasText: wrongCredentials })).toBeVisible();
  expect(await scrolls()).toBe(false);
  expect(await serious()).toEqual([]);
});
