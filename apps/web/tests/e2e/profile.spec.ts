import {
  addressOf,
  createMember,
  database,
  expect,
  installInstance,
  member,
  resetInstance,
  test,
  analyze,
} from './helpers';

// T-025: « Mon profil » (F-20, RG-18), at 360 px.

test.describe.configure({ mode: 'serial' });
test.afterAll(() => database.$disconnect());
test.beforeEach(async ({ request, baseURL, page }, testInfo) => {
  await resetInstance();
  await installInstance(request, baseURL!, addressOf(testInfo));
  await createMember();
  await page.setViewportSize({ width: 360, height: 740 });
});

async function signIn(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/connexion');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/events/);
}

async function signOut(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: member.firstName }).click();
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(page).toHaveURL(/\/connexion/);
}

test('[F-20 S1] the menu leads to the profile, pre-filled, without horizontal scroll or serious a11y issue', async ({
  page,
}) => {
  await signIn(page, member.email, member.password);
  await page.getByRole('button', { name: member.firstName }).click();
  await page.getByRole('link', { name: 'Mon profil' }).click();

  await expect(page.getByRole('heading', { name: 'Mon profil' })).toBeVisible();
  await expect(page.getByLabel('Nom', { exact: true })).toHaveValue(member.lastName);
  await expect(page.getByLabel('Prénom')).toHaveValue(member.firstName);
  await expect(page.getByLabel('E-mail')).toHaveValue(member.email);
  await expect(page.getByLabel('Mot de passe actuel')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  const { violations } = await analyze(page);
  expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
});

test('[F-20 S2] a new first name shows in the header at once', async ({ page }) => {
  await signIn(page, member.email, member.password);
  await page.goto('/profil');
  await page.getByLabel('Prénom').fill('Léana');
  await page.getByRole('button', { name: 'Enregistrer' }).click();

  await expect(page.getByText('Profil enregistré')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Léana' })).toBeVisible();
});

test('[F-20 S3, S4] a new address asks for the password, then the old address no longer signs in', async ({
  page,
}) => {
  await signIn(page, member.email, member.password);
  await page.goto('/profil');
  await page.getByLabel('E-mail').fill('nouvelle@exemple.fr');
  await page.getByLabel('Mot de passe actuel').fill('mauvais-mot-de-passe');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('Le mot de passe actuel est incorrect.')).toBeVisible();

  await page.getByLabel('Mot de passe actuel').fill(member.password);
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('Profil enregistré')).toBeVisible();

  await signOut(page);
  await signIn(page, 'nouvelle@exemple.fr', member.password);

  await signOut(page);
  await page.getByLabel('E-mail').fill(member.email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(member.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByText('E-mail ou mot de passe incorrect.')).toBeVisible();
});

test('[F-20 S5] an address used by someone else is refused under its field', async ({ page }) => {
  await database.user.create({
    data: {
      firstName: 'Marie',
      lastName: 'Roux',
      email: 'Marie@Club.fr',
      passwordHash: 'x',
      role: 'USER',
    },
  });
  await signIn(page, member.email, member.password);
  await page.goto('/profil');
  await page.getByLabel('E-mail').fill('marie@club.fr');
  await page.getByLabel('Mot de passe actuel').fill(member.password);
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(
    page.getByText('Cette adresse est déjà utilisée par un autre compte.'),
  ).toBeVisible();
});
