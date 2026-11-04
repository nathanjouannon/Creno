import type { Page } from '@playwright/test';
import {
  addressOf,
  createMember,
  createOtherMember,
  database,
  expect,
  installInstance,
  installation,
  member,
  resetInstance,
  test,
  analyze,
} from './helpers';

// T-019: members and password reset (F-10, F-02), at 360 px.

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
  await expect(page).toHaveURL(/\/events$/);
}

const signInAsAdmin = (page: Page) => signIn(page, installation.admin);

/** axe without serious or critical violation, and no horizontal scroll at 360 px. */
async function checkScreen(page: Page) {
  await page.mouse.move(0, 0);
  const violations = (await analyze(page)).violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(
    false,
  );
}

/** From the member list: Membres, then the member. Two clicks to reach any action. */
async function openMember(page: Page, name: RegExp) {
  await page.getByRole('link', { name: 'Membres' }).click();
  await page.getByRole('link', { name }).click();
}

async function makeAdmin(firstName: string, lastName: string, email: string) {
  const user = await createOtherMember(firstName, lastName, email);
  return database.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
}

const roleOf = async (email: string) =>
  (await database.user.findFirstOrThrow({ where: { email } })).role;

test.describe('members (F-10)', () => {
  test('[F-10 S1] the list shows name, first name, e-mail and role', async ({ page }) => {
    await signInAsAdmin(page);
    await page.getByRole('link', { name: 'Membres' }).click();
    await expect(page.getByRole('heading', { name: 'Membres' })).toBeVisible();
    await expect(page.getByText('Bernard Léa · Utilisateur')).toBeVisible();
    await expect(page.getByText(member.email)).toBeVisible();
    await expect(page.getByText('Martin Alex · Administrateur')).toBeVisible();
    await checkScreen(page);
  });

  test('[F-10 S2] RG-04: giving the right makes two administrators, in two clicks from the list', async ({
    page,
  }) => {
    await signInAsAdmin(page);
    await openMember(page, /Bernard Léa/);
    await checkScreen(page);
    await page.getByRole('button', { name: 'Donner le droit administrateur' }).click();
    await expect(page.getByText(`${member.email} · Administrateur`)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Donner le droit administrateur' })).toHaveCount(
      0,
    );
    expect(await database.user.count({ where: { role: 'ADMIN' } })).toBe(2);
  });

  test('[F-10 S3] [F-10 S6] RG-04: withdrawing my own right leads to the events with a toast and no administration', async ({
    page,
  }) => {
    await makeAdmin('Marie', 'Durand', 'marie@exemple.fr');
    await signInAsAdmin(page);
    await openMember(page, /Martin Alex/);
    await checkScreen(page);
    await page.getByRole('button', { name: 'Retirer mon droit administrateur' }).click();
    await expect(page).toHaveURL(/\/events$/);
    await expect(page.getByText("Tu n'es plus administrateur.")).toBeVisible();
    await expect(page.getByRole('link', { name: 'Membres' })).toHaveCount(0);
    expect(await roleOf(installation.admin.email)).toBe('USER');
    expect(await roleOf('marie@exemple.fr')).toBe('ADMIN');

    await page.goto('/membres');
    await expect(page.getByRole('heading', { name: 'Accès refusé' })).toBeVisible();
  });

  test("[F-10 S4] RG-04, RG-12: another administrator's page has no way to withdraw their right nor to reset their password", async ({
    page,
  }) => {
    await makeAdmin('Marie', 'Durand', 'marie@exemple.fr');
    await signInAsAdmin(page);
    await openMember(page, /Durand Marie/);
    await expect(page.getByText('marie@exemple.fr · Administrateur')).toBeVisible();
    await expect(
      page.getByText('Aucune action pour lui retirer son droit ni réinitialiser son mot de passe.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /Retirer|Donner/ })).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Générer un lien de réinitialisation' }),
    ).toHaveCount(0);
    await checkScreen(page);
  });

  test('[F-10 S5] RG-04: the last administrator is refused, with the message, and stays administrator', async ({
    page,
  }) => {
    await signInAsAdmin(page);
    await openMember(page, /Martin Alex/);
    await page.getByRole('button', { name: 'Retirer mon droit administrateur' }).click();
    await expect(page.getByText("Nomme d'abord un autre administrateur.")).toBeVisible();
    await expect(page).toHaveURL(/\/membres\/\d+$/);
    expect(await roleOf(installation.admin.email)).toBe('ADMIN');
    await checkScreen(page);
  });

  test('a user gets the refusal on the member pages', async ({ page }) => {
    await signIn(page, member);
    await page.goto('/membres');
    await expect(page.getByRole('heading', { name: 'Accès refusé' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Membres' })).toHaveCount(0);
  });

  test('an unknown member shows the message', async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto('/membres/999999');
    await expect(page.getByText('Membre introuvable.')).toBeVisible();
  });
});

test.describe('password reset (F-10 S7, S8, F-02 S5, S6)', () => {
  async function generateLink(page: Page) {
    await page.getByRole('button', { name: 'Générer un lien de réinitialisation' }).click();
    const dialog = page.getByRole('dialog', { name: 'Lien de réinitialisation' });
    const link = await dialog.getByLabel('Lien').inputValue();
    return { dialog, link };
  }

  test('[F-10 S7] RG-12: the link is shown with its validity and a copy button', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await signInAsAdmin(page);
    await openMember(page, /Bernard Léa/);
    const { dialog, link } = await generateLink(page);
    expect(link).toMatch(/\/reinitialisation\/[A-Za-z0-9_-]{43}$/);
    await expect(dialog).toContainText('À usage unique');
    await expect(dialog).toContainText("Valable jusqu'au");
    await checkScreen(page);
    await dialog.getByRole('button', { name: 'Copier le lien' }).click();
    await expect(dialog.getByRole('button', { name: 'Lien copié' })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);
    await dialog.getByRole('button', { name: 'Fermer' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('[F-10 S8] RG-12: a new link invalidates the previous one', async ({ page }) => {
    await signInAsAdmin(page);
    await openMember(page, /Bernard Léa/);
    const first = await generateLink(page);
    await first.dialog.getByRole('button', { name: 'Fermer' }).click();
    const second = await generateLink(page);
    expect(second.link).not.toBe(first.link);

    await page.goto(first.link);
    await expect(
      page.getByText("Ce lien n'est plus valide, demande un nouveau lien à un administrateur."),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enregistrer' })).toHaveCount(0);
    await checkScreen(page);
    await page.goto(second.link);
    await expect(page.getByRole('heading', { name: 'Nouveau mot de passe' })).toBeVisible();
  });

  test('[F-02 S5] [F-02 S6] RG-01, RG-12: a new password is chosen once, then the link is dead', async ({
    page,
    browser,
  }) => {
    await signInAsAdmin(page);
    await openMember(page, /Bernard Léa/);
    const { link } = await generateLink(page);

    const visitor = await (await browser.newContext()).newPage();
    await visitor.goto(link);
    await expect(visitor.getByRole('heading', { name: 'Nouveau mot de passe' })).toBeVisible();
    await checkScreen(visitor);
    await visitor.getByLabel('Nouveau mot de passe').fill('123456789');
    await visitor.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(
      visitor.getByText('Le mot de passe doit contenir au moins 10 caractères'),
    ).toBeVisible();
    await checkScreen(visitor);

    await visitor.getByLabel('Nouveau mot de passe').fill('a-brand-new-password');
    await visitor.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(visitor).toHaveURL(/\/connexion/);
    await expect(visitor.getByText('Mot de passe changé. Connecte-toi.')).toBeVisible();

    await visitor.getByLabel('E-mail').fill(member.email);
    await visitor.getByLabel('Mot de passe', { exact: true }).fill(member.password);
    await visitor.getByRole('button', { name: 'Se connecter' }).click();
    await expect(visitor.getByText('E-mail ou mot de passe incorrect')).toBeVisible();
    await visitor.getByLabel('Mot de passe', { exact: true }).fill('a-brand-new-password');
    await visitor.getByRole('button', { name: 'Se connecter' }).click();
    await expect(visitor).toHaveURL(/\/events$/);

    await visitor.goto(link);
    await expect(visitor.getByText("Ce lien n'est plus valide", { exact: false })).toBeVisible();
  });

  test('keyboard: the new password is typed and sent without the mouse', async ({
    page,
    browser,
  }) => {
    await signInAsAdmin(page);
    await openMember(page, /Bernard Léa/);
    const { link } = await generateLink(page);
    const visitor = await (await browser.newContext()).newPage();
    await visitor.goto(link);
    await visitor.getByLabel('Nouveau mot de passe').focus();
    await visitor.keyboard.type('another-new-password');
    await visitor.keyboard.press('Enter');
    await expect(visitor).toHaveURL(/\/connexion/);
  });
});
