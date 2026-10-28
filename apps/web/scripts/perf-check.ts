// T-023: simple measurement of the non-functional requirements of architecture.md, section 2, on a running instance.
// Usage: BASE_URL=http://localhost:3200 DATABASE_URL=… pnpm exec tsx scripts/perf-check.ts
// The instance must be new (not installed): the script installs it, creates 20 volunteers, then measures.
import { hash } from '@node-rs/argon2';
import { PrismaClient } from '@prisma/client';
import { chromium } from '@playwright/test';

const base = process.env.BASE_URL ?? 'http://localhost:3200';
const prisma = new PrismaClient();
const USERS = 20; // architecture.md, section 2: 20 simultaneous users
const CAPACITY = 15;

const password = '9876543210';
const admin = { email: 'admin@exemple.fr', password: '0123456789' };

const percentile = (values: number[], p: number) =>
  [...values].sort((a, b) => a - b)[
    Math.min(values.length - 1, Math.ceil((p / 100) * values.length) - 1)
  ]!;

/** One call as a client behind the proxy: its own address (rate limits are per address), its own cookie. */
async function call(
  method: string,
  path: string,
  address: string,
  cookie?: string,
  body?: unknown,
) {
  const started = performance.now();
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      origin: base,
      'x-forwarded-for': address,
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const durationMs = performance.now() - started;
  const text = await response.text();
  return { status: response.status, durationMs, response, json: text ? JSON.parse(text) : null };
}

async function login(email: string, pw: string, address: string) {
  const result = await call('POST', '/api/auth/login', address, undefined, { email, password: pw });
  if (result.status !== 200) throw new Error(`login ${result.status}`);
  return result.response.headers.getSetCookie()[0]!.split(';')[0]!;
}

function report(name: string, durations: number[]) {
  const row = {
    n: durations.length,
    p50: Math.round(percentile(durations, 50)),
    p95: Math.round(percentile(durations, 95)),
    max: Math.round(Math.max(...durations)),
  };
  console.log(`${name}: n=${row.n} p50=${row.p50} ms p95=${row.p95} ms max=${row.max} ms`);
  return row;
}

const setup = await call('POST', '/api/setup', '10.99.0.1', undefined, {
  club: { name: 'Ski Club des Arcs', timezone: 'Europe/Paris' },
  admin: { firstName: 'Alex', lastName: 'Martin', ...admin },
});
if (setup.status !== 201) throw new Error(`setup ${setup.status}: instance already installed?`);

const passwordHash = await hash(password);
const users = [];
for (let i = 1; i <= USERS; i++) {
  users.push(
    await prisma.user.create({
      data: {
        firstName: `Bénévole${i}`,
        lastName: 'Test',
        email: `perf${i}@exemple.fr`,
        passwordHash,
        role: 'USER',
      },
    }),
  );
}
const event = await prisma.event.create({
  data: {
    title: 'Mesure',
    startsAt: new Date('2030-01-15T07:00:00Z'),
    endsAt: new Date('2030-01-15T17:00:00Z'),
  },
});
const slot = await prisma.slot.create({
  data: {
    eventId: event.id,
    startsAt: new Date('2030-01-15T07:00:00Z'),
    endsAt: new Date('2030-01-15T09:00:00Z'),
    capacity: CAPACITY,
  },
});

console.log(`# ${USERS} simultaneous users on ${base}`);
const addressOf = (i: number) => `10.99.1.${i}`;

const cookies = await Promise.all(users.map((u, i) => login(u.email, password, addressOf(i + 1))));

// Load test: all registrations at once on a slot limited to CAPACITY (RG-07: never more than CAPACITY)
const registrations = await Promise.all(
  cookies.map((cookie, i) =>
    call('POST', `/api/slots/${slot.id}/registrations`, addressOf(i + 1), cookie),
  ),
);
const created = registrations.filter((r) => r.status === 201).length;
const full = registrations.filter((r) => r.status === 409).length;
const stored = await prisma.registration.count({ where: { slotId: slot.id } });
console.log(`registrations: ${created} created, ${full} refused (full), ${stored} stored`);
const registration = report(
  'POST registration',
  registrations.map((r) => r.durationMs),
);

// Reading load: each user opens the event list, then the event, 10 times
const reads = (
  await Promise.all(
    cookies.map(async (cookie, i) => {
      const out: number[] = [];
      for (let round = 0; round < 10; round++) {
        out.push((await call('GET', '/api/events', addressOf(i + 1), cookie)).durationMs);
        out.push(
          (await call('GET', `/api/events/${event.id}`, addressOf(i + 1), cookie)).durationMs,
        );
      }
      return out;
    }),
  )
).flat();
report('GET events', reads);

const all = [...registrations.map((r) => r.durationMs), ...reads];
const overall = report('all requests (without login)', all);

// LCP on a phone profile: 360 px, 4 times slower CPU, "slow 4G" (1.6 Mbit/s, 150 ms), cold cache
const browser = await chromium.launch();
const lcps: Record<string, number> = {};
for (const [name, path, signedIn] of [
  ['login page', '/connexion', false],
  ['event list', '/events', true],
  ['event detail', `/events/${event.id}`, true],
] as const) {
  const context = await browser.newContext({
    viewport: { width: 360, height: 740 },
    deviceScaleFactor: 2,
    isMobile: true,
    locale: 'fr-FR',
    extraHTTPHeaders: { 'x-forwarded-for': '10.99.2.1' },
  });
  const page = await context.newPage();
  if (signedIn) {
    // Signed in through the form, before the network is slowed down: only the page under test is measured
    await page.goto(`${base}/connexion`);
    await page.getByLabel('E-mail').fill(users[0]!.email);
    await page.getByLabel('Mot de passe', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await page.waitForURL(/\/events$/);
  }
  const client = await context.newCDPSession(page);
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.addInitScript(() => {
    (window as unknown as { __lcp: number }).__lcp = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        (window as unknown as { __lcp: number }).__lcp = entry.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  });
  await page.goto(`${base}${path}`, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  lcps[name] = Math.round(
    await page.evaluate(() => (window as unknown as { __lcp: number }).__lcp),
  );
  console.log(`LCP ${name}: ${lcps[name]} ms`);
  await context.close();
}
await browser.close();

console.log('# verdict');
const ok = (label: string, pass: boolean) => console.log(`${pass ? 'OK  ' : 'FAIL'} ${label}`);
ok('RG-07: created never above the limit', created === CAPACITY && stored === CAPACITY);
ok('95 % of requests under 1000 ms', overall.p95 < 1000);
ok('registration under 500 ms (p95)', registration.p95 < 500);
ok(
  'LCP under 2500 ms on every page',
  Object.values(lcps).every((v) => v < 2500),
);
await prisma.$disconnect();
