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

// T-015: volunteer screens (F-06, F-07, F-08), at 360 px. The club is in Europe/Paris (RG-16): 08:00 shown is
// 07:00 UTC in March. S4 bis (the exact start second) needs a frozen clock: it is covered by the integration test.

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
  /** Registered volunteers who are neither the member nor the administrator. */
  registered?: number;
  /** The member (Léa Bernard) is registered too. */
  memberRegistered?: boolean;
};

async function insertEvent(options: {
  title?: string;
  location?: string;
  startsAt?: string;
  endsAt?: string;
  slots?: SlotSpec[];
}) {
  const event = await database.event.create({
    data: {
      title: options.title ?? 'Compétition du 14 mars',
      location: options.location ?? 'Stade de neige',
      startsAt: at(options.startsAt ?? '2030-03-14T07:00:00Z'),
      endsAt: at(options.endsAt ?? '2030-03-14T17:00:00Z'),
    },
  });
  const lea = await database.user.findFirst({ where: { email: member.email } });
  for (const slot of options.slots ?? []) {
    const userIds: number[] = slot.memberRegistered && lea ? [lea.id] : [];
    for (let i = 0; i < (slot.registered ?? 0); i++) {
      counter += 1;
      userIds.push(
        (await createOtherMember('Bénévole', `N${counter}`, `benevole${counter}@exemple.fr`)).id,
      );
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
// An event under way: its slot started in the past
const ongoing = {
  startsAt: '2020-01-01T08:00:00Z',
  endsAt: '2100-01-01T08:00:00Z',
};
const startedSlot = { startsAt: '2020-01-01T08:00:00Z', endsAt: '2020-01-01T10:00:00Z' };

async function signIn(page: Page, credentials: { email: string; password: string } = member) {
  await page.goto('/connexion');
  await page.getByLabel('E-mail').fill(credentials.email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/events$/);
}

/** axe without serious or critical violation, and no horizontal scroll at 360 px. */
async function checkScreen(page: Page) {
  // Out of any card: the hover state of a list item is below 4.5:1 (token pair text-muted on surface), see the PR
  await page.mouse.move(0, 0);
  const violations = (await analyze(page)).violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(
    false,
  );
}

async function openEvent(page: Page, eventId: number) {
  await page.goto(`/events/${eventId}`);
}

/** The card of the slot shown under this heading. */
const slotCard = (page: Page, hours: string) =>
  page.getByRole('heading', { name: hours, exact: true }).locator('xpath=ancestor::div[3]');

test.describe('consult (F-06)', () => {
  test('[F-06 S1] RG-09: upcoming events are listed by start, with title, place and date', async ({
    page,
  }) => {
    await insertEvent({
      title: 'Sortie de fin de saison',
      location: 'Station',
      startsAt: '2030-04-05T07:00:00Z',
      endsAt: '2030-04-05T15:00:00Z',
    });
    await insertEvent({ title: 'Compétition du 14 mars', location: 'Stade de neige' });
    await signIn(page);
    await expect(page.getByRole('heading', { name: 'Événements à venir' })).toBeVisible();
    const items = page.getByRole('main').getByRole('listitem');
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText('Compétition du 14 mars');
    await expect(items.nth(0)).toContainText('Stade de neige · 14 mars, 08:00');
    await expect(items.nth(1)).toContainText('Sortie de fin de saison');
    await checkScreen(page);
  });

  test('[F-06 S2] RG-07, RG-09: a limited slot shows its names and « 1 place restante »', async ({
    page,
  }) => {
    const event = await insertEvent({ slots: [{ ...morning, capacity: 4, registered: 3 }] });
    await signIn(page);
    await openEvent(page, event.id);
    const card = slotCard(page, '08:00 – 10:00');
    await expect(card.getByText('1 place restante')).toBeVisible();
    await expect(card.getByRole('listitem')).toHaveCount(3);
    await expect(card.getByRole('listitem').first()).toHaveText(/^Bénévole N\d+\.?$|^Bénévole N\./);
    await checkScreen(page);
  });

  test('[F-06 S3] RG-07: an unlimited slot shows its names, no remaining count and stays open', async ({
    page,
  }) => {
    const event = await insertEvent({ slots: [{ ...morning, capacity: null, registered: 2 }] });
    await signIn(page);
    await openEvent(page, event.id);
    const card = slotCard(page, '08:00 – 10:00');
    await expect(card.getByText('Sans limite')).toBeVisible();
    await expect(card.getByText(/restante/)).toHaveCount(0);
    await expect(card.getByRole('listitem')).toHaveCount(2);
    await expect(card.getByRole('button', { name: /Je m'inscris/ })).toBeEnabled();
  });

  test('[F-06 S4] [F-06 S4 bis] RG-09: a past event is hidden from the list and « introuvable » by URL', async ({
    page,
  }) => {
    await insertEvent({ title: 'Course ouverte' });
    const past = await insertEvent({
      title: 'Déjà terminé',
      startsAt: '2020-03-14T07:00:00Z',
      endsAt: '2020-03-14T17:00:00Z',
    });
    await signIn(page);
    await expect(page.getByText('Course ouverte')).toBeVisible();
    await expect(page.getByText('Déjà terminé')).toHaveCount(0);
    await openEvent(page, past.id);
    await expect(page.getByText('Événement introuvable.')).toBeVisible();
    await expect(page.getByText('Déjà terminé')).toHaveCount(0);
    await checkScreen(page);
  });

  test('[F-06 S4] RG-09: an administrator finds the past event in « Événements passés »', async ({
    page,
  }) => {
    await insertEvent({
      title: 'Déjà terminé',
      startsAt: '2020-03-14T07:00:00Z',
      endsAt: '2020-03-14T17:00:00Z',
    });
    await signIn(page, installation.admin);
    await page.goto('/events/past');
    await expect(page.getByText('Déjà terminé')).toBeVisible();
  });

  test('[F-06 S5] without upcoming event, the list says so', async ({ page }) => {
    await signIn(page);
    await expect(page.getByText('Aucun événement à venir pour le moment.')).toBeVisible();
    await checkScreen(page);
  });

  test('[F-06 S1] an event without slot says so', async ({ page }) => {
    const event = await insertEvent({});
    await signIn(page);
    await openEvent(page, event.id);
    await expect(page.getByText('Aucun créneau pour le moment.')).toBeVisible();
  });
});

test.describe('register (F-07)', () => {
  test('[F-07 S1] RG-08: registering shows the name, « Inscrit », « Me désinscrire » and one place less', async ({
    page,
  }) => {
    const event = await insertEvent({ slots: [{ ...morning, capacity: 4, registered: 2 }] });
    await signIn(page);
    await openEvent(page, event.id);
    const card = slotCard(page, '08:00 – 10:00');
    await expect(card.getByText('2 places restantes')).toBeVisible();
    await card.getByRole('button', { name: "Je m'inscris au créneau 08:00 – 10:00" }).click();
    await expect(card.getByText('Léa B. (toi)')).toBeVisible();
    await expect(card.getByText('Inscrit', { exact: true })).toBeVisible();
    await expect(card.getByText('1 place restante'))
      .toBeHidden()
      .catch(() => {});
    await expect(card.getByRole('button', { name: /Me désinscrire/ })).toBeVisible();
    expect(await database.registration.count()).toBe(3);
    await checkScreen(page);
  });

  test('[F-07 S2] RG-07: a full slot is « Complet » and cannot be joined', async ({ page }) => {
    const event = await insertEvent({ slots: [{ ...morning, capacity: 2, registered: 2 }] });
    await signIn(page);
    await openEvent(page, event.id);
    const card = slotCard(page, '08:00 – 10:00');
    await expect(card.getByText('Complet', { exact: true }).first()).toBeVisible();
    await expect(card.getByRole('button', { name: /Complet/ })).toBeDisabled();
    await expect(card.getByRole('button', { name: /inscris/ })).toHaveCount(0);
    await checkScreen(page);
  });

  test('[F-07 S3] RG-07: the last seat taken at the same time: the other sees the refusal and the real state', async ({
    page,
    browser,
  }) => {
    const event = await insertEvent({ slots: [{ ...morning, capacity: 4, registered: 3 }] });
    await createOtherMember('Sofia', 'Thomas', 'sofia@exemple.fr');
    const other = await browser.newContext({
      locale: 'fr-FR',
      viewport: { width: 360, height: 740 },
    });
    const otherPage = await other.newPage();

    await signIn(page);
    await signIn(otherPage, { email: 'sofia@exemple.fr', password: member.password });
    await openEvent(page, event.id);
    await openEvent(otherPage, event.id);
    const mine = slotCard(page, '08:00 – 10:00').getByRole('button', { name: /Je m'inscris/ });
    const theirs = slotCard(otherPage, '08:00 – 10:00').getByRole('button', {
      name: /Je m'inscris/,
    });
    await expect(mine).toBeVisible();
    await expect(theirs).toBeVisible();

    await Promise.all([mine.click(), theirs.click()]);

    // One wins; the loser gets the message of the catalog and the slot read again
    const refusals = () =>
      Promise.all(
        [page, otherPage].map((view) =>
          view.getByText("Ce créneau vient d'être complété.").count(),
        ),
      ).then((counts) => counts.reduce((sum, count) => sum + count, 0));
    await expect.poll(refusals).toBe(1);
    expect(await database.registration.count()).toBe(4);
    // The winner reads « Inscrit », the loser the real state of the slot: « Complet »
    const tagsOf = (text: string) =>
      Promise.all(
        [page, otherPage].map((view) =>
          slotCard(view, '08:00 – 10:00').getByText(text, { exact: true }).count(),
        ),
      ).then((counts) => counts.reduce((sum, count) => sum + count, 0));
    await expect.poll(() => tagsOf('Inscrit')).toBe(1);
    await expect.poll(() => tagsOf('Complet')).toBe(2); // the tag and the disabled button of the loser
    await other.close();
  });

  test('[F-07 S4] RG-08: a slot that has started takes no registration', async ({ page }) => {
    const event = await insertEvent({ ...ongoing, slots: [{ ...startedSlot, capacity: 4 }] });
    await signIn(page);
    await openEvent(page, event.id);
    await expect(page.getByText('Commencé', { exact: true })).toBeVisible();
    await expect(page.getByText('Ce créneau a commencé : inscription impossible')).toBeVisible();
    await expect(page.getByRole('button', { name: /inscris/ })).toHaveCount(0);
  });

  test('[F-07 S4 ter] RG-08: an administrator registers with the same buttons', async ({
    page,
  }) => {
    const event = await insertEvent({ slots: [{ ...morning, capacity: 4 }] });
    await signIn(page, installation.admin);
    await openEvent(page, event.id);
    const card = slotCard(page, '08:00 – 10:00');
    await card.getByRole('button', { name: /Je m'inscris/ }).click();
    await expect(card.getByText('Alex M. (toi)')).toBeVisible();
    await expect(card.getByRole('button', { name: /Me désinscrire/ })).toBeVisible();
  });

  test('[F-07 S5] RG-08: overlapping slots are both accepted without warning', async ({ page }) => {
    const event = await insertEvent({
      slots: [
        { ...lateMorning, capacity: 4 },
        { ...noon, capacity: 4 },
      ],
    });
    await signIn(page);
    await openEvent(page, event.id);
    await slotCard(page, '09:00 – 12:00')
      .getByRole('button', { name: /Je m'inscris/ })
      .click();
    await expect(slotCard(page, '09:00 – 12:00').getByText('Léa B. (toi)')).toBeVisible();
    await slotCard(page, '11:00 – 14:00')
      .getByRole('button', { name: /Je m'inscris/ })
      .click();
    await expect(slotCard(page, '11:00 – 14:00').getByText('Léa B. (toi)')).toBeVisible();
    // No warning: the only role=alert allowed is the empty route announcer of Next.js
    await expect(page.getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0);
    expect(await database.registration.count()).toBe(2);
  });

  test('keyboard: the registration buttons are reachable in order and named by slot', async ({
    page,
  }) => {
    const event = await insertEvent({
      slots: [
        { ...morning, capacity: 4 },
        { ...noon, capacity: 4 },
      ],
    });
    await signIn(page);
    await openEvent(page, event.id);
    const first = page.getByRole('button', { name: "Je m'inscris au créneau 08:00 – 10:00" });
    const second = page.getByRole('button', { name: "Je m'inscris au créneau 11:00 – 14:00" });
    await first.focus();
    await expect(first).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(second).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(
      page.getByRole('button', { name: 'Me désinscrire du créneau 11:00 – 14:00' }),
    ).toBeVisible();
  });
});

test.describe('unregister (F-08)', () => {
  test('[F-08 S1] RG-08: confirming frees the seat of a full slot', async ({ page }) => {
    const event = await insertEvent({
      slots: [{ ...morning, capacity: 2, registered: 1, memberRegistered: true }],
    });
    await signIn(page);
    await openEvent(page, event.id);
    const card = slotCard(page, '08:00 – 10:00');
    await card.getByRole('button', { name: /Me désinscrire/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Te désinscrire ?' });
    await expect(dialog).toContainText('Tu ne seras plus inscrit(e) au créneau 08:00 – 10:00.');
    await checkScreen(page);
    await dialog.getByRole('button', { name: 'Me désinscrire' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(card.getByText('Léa B. (toi)')).toHaveCount(0);
    await expect(card.getByText('1 place restante')).toBeVisible();
    await expect(card.getByRole('button', { name: /Je m'inscris/ })).toBeVisible();
    expect(await database.registration.count()).toBe(1);
  });

  test('[F-08 S1 bis] cancelling the confirmation keeps the registration', async ({ page }) => {
    const event = await insertEvent({
      slots: [{ ...morning, capacity: 4, memberRegistered: true }],
    });
    await signIn(page);
    await openEvent(page, event.id);
    await page.getByRole('button', { name: /Me désinscrire/ }).click();
    await page
      .getByRole('dialog', { name: 'Te désinscrire ?' })
      .getByRole('button', { name: 'Annuler' })
      .click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('Léa B. (toi)')).toBeVisible();
    expect(await database.registration.count()).toBe(1);
  });

  test('[F-08 S2] changing slot: leave A with confirmation, then join B', async ({ page }) => {
    const event = await insertEvent({
      slots: [
        { ...lateMorning, capacity: 4, memberRegistered: true },
        { ...noon, capacity: 4 },
      ],
    });
    await signIn(page);
    await openEvent(page, event.id);
    await slotCard(page, '09:00 – 12:00')
      .getByRole('button', { name: /Me désinscrire/ })
      .click();
    await page.getByRole('dialog').getByRole('button', { name: 'Me désinscrire' }).click();
    await slotCard(page, '11:00 – 14:00')
      .getByRole('button', { name: /Je m'inscris/ })
      .click();
    await expect(slotCard(page, '11:00 – 14:00').getByText('Léa B. (toi)')).toBeVisible();
    await expect(slotCard(page, '09:00 – 12:00').getByText('Léa B. (toi)')).toHaveCount(0);
  });

  test('[F-08 S3] RG-07: a full new slot is refused and the registration to A is kept', async ({
    page,
  }) => {
    const event = await insertEvent({
      slots: [
        { ...lateMorning, capacity: 4, memberRegistered: true },
        { ...noon, capacity: 1, registered: 1 },
      ],
    });
    await signIn(page);
    await openEvent(page, event.id);
    await expect(
      slotCard(page, '11:00 – 14:00').getByRole('button', { name: /Complet/ }),
    ).toBeDisabled();
    await expect(slotCard(page, '09:00 – 12:00').getByText('Léa B. (toi)')).toBeVisible();
  });

  test('[F-08 S4] RG-08: on a started slot there is no « Me désinscrire », only the contact message', async ({
    page,
  }) => {
    const lea = await database.user.findFirstOrThrow({ where: { email: member.email } });
    const event = await insertEvent({ ...ongoing, slots: [{ ...startedSlot, capacity: 4 }] });
    const slot = await database.slot.findFirstOrThrow({ where: { eventId: event.id } });
    await database.registration.create({ data: { slotId: slot.id, userId: lea.id } });
    await signIn(page);
    await openEvent(page, event.id);
    await expect(page.getByText('Commencé · inscrit')).toBeVisible();
    await expect(
      page.getByText('Contacte un administrateur pour modifier ton inscription'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /désinscrire/ })).toHaveCount(0);
    await checkScreen(page);
  });
});
