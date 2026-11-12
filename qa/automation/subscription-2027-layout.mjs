import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const { chromium } = await import(process.env.ONLYFAST_PLAYWRIGHT_MODULE
  ? pathToFileURL(path.resolve(process.env.ONLYFAST_PLAYWRIGHT_MODULE)).href : 'playwright');
const origin = process.env.ONLYFAST_LAYOUT_URL || 'http://127.0.0.1:4177';
assert(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname), 'Local fixture verification only');
const output = path.resolve('tmp/onlyfast-2027-review');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
try {
  for (const width of [320, 390, 768, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const external = [], errors = [];
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin === origin || ['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname)) return route.continue();
      external.push(route.request().url()); return route.abort();
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + '/upgrade');
    await page.getByRole('heading', { name: 'Choose your next season' }).waitFor();
    assert.equal(await page.locator('.membership-card').count(), 3);
    assert.equal(await page.locator('textarea').evaluate(el => el.readOnly), true);
    await page.getByLabel('Setup age in hours', { exact: true }).fill('47');
    assert.equal(await page.locator('textarea').evaluate(el => el.readOnly), false);
    await page.getByLabel('Setup age in hours', { exact: true }).fill('48');
    assert.equal(await page.locator('textarea').evaluate(el => el.readOnly), true);
    await page.getByLabel('Total regular setups', { exact: true }).fill('4');
    assert.match(await page.locator('[aria-live="polite"]').innerText(), /New regular setup: Allowed/);
    await page.getByLabel('Total regular setups', { exact: true }).fill('5');
    assert.match(await page.locator('[aria-live="polite"]').innerText(), /New regular setup: Blocked/);
    await page.getByRole('button', { name: 'Inspect Pro permissions', exact: true }).click();
    await page.getByLabel('Class to save', { exact: true }).selectOption('Modified');
    assert.match(await page.locator('[aria-live="polite"]').innerText(), /New regular setup: Blocked/);
    await page.getByRole('button', { name: 'Inspect Factory permissions', exact: true }).click();
    assert.match(await page.locator('[aria-live="polite"]').innerText(), /New regular setup: Allowed/);
    await page.getByRole('button', { name: 'Inspect Sportsman permissions', exact: true }).click();
    await page.getByLabel('Class to save', { exact: true }).selectOption('Dwarf Cars');
    const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
    assert(dimensions.document <= dimensions.viewport, 'No horizontal overflow at ' + width);
    await page.screenshot({ path: path.join(output, 'preview-' + width + '.png'), fullPage: true });
    for (const route of ['/pricing', '/onboarding-preview']) {
      await page.goto(origin + route);
      await page.getByRole('heading', { name: 'Choose your next season' }).waitFor();
    }
    assert.deepEqual(errors, []); assert.deepEqual(external, [], 'No external network requests are permitted');
    results.push({ width, routes: ['/upgrade', '/pricing', '/onboarding-preview'], dimensions, externalRequests: external.length, errors });
    await context.close();
  }
  await writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
