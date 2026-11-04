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

// security.md, section 4 (#80): the application sets its own Content-Security-Policy, with a nonce per page.
test.describe.configure({ mode: 'serial' });
test.afterAll(() => database.$disconnect());
test.beforeEach(async ({ request, baseURL }, testInfo) => {
  await resetInstance();
  await installInstance(request, baseURL!, addressOf(testInfo));
});

/** Collects the policy violations the browser reports on every page of the test. */
async function watchViolations(page: Page): Promise<string[]> {
  const violations: string[] = [];
  await page.exposeFunction('reportViolation', (directive: string) => violations.push(directive));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) =>
      (window as unknown as { reportViolation: (d: string) => void }).reportViolation(
        `${event.violatedDirective} ${event.blockedURI}`,
      ),
    );
  });
  return violations;
}

test('a page has a policy whose scripts need a nonce, never unsafe-inline', async ({ page }) => {
  const response = await page.goto('/connexion');
  const policy = response!.headers()['content-security-policy'] ?? '';
  const scripts = policy.split('; ').find((d) => d.startsWith('script-src')) ?? '';
  expect(scripts).toMatch(/'nonce-[^']+'/);
  expect(scripts).not.toContain('unsafe-inline');
  expect(policy).toContain("frame-ancestors 'none'");

  const again = await page.goto('/connexion');
  expect(again!.headers()['content-security-policy']).not.toBe(policy);
});

test('the pages work under the policy: signing in and opening the events, without violation', async ({
  page,
}) => {
  const violations = await watchViolations(page);
  await page.goto('/connexion');
  await page.getByLabel('E-mail').fill(installation.admin.email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(installation.admin.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  // The client-side navigation needs the scripts the policy lets through
  await expect(page).toHaveURL(/\/events$/);
  await page.getByRole('button', { name: 'Créer un événement' }).click();
  await expect(page).toHaveURL(/\/events\/new$/);
  expect(violations).toEqual([]);
});

test('an inline event handler injected into the page is blocked', async ({ page }) => {
  const violations = await watchViolations(page);
  await page.goto('/connexion');
  // The markup an XSS would slip into the page: an inline handler, not covered by the nonce
  await page.evaluate(() => {
    const holder = document.createElement('div');
    holder.innerHTML = '<img src="/nothing-here.png" onerror="window.__injected = true">';
    document.body.append(holder);
  });
  await expect.poll(() => violations.length).toBeGreaterThan(0);
  expect(
    await page.evaluate(() => (window as { __injected?: boolean }).__injected),
  ).toBeUndefined();
});
