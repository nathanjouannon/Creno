import type { Browser, Page } from '@playwright/test';
import { addressOf, database, expect, installation, resetInstance, test } from './helpers';

// T-023: the target scenario of the MVP (prd.md, section 5), played once, as the people would play it:
// install, invite, create an event with slots, register volunteers, adjust, follow the filling. At 360 px.

test.afterAll(() => database.$disconnect());
test.beforeEach(() => resetInstance());

const slotCard = (page: Page, hours: string) =>
  page.getByRole('heading', { name: hours, exact: true }).locator('xpath=ancestor::div[3]');

/** A volunteer's own browser, from its own address, so nothing is shared with the administrator. */
async function newVolunteerPage(browser: Browser, address: string) {
  const context = await browser.newContext({
    viewport: { width: 360, height: 740 },
    locale: 'fr-FR',
    extraHTTPHeaders: { 'x-forwarded-for': address },
  });
  return { context, page: await context.newPage() };
}

async function addSlot(page: Page, start: string, end: string, limit?: string) {
  await page.getByRole('button', { name: '+ Ajouter un créneau' }).click();
  const dialog = page.getByRole('dialog', { name: 'Ajouter un créneau' });
  await dialog.getByLabel('Début').fill(start);
  await dialog.getByLabel('Fin').fill(end);
  if (limit) await dialog.getByLabel(/Limite de places/).fill(limit);
  await dialog.getByRole('button', { name: 'Valider le créneau' }).click();
}

async function joinWithLink(browser: Browser, link: string, firstName: string, n: number) {
  const { context, page } = await newVolunteerPage(browser, `10.23.0.${n}`);
  await page.goto(link);
  await page.getByLabel('Nom', { exact: true }).fill('Bénévole');
  await page.getByLabel('Prénom').fill(firstName);
  await page.getByLabel('E-mail').fill(`volunteer${n}@exemple.fr`);
  await page.getByLabel('Mot de passe').fill('9876543210');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page.getByRole('heading', { name: 'Course de ski du 15 janvier' })).toBeVisible();
  return { context, page };
}

test('[MVP] install, invite, create an event with slots, register volunteers, adjust, follow the filling', async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.context().setExtraHTTPHeaders({ 'x-forwarded-for': addressOf(testInfo) });

  // F-19: the first visitor installs the instance
  await page.goto('/');
  await expect(page).toHaveURL(/\/installation$/);
  await page.getByLabel('Nom du club').fill(installation.club.name);
  await page.getByLabel('Fuseau horaire').selectOption(installation.club.timezone);
  await page.getByLabel('Nom', { exact: true }).fill(installation.admin.lastName);
  await page.getByLabel('Prénom').fill(installation.admin.firstName);
  await page.getByLabel('E-mail').fill(installation.admin.email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(installation.admin.password);
  await page.getByRole('button', { name: 'Installer' }).click();
  await expect(page).toHaveURL(/\/events$/);

  // F-04, F-05: an event with a limited and an unlimited slot
  await page.getByRole('button', { name: '+ Créer un événement' }).click();
  await page.getByLabel('Titre').fill('Course de ski du 15 janvier');
  await page.getByLabel('Lieu').fill('Station des Arcs');
  await page.getByLabel('Date de début').fill('2030-01-15');
  await page.getByLabel('Heure de début').fill('08:00');
  await page.getByLabel('Date de fin').fill('2030-01-15');
  await page.getByLabel('Heure de fin').fill('17:00');
  await addSlot(page, '08:00', '10:00', '2');
  await addSlot(page, '10:00', '12:00');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('heading', { name: 'Course de ski du 15 janvier' })).toBeVisible();
  const eventUrl = page.url();

  // F-01: the invitation link
  await page.getByRole('button', { name: 'Inviter des bénévoles' }).click();
  const link = await page
    .getByRole('dialog', { name: "Lien d'invitation" })
    .getByLabel('Lien')
    .inputValue();
  expect(link).toContain('/invitation/');
  await page.keyboard.press('Escape');

  // F-01, F-07: three volunteers create their account from the link; two take the limited slot
  const lea = await joinWithLink(browser, link, 'Léa', 1);
  const paul = await joinWithLink(browser, link, 'Paul', 2);
  const eva = await joinWithLink(browser, link, 'Eva', 3);
  for (const { page: volunteer } of [lea, paul]) {
    await slotCard(volunteer, '08:00 – 10:00')
      .getByRole('button', { name: "Je m'inscris au créneau 08:00 – 10:00" })
      .click();
    await expect(
      slotCard(volunteer, '08:00 – 10:00').getByRole('button', { name: /Me désinscrire/ }),
    ).toBeVisible();
  }

  // RG-07: the third one finds the slot full and takes the unlimited one
  await eva.page.reload();
  await expect(
    slotCard(eva.page, '08:00 – 10:00').getByRole('button', { name: /Complet/ }),
  ).toBeDisabled();
  await slotCard(eva.page, '10:00 – 12:00')
    .getByRole('button', { name: "Je m'inscris au créneau 10:00 – 12:00" })
    .click();

  // F-09: the administrator follows the filling
  await page.goto(eventUrl);
  const limited = slotCard(page, '08:00 – 10:00');
  await expect(limited.getByText('2 / 2')).toBeVisible();
  await expect(limited.getByText('Léa B.')).toBeVisible();
  await expect(slotCard(page, '10:00 – 12:00').getByText('Eva B.')).toBeVisible();

  // Adjust: one volunteer is removed, the limit is raised, the freed places are taken
  await limited.getByRole('button', { name: /Retirer Paul B\./ }).click();
  await page
    .getByRole('dialog', { name: 'Retirer cet inscrit ?' })
    .getByRole('button', { name: 'Retirer', exact: true })
    .click();
  await expect(limited.getByText('1 / 2')).toBeVisible();
  await page.getByRole('button', { name: 'Modifier le créneau 08:00 – 10:00' }).click();
  const dialog = page.getByRole('dialog', { name: 'Modifier le créneau' });
  await dialog.getByLabel(/Limite de places/).fill('3');
  await dialog.getByRole('button', { name: 'Valider le créneau' }).click();
  await expect(limited.getByText('1 / 3')).toBeVisible();

  await eva.page.reload();
  await slotCard(eva.page, '08:00 – 10:00')
    .getByRole('button', { name: "Je m'inscris au créneau 08:00 – 10:00" })
    .click();
  await expect(
    slotCard(eva.page, '08:00 – 10:00').getByRole('button', { name: /Me désinscrire/ }),
  ).toBeVisible();
  await page.reload();
  await expect(limited.getByText('2 / 3')).toBeVisible();
  expect(await database.registration.count()).toBe(3);

  for (const { context } of [lea, paul, eva]) await context.close();
});
