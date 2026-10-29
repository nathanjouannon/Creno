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

test.describe.configure({ mode: 'serial' });
test.afterAll(() => database.$disconnect());
test.beforeEach(async ({ request, baseURL }, testInfo) => {
  await resetInstance();
  await installInstance(request, baseURL!, addressOf(testInfo));
  await createMember();
});

async function signIn(page: Page, credentials: { email: string; password: string }) {
  await page.getByLabel('E-mail').fill(credentials.email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
}

const refusal = "Tu n'as pas le droit d'accéder à cette page";
const serious = async (page: Page) =>
  (await analyze(page)).violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
const scrolls = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

test('[F-03 S3] a visitor is sent to the sign-in page, then back to the page they asked for', async ({
  page,
}) => {
  await page.goto('/events/new');
  await expect(page).toHaveURL(/\/connexion\?suite=%2Fevents%2Fnew$/);

  await signIn(page, installation.admin);
  await expect(page).toHaveURL(/\/events\/new$/);
  await expect(page.getByRole('heading', { name: 'Créer un événement' })).toBeVisible();
});

test('[F-03 S3] an address that does not exist leads a visitor to the sign-in page too', async ({
  page,
}) => {
  await page.goto('/une/page/inconnue');
  await expect(page).toHaveURL(/\/connexion\?suite=/);
});

test('[F-03 S1] RG-14: a user opening the event creation page is refused, with no administrator tab', async ({
  page,
}) => {
  await page.goto('/connexion');
  await signIn(page, member);
  await expect(page).toHaveURL(/\/events$/);
  await expect(page.getByRole('link', { name: 'Membres' })).toHaveCount(0);

  await page.goto('/events/new');
  await expect(page.getByText(refusal)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Créer un événement' })).toHaveCount(0);
  // Still signed in, with the header
  await expect(page.getByRole('banner').getByText('Léa')).toBeVisible();
});

test('[F-03 S4] an administrator opens the event creation page and sees the administrator tabs', async ({
  page,
}) => {
  await page.goto('/connexion');
  await signIn(page, installation.admin);
  await expect(page).toHaveURL(/\/events$/);
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  await expect(nav.getByRole('link')).toHaveText(['Événements', 'Passés', 'Membres']);

  await page.goto('/events/new');
  await expect(page.getByRole('heading', { name: 'Créer un événement' })).toBeVisible();
  await expect(page.getByText(refusal)).toHaveCount(0);
});

test('a signed-in user who opens an unknown page gets "Page introuvable", header included', async ({
  page,
}) => {
  await page.goto('/connexion');
  await signIn(page, member);
  await expect(page).toHaveURL(/\/events$/);

  const response = await page.goto('/une/page/inconnue');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page introuvable' })).toBeVisible();
  await expect(page.getByRole('banner').getByText('Léa')).toBeVisible();
});

test('the demonstration page does not exist in production', async ({ page }) => {
  await page.goto('/connexion');
  await signIn(page, installation.admin);
  await expect(page).toHaveURL(/\/events$/);
  const response = await page.goto('/dev/composants');
  expect(response?.status()).toBe(404);
});

test('keyboard only: the user menu opens, reaches "Mon profil" and "Se déconnecter" and closes with Escape', async ({
  page,
}) => {
  await page.goto('/connexion');
  await signIn(page, installation.admin);
  await expect(page).toHaveURL(/\/events$/);

  const menu = page.getByRole('button', { name: 'Alex' });
  await page.keyboard.press('Tab'); // logo
  await page.keyboard.press('Tab'); // user menu
  await expect(menu).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Mon profil' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Se déconnecter' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Se déconnecter' })).toHaveCount(0);
  await expect(menu).toBeFocused();
});

test('accessibility and 360 px: the event list and the refusal page, with the menu open', async ({
  page,
}) => {
  await page.goto('/connexion');
  await signIn(page, member);
  await expect(page).toHaveURL(/\/events$/);
  await page.getByRole('button', { name: 'Léa' }).click();
  expect(await scrolls(page)).toBe(false);
  expect(await serious(page)).toEqual([]);

  await page.goto('/events/new');
  await expect(page.getByText(refusal)).toBeVisible();
  expect(await scrolls(page)).toBe(false);
  expect(await serious(page)).toEqual([]);
});
