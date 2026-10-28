import { createHash } from 'node:crypto';
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

// T-021: axe on every screen and every important state, at 360 px and 1000 px (testing.md, section 6), and the
// information notice reachable from each page (security.md, section 4).

test.describe.configure({ mode: 'serial' });
test.afterAll(() => database.$disconnect());

const VIEWPORTS = [
  { width: 360, height: 740 },
  { width: 1000, height: 800 },
];
const NOTICE_LINK = "Mentions d'information";

/** axe without serious or critical violation, no horizontal scroll, and the notice link in the footer. */
async function scan(page: Page, screen: string) {
  await page.mouse.move(0, 0);
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${screen}: ${v.id} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`);
  expect(blocking).toEqual([]);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    `${screen}: horizontal scroll`,
  ).toBe(false);
  await expect(
    page.getByRole('contentinfo').getByRole('link', { name: NOTICE_LINK }),
    `${screen}: footer link`,
  ).toBeVisible();
}

async function signIn(page: Page, credentials: { email: string; password: string }) {
  await page.goto('/connexion');
  await page.getByLabel('E-mail').fill(credentials.email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/events$/);
}

async function insertEvent() {
  const hour = 3_600_000;
  const event = await database.event.create({
    data: {
      title: 'Compétition du 14 mars',
      description: 'Buvette et chronométrage',
      location: 'Stade des Arcs',
      startsAt: new Date(Date.now() + 24 * hour),
      endsAt: new Date(Date.now() + 36 * hour),
    },
  });
  await database.slot.createMany({
    data: [
      {
        eventId: event.id,
        startsAt: new Date(Date.now() + 25 * hour),
        endsAt: new Date(Date.now() + 28 * hour),
        capacity: 2,
      },
      {
        eventId: event.id,
        startsAt: new Date(Date.now() + 29 * hour),
        endsAt: new Date(Date.now() + 32 * hour),
        capacity: null,
      },
    ],
  });
  await database.event.create({
    data: {
      title: 'Fête passée',
      startsAt: new Date(Date.now() - 48 * hour),
      endsAt: new Date(Date.now() - 36 * hour),
    },
  });
  return event.id;
}

for (const viewport of VIEWPORTS) {
  const size = `${viewport.width} px`;

  test.describe(`before the installation, ${size}`, () => {
    test.use({ viewport });
    test.beforeEach(() => resetInstance());

    test('installation and information notice', async ({ page }) => {
      await page.goto('/installation');
      await expect(page.getByRole('heading', { name: 'Installer Créno' })).toBeVisible();
      await scan(page, 'A10 installation');

      // The notice stays readable before any club exists
      await page.getByRole('contentinfo').getByRole('link', { name: NOTICE_LINK }).click();
      await expect(page.getByRole('heading', { name: NOTICE_LINK, level: 1 })).toBeVisible();
      await scan(page, 'notice without club');
    });
  });

  test.describe(`installed instance, ${size}`, () => {
    test.use({ viewport });
    let eventId: number;
    test.beforeEach(async ({ request, baseURL }, testInfo) => {
      await resetInstance();
      await installInstance(request, baseURL!, addressOf(testInfo));
      await createMember();
      eventId = await insertEvent();
    });

    test('public screens', async ({ page }) => {
      await page.goto('/connexion');
      await scan(page, 'A5 connexion');
      await page.getByLabel('E-mail').fill('inconnu@exemple.fr');
      await page.getByLabel('Mot de passe', { exact: true }).fill('mauvais-mot-de-passe');
      await page.getByRole('button', { name: 'Se connecter' }).click();
      await expect(page.getByText('E-mail ou mot de passe incorrect')).toBeVisible();
      await scan(page, 'A6 connexion en erreur');

      await page.goto('/reinitialisation/lien-inconnu');
      await scan(page, 'A9 lien de réinitialisation invalide');
      await page.goto('/invitation/lien-inconnu');
      await scan(page, 'A4 invitation invalide');

      const token = `e2e-a11y-${'x'.repeat(34)}`;
      await database.invitation.create({
        data: { eventId, token: createHash('sha256').update(token).digest('hex') },
      });
      await page.goto(`/invitation/${token}`);
      await expect(page.getByRole('button', { name: 'Créer mon compte' })).toBeVisible();
      await scan(page, 'A1 invitation');
      await page.getByRole('button', { name: 'Créer mon compte' }).click();
      await scan(page, 'A2 invitation en erreur');

      await page.goto('/mentions');
      await expect(page.getByText('Ski Club des Arcs')).toBeVisible();
      await scan(page, 'mentions');
      await page.goto('/installation');
      await expect(page.getByText(/introuvable|404/i).first()).toBeVisible();
    });

    test('volunteer screens', async ({ page }) => {
      await signIn(page, member);
      await scan(page, 'B1 événements');
      await page.goto(`/events/${eventId}`);
      await expect(page.getByRole('heading', { name: 'Compétition du 14 mars' })).toBeVisible();
      await scan(page, 'B3 événement et créneaux');

      await page.getByRole('button', { name: member.firstName }).click();
      await scan(page, 'E1 menu du prénom');
      await page.getByRole('button', { name: 'Supprimer mon compte' }).click();
      await expect(page.getByRole('dialog', { name: 'Supprimer mon compte ?' })).toBeVisible();
      await scan(page, 'E2 confirmation de suppression');
    });

    test('administrator screens', async ({ page }) => {
      await signIn(page, installation.admin);
      await scan(page, 'C1 événements (administrateur)');
      await page.goto('/events/new');
      await expect(page.getByRole('heading', { name: /événement/i }).first()).toBeVisible();
      await scan(page, 'C4 nouvel événement');
      await page.getByRole('button', { name: /Créer|Enregistrer/ }).click();
      await scan(page, 'C4 nouvel événement en erreur');
      await page.goto(`/events/${eventId}`);
      await scan(page, 'C2 remplissage');
      await page.goto(`/events/${eventId}/edit`);
      await scan(page, 'C5 modification');
      await page.goto('/events/past');
      await scan(page, 'C9 événements passés');
      await page.goto('/membres');
      await scan(page, 'D1 membres');
      await page.getByRole('link', { name: new RegExp(member.lastName) }).click();
      await scan(page, 'D2 fiche');
    });
  });
}
