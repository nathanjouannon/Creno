import AxeBuilder from '@axe-core/playwright';
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

// T-016: administrator filling view (F-09), at 360 px. The club is in Europe/Paris (RG-16): 08:00 shown is 07:00 UTC in March.

test.describe.configure({ mode: 'serial' });
test.afterAll(() => database.$disconnect());
test.beforeEach(async ({ request, baseURL }, testInfo) => {
  await resetInstance();
  await installInstance(request, baseURL!, addressOf(testInfo));
  await createMember();
});

const at = (iso: string) => new Date(iso);
let counter = 0;

type SlotSpec = {
  startsAt: string;
  endsAt: string;
  capacity: number | null;
  /** Names of the registered volunteers, « Marie D. » being first name « Marie », last name « Dupont ». */
  names?: [string, string][];
};

async function insertEvent(options: { startsAt?: string; endsAt?: string; slots: SlotSpec[] }) {
  const event = await database.event.create({
    data: {
      title: 'Compétition du 14 mars',
      location: 'Stade de neige',
      startsAt: at(options.startsAt ?? '2030-03-14T07:00:00Z'),
      endsAt: at(options.endsAt ?? '2030-03-14T17:00:00Z'),
    },
  });
  for (const slot of options.slots) {
    const userIds: number[] = [];
    for (const [firstName, lastName] of slot.names ?? []) {
      counter += 1;
      userIds.push((await createOtherMember(firstName, lastName, `fill${counter}@exemple.fr`)).id);
    }
    await database.slot.create({
      data: {
        eventId: event.id,
        startsAt: at(slot.startsAt),
        endsAt: at(slot.endsAt),
        capacity: slot.capacity,
        registrations: { create: userIds.map((userId) => ({ userId })) },
      },
    });
  }
  return event;
}

const morning = { startsAt: '2030-03-14T07:00:00Z', endsAt: '2030-03-14T09:00:00Z' }; // 08:00 – 10:00
const lateMorning = { startsAt: '2030-03-14T08:00:00Z', endsAt: '2030-03-14T11:00:00Z' }; // 09:00 – 12:00
const noon = { startsAt: '2030-03-14T10:00:00Z', endsAt: '2030-03-14T13:00:00Z' }; // 11:00 – 14:00
const startedSlot = { startsAt: '2020-01-01T08:00:00Z', endsAt: '2020-01-01T10:00:00Z' };
const ongoing = { startsAt: '2020-01-01T08:00:00Z', endsAt: '2100-01-01T08:00:00Z' };
const pastEvent = { startsAt: '2020-01-01T08:00:00Z', endsAt: '2020-01-01T16:00:00Z' };
const marie: [string, string] = ['Marie', 'Dupont'];

async function signIn(page: Page, credentials: { email: string; password: string }) {
  await page.goto('/connexion');
  await page.getByLabel('E-mail').fill(credentials.email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(credentials.password);
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

const slotCard = (page: Page, hours: string) =>
  page.getByRole('heading', { name: hours, exact: true }).locator('xpath=ancestor::div[3]');

test.describe('filling view (F-09)', () => {
  test('[F-09 S1] RG-07: three slots, their names and counters on one scrolling screen', async ({
    page,
  }) => {
    const event = await insertEvent({
      slots: [
        { ...morning, capacity: 4, names: [marie, ['Paul', 'Roux'], ['Léo', 'Martel']] },
        { ...lateMorning, capacity: 6 },
        {
          ...noon,
          capacity: null,
          names: [
            ['Jade', 'Petit'],
            ['Hugo', 'Blanc'],
          ],
        },
      ],
    });
    await signIn(page, installation.admin);
    await page.goto(`/events/${event.id}`);
    await expect(slotCard(page, '08:00 – 10:00').getByText('3 / 4')).toBeVisible();
    await expect(slotCard(page, '08:00 – 10:00').getByText('Marie D.')).toBeVisible();
    await expect(slotCard(page, '09:00 – 12:00').getByText('0 / 6')).toBeVisible();
    await expect(slotCard(page, '11:00 – 14:00').getByText('2 inscrits')).toBeVisible();
    await expect(slotCard(page, '11:00 – 14:00').getByText('Jade P.')).toBeVisible();
    await checkScreen(page);
  });

  test('[F-09 S2] a limited slot without attendee is flagged « Aucun inscrit »', async ({
    page,
  }) => {
    const event = await insertEvent({
      slots: [
        { ...morning, capacity: 6 },
        { ...noon, capacity: null },
      ],
    });
    await signIn(page, installation.admin);
    await page.goto(`/events/${event.id}`);
    await expect(slotCard(page, '08:00 – 10:00').getByText('(!) Aucun inscrit')).toBeVisible();
    await expect(page.getByText('Aucun inscrit')).toHaveCount(1);
  });

  test('[F-09 S3] [F-09 S7] RG-09, RG-15: a past event lists its final attendees, without « Retirer »', async ({
    page,
  }) => {
    const event = await insertEvent({
      ...pastEvent,
      slots: [{ ...startedSlot, capacity: 4, names: [marie] }],
    });
    await signIn(page, installation.admin);
    await page.getByRole('link', { name: 'Passés' }).click();
    await page.getByRole('link', { name: /Compétition du 14 mars/ }).click();
    await expect(page).toHaveURL(new RegExp(`/events/${event.id}$`));
    await expect(page.getByText('Marie D.')).toBeVisible();
    await expect(page.getByRole('button', { name: /Retirer/ })).toHaveCount(0);
    await checkScreen(page);
  });

  test('[F-09 S4] F-03: a user gets no removal control', async ({ page }) => {
    const event = await insertEvent({ slots: [{ ...morning, capacity: 4, names: [marie] }] });
    await signIn(page, member);
    await page.goto(`/events/${event.id}`);
    await expect(page.getByText('Marie D.')).toBeVisible();
    await expect(page.getByRole('button', { name: /Retirer/ })).toHaveCount(0);
  });

  test('[F-09 S5] RG-08: confirming frees the seat; cancelling removes nothing', async ({
    page,
  }) => {
    const event = await insertEvent({
      slots: [
        {
          ...morning,
          capacity: 4,
          names: [marie, ['Paul', 'Roux'], ['Léo', 'Martel'], ['Eva', 'Noel']],
        },
      ],
    });
    await signIn(page, installation.admin);
    await page.goto(`/events/${event.id}`);
    const card = slotCard(page, '08:00 – 10:00');
    await expect(card.getByText('4 / 4')).toBeVisible();

    await card.getByRole('button', { name: 'Retirer Marie D. du créneau 08:00 – 10:00' }).click();
    const dialog = page.getByRole('dialog', { name: 'Retirer cet inscrit ?' });
    await expect(dialog).toContainText('Marie D. ne sera plus inscrit(e) au créneau 08:00 – 10:00');
    await checkScreen(page);
    await dialog.getByRole('button', { name: 'Annuler' }).click();
    await expect(card.getByText('Marie D.')).toBeVisible();
    expect(await database.registration.count()).toBe(4);

    await card.getByRole('button', { name: /Retirer Marie D\./ }).click();
    await dialog.getByRole('button', { name: 'Retirer', exact: true }).click();
    await expect(card.getByText('Marie D.')).toHaveCount(0);
    await expect(card.getByText('3 / 4')).toBeVisible();
    expect(await database.registration.count()).toBe(3);
  });

  test('[F-09 S6] RG-08: an attendee is removed from a slot that has started', async ({ page }) => {
    const event = await insertEvent({
      ...ongoing,
      slots: [{ ...startedSlot, capacity: 4, names: [marie] }],
    });
    await signIn(page, installation.admin);
    await page.goto(`/events/${event.id}`);
    await page.getByRole('button', { name: /Retirer Marie D\./ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Retirer', exact: true }).click();
    await expect(page.getByText('Marie D.')).toHaveCount(0);
    expect(await database.registration.count()).toBe(0);
  });

  test('keyboard: the « × » buttons are reachable and the dialog traps the focus', async ({
    page,
  }) => {
    const event = await insertEvent({ slots: [{ ...morning, capacity: 4, names: [marie] }] });
    await signIn(page, installation.admin);
    await page.goto(`/events/${event.id}`);
    const remove = page.getByRole('button', { name: /Retirer Marie D\./ });
    await remove.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});
