// Local-only browser regression. All backend requests are intercepted; no real
// users, subscriptions, email, or race data are read or changed.
// ONLYFAST_PLAYWRIGHT_MODULE may point to an external Playwright installation.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const base = process.env.ONLYFAST_WEBSITE_URL || 'http://127.0.0.1:8080';
assert.ok(
  ['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname),
  'Run this harness against a local preview only',
);
const { chromium } = await import(
  process.env.ONLYFAST_PLAYWRIGHT_MODULE
    ? pathToFileURL(path.resolve(process.env.ONLYFAST_PLAYWRIGHT_MODULE)).href
    : 'playwright'
);
const output = path.resolve('tmp/public-website');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
const user = {
  id: '00000000-0000-4000-8000-000000000088',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'local-preview@example.invalid',
  app_metadata: { provider: 'email' },
  user_metadata: { nickname: 'Preview Racer' },
  created_at: '2026-01-01T00:00:00Z',
};
const jwt = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })).toString('base64url')}.local-preview-fixture`;
const session = {
  access_token: jwt,
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'local-preview-only',
  user,
};
async function fixture({
  authenticated = false,
  expired = false,
  viewport = { width: 1440, height: 1000 },
  userAgent,
} = {}) {
  const context = await browser.newContext({ viewport, userAgent, reducedMotion: 'reduce' });
  const requests = [];
  const errors = [];
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(base).origin) return route.continue();
    if (url.hostname.endsWith('.supabase.co')) {
      requests.push({ path: url.pathname, method: route.request().method() });
      let data = [];
      if (url.pathname.includes('/auth/v1/token')) data = session;
      else if (url.pathname.includes('/auth/v1/user')) data = user;
      else if (url.pathname.includes('/auth/v1/logout')) data = {};
      else if (url.pathname.includes('/auth/v1/recover')) data = {};
      else if (url.pathname.includes('/rpc/get_active_race_class_state'))
        data = {
          active_class: 'Winged Sprint Cars',
          tier: 'rookie',
          can_change: true,
          unlimited: false,
          active_discipline: 'dirt_oval',
          onboarding_step: 'complete',
        };
      else if (route.request().headers().accept?.includes('vnd.pgrst.object')) data = null;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(data),
      });
    }
    // External fonts/images/analytics cannot delay or mutate this isolated run.
    return route.abort();
  });
  await context.addInitScript(
    ({ authenticated, session, storageKey }) => {
      localStorage.setItem('onlyfast_cookie_consent', 'declined');
      // Seed once so reload and signout checks exercise actual SDK persistence.
      if (authenticated && !sessionStorage.getItem('onlyfast_qa_auth_seeded')) {
        if (!localStorage.getItem(storageKey)) localStorage.setItem(storageKey, JSON.stringify(session));
        sessionStorage.setItem('onlyfast_qa_auth_seeded', 'true');
      }
    },
    { authenticated, session: expired ? { ...session, expires_at: Math.floor(Date.now() / 1000) - 60 } : session,
      storageKey: 'sb-thpyjvwtfvfxiufchrxn-auth-token' },
  );
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (error) => errors.push(error.message));
  return { context, page, requests, errors };
}
async function go(page, pathname = '/') {
  await page.goto(`${base}${pathname}`, { waitUntil: 'domcontentloaded' });
}
async function test(name, run) {
  try {
    await run();
    results.push({ name, status: 'passed' });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, status: 'failed', error: error.message });
    console.error(`FAIL ${name}: ${error.message}`);
  }
}
const hero = (page) => page.locator('#of-hero-title');
const dialog = (page) => page.getByRole('dialog', { name: 'Sign In', exact: true });
try {
  await test('desktop homepage, SEO, store links, features and screenshot', async () => {
    const { page, context, errors, requests } = await fixture();
    await go(page);
    await hero(page).waitFor();
    assert.equal(await page.title(), 'OnlyFast | Race Smarter. Finish Faster.');
    assert.equal(
      await page.locator('link[rel=canonical]').getAttribute('href'),
      'https://onlyfast.app/',
    );
    assert.equal(await page.locator('meta[name=robots]').getAttribute('content'), 'index, follow');
    assert.equal(await page.locator('.of-feature').count(), 4);
    assert.equal(await page.locator('.of-plan').count(), 3);
    assert.equal(
      await page
        .getByRole('link', { name: 'Download OnlyFast on the Apple App Store' })
        .getAttribute('href'),
      'https://apps.apple.com/us/app/onlyfast/id6792149373',
    );
    assert.equal(
      await page.getByRole('link', { name: 'Get OnlyFast on Google Play' }).getAttribute('href'),
      'https://play.google.com/store/apps/details?id=app.onlyfast',
    );
    await page.locator('#download').scrollIntoViewIfNeeded();
    await page
      .locator('.of-store-badges img')
      .evaluateAll((images) => Promise.all(images.map((img) => img.decode())));
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(output, 'desktop.png'), fullPage: true });
    await page.screenshot({ path: path.join(output, 'desktop-hero.png') });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    assert.deepEqual(errors, []);
    assert.equal(requests.filter((request) => request.method !== 'GET').length, 0);
    await context.close();
  });
  await test('mobile homepage, menu keyboard handling, anchors and screenshots', async () => {
    const { page, context, errors } = await fixture({
      viewport: { width: 390, height: 844 },
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1',
    });
    await go(page);
    await hero(page).waitFor();
    await page.getByRole('button', { name: 'Open navigation' }).click();
    assert.equal(
      await page.getByRole('navigation', { name: 'Mobile navigation' }).isVisible(),
      true,
    );
    await page.keyboard.press('Escape');
    assert.equal(
      await page.getByRole('button', { name: 'Open navigation' }).getAttribute('aria-expanded'),
      'false',
    );
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await page
      .getByRole('navigation', { name: 'Mobile navigation' })
      .getByRole('link', { name: 'Pricing' })
      .click();
    assert.ok(page.url().endsWith('#pricing'));
    assert.equal(await page.locator('#of-mobile-navigation').count(), 0);
    await page.locator('#download').scrollIntoViewIfNeeded();
    await page
      .locator('.of-store-badges img')
      .evaluateAll((images) => Promise.all(images.map((img) => img.decode())));
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(output, 'mobile.png'), fullPage: true });
    await page.screenshot({ path: path.join(output, 'mobile-hero.png') });
    for (const width of [320, 390, 768, 1024]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
        `overflow at ${width}`,
      );
    }
    assert.deepEqual(errors, []);
    await context.close();
  });
  await test('Login and Launch Web App open existing login; browser back and cancel return home', async () => {
    const { page, context } = await fixture();
    await go(page);
    await hero(page).waitFor();
    await page.locator('.of-header').getByRole('link', { name: 'Login' }).click();
    await dialog(page).waitFor();
    assert.equal(new URL(page.url()).pathname, '/login');
    await page.goBack();
    await hero(page).waitFor();
    await page.getByRole('link', { name: 'Launch Web App', exact: true }).click();
    await dialog(page).waitFor();
    assert.equal(new URL(page.url()).pathname, '/app');
    await page.keyboard.press('Escape');
    await hero(page).waitFor();
    await context.close();
  });
  await test('browser login reaches /app, reload preserves the session, and signout keeps login available', async () => {
    const { page, context, errors } = await fixture();
    await go(page, '/app');
    await dialog(page).waitFor();
    await page.getByLabel('Email', { exact: true }).fill(user.email);
    await page.getByLabel('Password', { exact: true }).fill('local-preview-password');
    await dialog(page).getByRole('button', { name: 'Sign In', exact: true }).click();
    await page.getByRole('button', { name: 'Open menu' }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/app');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Open menu' }).waitFor();
    assert.equal(await hero(page).count(), 0);
    // Trigger the actual SDK signout, with the logout request intercepted.
    await page.getByRole('button', { name: 'Account menu for Preview Racer' }).click();
    await page.getByRole('menuitem', { name: 'Sign Out', exact: true }).click();
    await dialog(page).waitFor();
    assert.equal(await hero(page).count(), 0);
    assert.deepEqual(errors, []);
    await context.close();
  });
  await test('returning authenticated browser skips marketing and preserves query/deep-link fragments', async () => {
    const { page, context } = await fixture({ authenticated: true });
    await page.addInitScript(() => {
      window.__marketingSeen = false;
      new MutationObserver(() => {
        if (document.querySelector('#of-hero-title')) window.__marketingSeen = true;
      }).observe(document, { childList: true, subtree: true });
    });
    await go(page, '/?shared=keep#details');
    await page.getByRole('button', { name: 'Open menu' }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/app');
    assert.equal(new URL(page.url()).search, '?shared=keep');
    assert.equal(new URL(page.url()).hash, '#details');
    assert.equal(await page.evaluate(() => window.__marketingSeen), false);
    assert.equal(
      await page.locator('meta[name=robots]').getAttribute('content'),
      'noindex, nofollow',
    );
    await context.close();
  });
  await test('native parameter bypass, persistence, login and reload on Android and iOS wrappers', async () => {
    for (const userAgent of [
      'Mozilla/5.0 (Linux; Android 15) MedianAndroid/1.0',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) MedianIOS/1.0',
    ]) {
      const { page, context } = await fixture({ viewport: { width: 390, height: 844 }, userAgent });
      await go(page, '/?nativeApp=true');
      await page.getByRole('heading', { name: 'Welcome to OnlyFast', exact: true }).waitFor();
      assert.equal(await hero(page).count(), 0);
      assert.equal(
        await page.evaluate(() => localStorage.getItem('onlyfast_hide_external_payments')),
        'true',
      );
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Welcome to OnlyFast', exact: true }).waitFor();
      await page.getByRole('button', { name: /log.?in|sign.?in/i }).click();
      await dialog(page).waitFor();
      await page.getByLabel('Email', { exact: true }).fill(user.email);
      await page.getByLabel('Password', { exact: true }).fill('local-preview-password');
      await dialog(page).getByRole('button', { name: 'Sign In', exact: true }).click();
      await page.getByRole('button', { name: 'Open menu' }).waitFor();
      assert.equal(new URL(page.url()).pathname, '/');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Open menu' }).waitFor();
      assert.equal(await hero(page).count(), 0);
      await context.close();
    }
  });
  await test('persisted parameter marker works without wrapper UA, and explicit browser reset restores marketing', async () => {
    const { page, context } = await fixture();
    await go(page, '/?nativeApp=true');
    await page.getByRole('heading', { name: 'Welcome to OnlyFast', exact: true }).waitFor();
    await go(page, '/support');
    await go(page);
    await page.getByRole('heading', { name: 'Welcome to OnlyFast', exact: true }).waitFor();
    await go(page, '/?nativeApp=false');
    await hero(page).waitFor();
    await context.close();
  });
  await test('password reset route and root email recovery callback retain the existing password form', async () => {
    const { page, context } = await fixture({ authenticated: true });
    await go(page, '/reset-password');
    await page.getByRole('heading', { name: 'Reset Your Password' }).waitFor();
    await page.getByLabel('New password', { exact: true }).waitFor();
    await go(
      page,
      `/#access_token=${jwt}&refresh_token=local-preview-only&type=recovery&expires_in=3600&token_type=bearer`,
    );
    await page.getByRole('heading', { name: 'Reset Your Password' }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/reset-password');
    await context.close();
  });
  await test('native routing survives reload when marker persistence is blocked', async () => {
    const { page, context } = await fixture();
    await page.addInitScript(() => {
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === 'onlyfast_hide_external_payments') throw new Error('Storage blocked');
        return setItem.call(this, key, value);
      };
    });
    await go(page, '/?nativeApp=true');
    await page.getByRole('heading', { name: 'Welcome to OnlyFast', exact: true }).waitFor();
    assert.equal(new URL(page.url()).searchParams.get('nativeApp'), 'true');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Welcome to OnlyFast', exact: true }).waitFor();
    assert.equal(await hero(page).count(), 0);
    await context.close();
  });
  await test('root email confirmation callback enters the existing application', async () => {
    const { page, context } = await fixture();
    await go(
      page,
      `/#access_token=${jwt}&refresh_token=local-preview-only&type=signup&expires_in=3600&token_type=bearer`,
    );
    await page.getByRole('button', { name: 'Open menu' }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/app');
    assert.equal(await hero(page).count(), 0);
    await context.close();
  });
  await test('Rookie house advertising remains available at the authenticated /app alias', async () => {
    const { page, context } = await fixture({ authenticated: true });
    await go(page, '/app');
    await page.getByRole('button', { name: 'Open menu' }).waitFor();
    await page.getByRole('complementary', { name: 'OnlyFast upgrade banner' }).waitFor();
    await context.close();
  });
  await test('native navigation, back, logout and recovery return retain native context', async () => {
    for (const userAgent of ['MedianAndroid/1.0', 'MedianIOS/1.0']) {
      const { page, context } = await fixture({ userAgent, authenticated: true });
      await go(page, '/?nativeApp=true');
      await page.getByRole('button', { name: 'Open menu' }).waitFor();
      await page.getByRole('button', { name: 'Open menu' }).click();
      await page
        .getByRole('dialog', { name: 'Main menu' })
        .getByRole('button', { name: /^Schedule/ })
        .click();
      await page.getByRole('heading', { name: /Race Schedule/ }).waitFor();
      await page.evaluate(() =>
        document.dispatchEvent(new Event('backbutton', { cancelable: true })),
      );
      await page.getByRole('button', { name: 'Open menu' }).waitFor();
      await go(
        page,
        `/reset-password#access_token=${jwt}&refresh_token=local-preview-only&type=recovery&expires_in=3600&token_type=bearer`,
      );
      await page.getByLabel('New password', { exact: true }).waitFor();
      await page.getByLabel('New password', { exact: true }).fill('local-preview-password-new');
      await page
        .getByLabel('Confirm new password', { exact: true })
        .fill('local-preview-password-new');
      await page.getByRole('button', { name: 'Update password', exact: true }).click();
      await page.getByRole('button', { name: 'Open menu' }).waitFor();
      assert.equal(new URL(page.url()).pathname, '/');
      assert.equal(await hero(page).count(), 0);
      await page.getByRole('button', { name: 'Account menu for Preview Racer' }).click();
      await page.getByRole('menuitem', { name: 'Sign Out', exact: true }).click();
      await page.getByRole('heading', { name: 'Welcome to OnlyFast', exact: true }).waitFor();
      assert.equal(await hero(page).count(), 0);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Welcome to OnlyFast', exact: true }).waitFor();
      assert.equal(await hero(page).count(), 0);
      assert.equal(
        await page.evaluate(() => localStorage.getItem('onlyfast_hide_external_payments')),
        'true',
      );
      await context.close();
    }
  });
  await test('authenticated mobile browser uses /app and keeps the existing account alias', async () => {
    const { page, context } = await fixture({
      authenticated: true,
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (Linux; Android 15) Chrome/130.0 Mobile Safari/537.36',
    });
    await go(page);
    await page.getByRole('button', { name: 'Open menu' }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/app');
    assert.equal(await hero(page).count(), 0);
    await go(page, '/account?shared=keep#details');
    await page.getByRole('button', { name: 'Open menu' }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/account');
    assert.equal(new URL(page.url()).search, '?shared=keep');
    await context.close();
  });
  await test('expired browser session refreshes through the existing SDK before entering /app', async () => {
    const { page, context, requests } = await fixture({ authenticated: true, expired: true });
    await go(page);
    await page.getByRole('button', { name: 'Open menu' }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/app');
    assert.ok(requests.some(request => request.path === '/auth/v1/token' && request.method === 'POST'));
    assert.equal(await hero(page).count(), 0);
    await context.close();
  });
} finally {
  await browser.close();
  await writeFile(
    path.join(output, 'results.json'),
    JSON.stringify({ base, backend: 'intercepted local fixtures only', results }, null, 2),
  );
}
if (results.some((result) => result.status === 'failed')) process.exitCode = 1;
