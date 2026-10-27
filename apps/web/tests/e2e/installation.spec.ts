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
test.beforeEach(resetInstance);
test.afterAll(() => database.$disconnect());

async function fillInstallForm(
  page: Page,
  overrides: Partial<{ club: string; lastName: string; email: string; password: string }> = {},
) {
  await page.getByLabel('Nom du club').fill(overrides.club ?? 'Ski Club des Arcs');
  await page.getByLabel('Fuseau horaire').selectOption('Europe/Paris');
  await page.getByLabel('Nom', { exact: true }).fill(overrides.lastName ?? 'Martin');
  await page.getByLabel('Prénom').fill('Alex');
  await page.getByLabel('E-mail').fill(overrides.email ?? 'mail.ex@exemple.fr');
  await page.getByLabel('Mot de passe', { exact: true }).fill(overrides.password ?? '0123456789');
}

test('[F-19 S1] a new instance is installed and the administrator lands on the empty event list', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/installation$/);

  await fillInstallForm(page);
  await page.getByRole('button', { name: 'Installer' }).click();

  await expect(page).toHaveURL(/\/events$/);
  await expect(page.getByText('Aucun événement à venir pour le moment')).toBeVisible();

  // RG-17, RG-04, RG-16: one club, one administrator
  expect(await database.club.findMany({ select: { name: true, timezone: true } })).toEqual([
    { name: 'Ski Club des Arcs', timezone: 'Europe/Paris' },
  ]);
  expect(await database.user.findMany({ select: { email: true, role: true } })).toEqual([
    { email: 'mail.ex@exemple.fr', role: 'ADMIN' },
  ]);

  // The session is open: the API knows the administrator
  const me = await page.request.get('/api/me');
  expect(await me.json()).toMatchObject({ firstName: 'Alex', role: 'ADMIN' });
});

test('[F-19 S2] RG-01: invalid fields show their messages under the fields, keep the others filled and create nothing', async ({
  page,
}) => {
  await page.goto('/installation');
  await fillInstallForm(page, { club: '', email: 'alex@exemple', password: '123456789' });
  await page.getByRole('button', { name: 'Installer' }).click();

  await expect(page.getByText('Ce champ est obligatoire.')).toBeVisible();
  await expect(page.getByText('Renseigne une adresse e-mail valide.')).toBeVisible();
  await expect(
    page.getByText('Le mot de passe doit contenir au moins 10 caractères.'),
  ).toBeVisible();
  await expect(page.getByLabel('Nom du club')).toHaveAttribute('aria-invalid', 'true');

  // Other fields are still filled
  await expect(page.getByLabel('Nom', { exact: true })).toHaveValue('Martin');
  await expect(page.getByLabel('Prénom')).toHaveValue('Alex');
  await expect(page).toHaveURL(/\/installation$/);
  expect(await database.user.count()).toBe(0);
  expect(await database.club.count()).toBe(0);

  // Correcting the fields lets the installation through
  await fillInstallForm(page);
  await page.getByRole('button', { name: 'Installer' }).click();
  await expect(page).toHaveURL(/\/events$/);
});

test('[F-19 S3] RG-17: the installation page is "not found" once the instance is installed', async ({
  page,
  request,
  baseURL,
}, testInfo) => {
  await installInstance(request, baseURL!, addressOf(testInfo));
  const response = await page.goto('/installation');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page introuvable' })).toBeVisible();
  expect(await database.user.count()).toBe(1);
});

test('[F-19 S4] RG-17: before the installation every page leads to the installation page', async ({
  page,
}) => {
  for (const path of ['/events', '/events/12', '/connexion', '/membres']) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/installation$/);
    await expect(page.getByRole('heading', { name: 'Installer Créno' })).toBeVisible();
  }
});

test('[F-19 S4] /health stays reachable before the installation', async ({ request }) => {
  expect((await request.get('/health')).status()).toBe(200);
});

test('accessibility and 360 px: no serious violation, no horizontal scroll, on the form and on its errors', async ({
  page,
}) => {
  await page.goto('/installation');
  const scrolls = () =>
    page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(await scrolls()).toBe(false);
  expect(
    (await new AxeBuilder({ page }).analyze()).violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    ),
  ).toEqual([]);

  await page.getByRole('button', { name: 'Installer' }).click();
  await expect(page.getByText('Ce champ est obligatoire.').first()).toBeVisible();
  expect(await scrolls()).toBe(false);
  expect(
    (await new AxeBuilder({ page }).analyze()).violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    ),
  ).toEqual([]);
});

test('keyboard: the form is usable with the keyboard alone', async ({ page }) => {
  await page.goto('/installation');
  await page.getByLabel('Nom du club').focus();
  await page.keyboard.type(installation.club.name);
  await page.keyboard.press('Tab'); // time zone
  await page.keyboard.press('Tab'); // last name
  await page.keyboard.type(installation.admin.lastName);
  await page.keyboard.press('Tab');
  await page.keyboard.type(installation.admin.firstName);
  await page.keyboard.press('Tab');
  await page.keyboard.type(installation.admin.email);
  await page.keyboard.press('Tab');
  await page.keyboard.type(installation.admin.password);
  await page.keyboard.press('Tab'); // "Afficher"
  await page.keyboard.press('Tab'); // "Installer"
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/events$/);
});
