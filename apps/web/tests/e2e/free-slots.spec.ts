import AxeBuilder from '@axe-core/playwright';
import type { RegistrationMode } from '@prisma/client';
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
} from './helpers';

// T-026, F-22: free slots and registration modes (B8, B8 bis, B9, B9 bis, C2, C4, C11), at 360 px unless stated.
// The club is in Europe/Paris (RG-16): the event runs 09:00 to 18:00 local time on 14 March 2030 (08:00 to 17:00 UTC).

test.describe.configure({ mode: 'serial' });
test.afterAll(() => database.$disconnect());
test.beforeEach(async ({ request, baseURL }, testInfo) => {
  await resetInstance();
  await installInstance(request, baseURL!, addressOf(testInfo));
  await createMember();
});

const utc = (time: string) => new Date(`2030-03-14T${time}:00Z`);
let counter = 0;

async function insertEvent(registrationMode: RegistrationMode, slots: { capacity: number }[] = []) {
  return database.event.create({
    data: {
      title: 'Journée de ski du club',
      location: 'Les Arcs',
      startsAt: utc('08:00'),
      endsAt: utc('17:00'),
      registrationMode,
      slots: {
        create: slots.map(({ capacity }) => ({
          startsAt: utc('08:00'),
          endsAt: utc('11:00'),
          capacity,
        })),
      },
    },
  });
}

/** A free slot of somebody else, « Marc D. » for first name « Marc », last name « Dubois »; times in UTC. */
async function insertFreeSlot(eventId: number, name: [string, string], start: string, end: string) {
  counter += 1;
  const user = await createOtherMember(name[0], name[1], `free${counter}@exemple.fr`);
  return database.registration.create({
    data: { eventId, userId: user.id, startsAt: utc(start), endsAt: utc(end) },
  });
}

async function signIn(page: Page, credentials: { email: string; password: string }) {
  await page.goto('/connexion');
  await page.getByLabel('E-mail').fill(credentials.email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/events$/);
}

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
}

/** Types local times in « Choisir mes horaires » (B9) and saves. */
async function chooseHours(page: Page, start: string, end: string) {
  const dialog = page.getByRole('dialog', { name: 'Choisir mes horaires' });
  await dialog.getByLabel('Heure de début').fill(start);
  await dialog.getByLabel('Heure de fin').fill(end);
  await dialog.getByRole('button', { name: 'Enregistrer' }).click();
  return dialog;
}

test('[F-22 S1] RG-19: an event in fixed slots behaves as before, without any free slot action', async ({
  page,
}) => {
  const event = await insertEvent('FIXED', [{ capacity: 4 }]);
  await signIn(page, member);
  await page.goto(`/events/${event.id}`);
  await expect(
    page.getByRole('button', { name: /Je m'inscris au créneau 09:00 – 12:00/ }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Créneaux libres' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Créneaux proposés' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Choisir mes horaires' })).toHaveCount(0);
});

test('[F-22 S3, S5, S9, S12] volunteer in free slots: choose hours, errors kept in the window, unregister', async ({
  page,
}) => {
  const event = await insertEvent('FREE');
  await insertFreeSlot(event.id, ['Marc', 'Dubois'], '10:00', '12:00');
  await signIn(page, member);
  await page.goto(`/events/${event.id}`);
  await expect(page.getByText('Choisis les heures où tu es disponible.')).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'Marc D.' })).toContainText(
    '11:00 – 13:00',
  );

  // S3: B9 opens prefilled with the event
  await page.getByRole('button', { name: 'Choisir mes horaires' }).click();
  const dialog = page.getByRole('dialog', { name: 'Choisir mes horaires' });
  await expect(dialog.getByText('Événement : 14 mars 09:00 → 18:00')).toBeVisible();
  await expect(dialog.getByLabel('Heure de début')).toHaveValue('09:00');
  await scan(page, 'B9 choisir mes horaires');

  // S5: too short, under the end, what was typed is kept
  await chooseHours(page, '10:00', '10:20');
  await expect(dialog.getByText('Un créneau libre dure au moins 30 minutes.')).toBeVisible();
  await expect(dialog.getByLabel('Heure de fin')).toHaveValue('10:20');
  await scan(page, 'B9 durée trop courte');

  await chooseHours(page, '10:00', '12:30');
  await expect(dialog).toHaveCount(0);
  const mine = page.getByRole('listitem').filter({ hasText: 'Léa B. (toi)' });
  await expect(mine).toContainText('10:00 – 12:30');
  await scan(page, 'B8 créneaux libres');

  // S9: an overlap with my own hours, in an alert at the top; the window keeps the values
  await page.getByRole('button', { name: 'Choisir mes horaires' }).click();
  await chooseHours(page, '11:00', '12:30');
  await expect(dialog.getByRole('alert')).toHaveText(
    'Tu as déjà des horaires qui recouvrent ceux-ci.',
  );
  await expect(dialog.getByLabel('Heure de début')).toHaveValue('11:00');
  await scan(page, 'B9 recouvrement');
  await dialog.getByRole('button', { name: 'Annuler' }).click();

  // S12: refusing keeps the row, confirming removes it
  await page.getByRole('button', { name: 'Me désinscrire, 10:00 – 12:30' }).click();
  const confirm = page.getByRole('dialog', { name: 'Te désinscrire ?' });
  await expect(confirm).toContainText('Tu ne seras plus inscrit(e) de 10:00 à 12:30.');
  await confirm.getByRole('button', { name: 'Annuler' }).click();
  await expect(mine).toHaveCount(1);
  await page.getByRole('button', { name: 'Me désinscrire, 10:00 – 12:30' }).click();
  await confirm.getByRole('button', { name: 'Me désinscrire' }).click();
  await expect(mine).toHaveCount(0);
  expect(await database.registration.count({ where: { eventId: event.id } })).toBe(1);
});

test('[F-22 S14, S15] both modes: proposed slots with their limit, and my own hours', async ({
  page,
}) => {
  const event = await insertEvent('BOTH', [{ capacity: 4 }]);
  await signIn(page, member);
  await page.goto(`/events/${event.id}`);
  await expect(page.getByRole('heading', { name: 'Créneaux proposés' })).toBeVisible();
  await expect(
    page.getByText('Inscris-toi sur un de ces créneaux, ou choisis tes propres horaires.'),
  ).toBeVisible();
  await expect(page.getByText('4 places restantes')).toBeVisible();
  await scan(page, 'B8 bis les deux modes');

  // Both kinds for the same person (RG-08: the overlap with a fixed slot is not checked)
  await page.getByRole('button', { name: "Je m'inscris au créneau 09:00 – 12:00" }).click();
  await expect(page.getByText('Inscrit', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Choisir mes horaires' }).click();
  await chooseHours(page, '10:00', '11:00');
  await expect(page.getByRole('listitem').filter({ hasText: 'Léa B. (toi)' }).last()).toContainText(
    '10:00 – 11:00',
  );
  // RG-19: the free slot does not take a place of the fixed slot
  await expect(page.getByRole('heading', { name: '09:00 – 12:00' })).toBeVisible();
  const slot = await database.slot.findFirstOrThrow({
    where: { eventId: event.id },
    include: { _count: { select: { registrations: true } } },
  });
  expect(slot._count.registrations).toBe(1);
});

test('[F-22 S16] RG-19: the mode changed while the window was open, the refusal is shown on the current page', async ({
  page,
}) => {
  const event = await insertEvent('BOTH', [{ capacity: 4 }]);
  await signIn(page, member);
  await page.goto(`/events/${event.id}`);
  await page.getByRole('button', { name: 'Choisir mes horaires' }).click();
  await database.event.update({ where: { id: event.id }, data: { registrationMode: 'FIXED' } });
  const dialog = await chooseHours(page, '10:00', '12:00');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('Cet événement ne propose pas de créneaux libres.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Choisir mes horaires' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Je m'inscris au créneau/ })).toBeVisible();
});

test('keyboard: hours are chosen and saved without a mouse', async ({ page }) => {
  const event = await insertEvent('FREE');
  await signIn(page, member);
  await page.goto(`/events/${event.id}`);
  await page.getByRole('button', { name: 'Choisir mes horaires' }).focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Choisir mes horaires' });
  await expect(dialog).toBeVisible();
  // The focus starts inside the window and stays there
  await expect(dialog.getByLabel('Date de début')).toBeFocused();
  await dialog.getByLabel('Heure de début').focus();
  await page.keyboard.type('1400');
  await dialog.getByLabel('Heure de fin').focus();
  await page.keyboard.type('1530');
  await dialog.getByRole('button', { name: 'Enregistrer' }).focus();
  await page.keyboard.press('Enter');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('listitem').filter({ hasText: 'Léa B. (toi)' })).toContainText(
    '14:00 – 15:30',
  );
});

test('[F-22 S19, S20] administrator follow-up: who is there and when, removal with confirmation', async ({
  page,
}) => {
  const event = await insertEvent('BOTH', [{ capacity: 4 }]);
  await insertFreeSlot(event.id, ['Nina', 'Petit'], '09:00', '10:00');
  await insertFreeSlot(event.id, ['Marc', 'Dubois'], '10:00', '12:00');
  await insertFreeSlot(event.id, ['Sofia', 'Thomas'], '13:00', '15:00');
  await signIn(page, installation.admin);
  await page.goto(`/events/${event.id}`);
  await expect(page.getByText('Mode : Les deux')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Créneaux (1)' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Créneaux libres · 3 inscrits' })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: /^(Nina|Marc|Sofia)/ })).toHaveText([
    /Nina P\..*10:00 – 11:00/,
    /Marc D\..*11:00 – 13:00/,
    /Sofia T\..*14:00 – 16:00/,
  ]);
  await scan(page, 'C2 créneaux libres (administrateur)');

  await page.getByRole('button', { name: 'Retirer Marc D., 11:00 – 13:00' }).click();
  const confirm = page.getByRole('dialog', { name: 'Retirer cet inscrit ?' });
  await expect(confirm).toContainText(
    'Marc D. ne sera plus inscrit(e) à ce créneau libre (11:00 – 13:00).',
  );
  await confirm.getByRole('button', { name: 'Retirer' }).click();
  await expect(page.getByRole('heading', { name: 'Créneaux libres · 2 inscrits' })).toBeVisible();
  await expect(page.getByText('Marc D.')).toHaveCount(0);
});

test('[F-22 S2] the administrator creates an event in free slots (C4)', async ({ page }) => {
  await signIn(page, installation.admin);
  await page.goto('/events/new');
  const modes = page.getByRole('group', { name: 'Inscriptions' });
  await expect(modes.getByRole('radio', { name: 'Créneaux fixes' })).toBeChecked();
  await scan(page, 'C4 inscriptions');
  await page.getByLabel('Titre').fill('Rando des crêtes');
  await page.getByLabel('Date de début').fill('2030-03-14');
  await page.getByLabel('Heure de début').fill('09:00');
  await page.getByLabel('Date de fin').fill('2030-03-14');
  await page.getByLabel('Heure de fin').fill('18:00');
  await modes.getByRole('radio', { name: 'Créneaux libres' }).check();
  await expect(page.getByRole('button', { name: '+ Ajouter un créneau' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('heading', { name: 'Rando des crêtes' })).toBeVisible();
  await expect(page.getByText('Mode : Créneaux libres')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Choisir mes horaires' })).toBeVisible();
  await expect(page.getByRole('button', { name: '+ Ajouter un créneau' })).toHaveCount(0);
});

test('[F-22 S17, S18] changing mode: forbidden options say why (C11), allowed ones keep the registrations', async ({
  page,
}) => {
  const event = await insertEvent('BOTH', [{ capacity: 4 }, { capacity: 2 }]);
  await insertFreeSlot(event.id, ['Nina', 'Petit'], '09:00', '10:00');
  await signIn(page, installation.admin);
  await page.goto(`/events/${event.id}/edit`);
  const modes = page.getByRole('group', { name: 'Inscriptions' });
  await expect(modes.getByRole('radio', { name: 'Les deux' })).toBeChecked();
  await expect(modes.getByRole('radio', { name: 'Créneaux libres' })).toBeDisabled();
  await expect(modes.getByText("Supprime d'abord les créneaux fixes (2).")).toBeVisible();
  await expect(modes.getByRole('radio', { name: 'Créneaux fixes' })).toBeDisabled();
  await expect(modes.getByText("Supprime d'abord les créneaux libres (1).")).toBeVisible();
  await scan(page, 'C11 changement de mode impossible');

  // Once the free slot is gone, « Créneaux fixes » is allowed and the fixed slots are untouched
  await database.registration.deleteMany({ where: { eventId: event.id } });
  await page.reload();
  await modes.getByRole('radio', { name: 'Créneaux fixes' }).check();
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page).toHaveURL(new RegExp(`/events/${event.id}$`));
  await expect(page.getByRole('heading', { name: 'Créneaux libres', exact: false })).toHaveCount(0);
  expect(
    (await database.event.findUniqueOrThrow({ where: { id: event.id } })).registrationMode,
  ).toBe('FIXED');
  expect(await database.slot.count({ where: { eventId: event.id } })).toBe(2);
});

test.describe('desktop, 1000 px', () => {
  test.use({ viewport: { width: 1000, height: 800 } });

  test('axe on the free slot screens', async ({ page }) => {
    const event = await insertEvent('BOTH', [{ capacity: 2 }]);
    await insertFreeSlot(event.id, ['Nina', 'Petit'], '09:00', '10:00');
    await signIn(page, member);
    await page.goto(`/events/${event.id}`);
    await expect(page.getByRole('heading', { name: 'Créneaux libres' })).toBeVisible();
    await scan(page, 'B8 bis (bureau)');
    await page.getByRole('button', { name: 'Choisir mes horaires' }).click();
    await chooseHours(page, '10:00', '10:10');
    await expect(page.getByText('Un créneau libre dure au moins 30 minutes.')).toBeVisible();
    await scan(page, 'B9 (bureau)');
  });
});
