import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { cp, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { retainWebAssets } from '../../scripts/retain-web-assets.mjs';

const [baselineDir, candidateDir] = process.argv.slice(2);
assert(baselineDir && candidateDir, 'Pass baseline and candidate Vite build directories');
const legacy = process.argv.includes('--legacy');
const testingRef = 'mfzajhnfonrfuiwxgvhe';
const productionRef = 'thpyjvwtfvfxiufchrxn';
const projectRef = legacy ? productionRef : testingRef;
const authKey = legacy ? `sb-${productionRef}-auth-token` : `onlyfast-2027-${testingRef}-auth`;
const prodChunk = /^SetupDashboard-[\w-]+\.js$/;
const playwright = process.env.ONLYFAST_PLAYWRIGHT_MODULE
  ? pathToFileURL(resolve(process.env.ONLYFAST_PLAYWRIGHT_MODULE)).href : 'playwright';
const { chromium, webkit } = await import(playwright);
const user = {
  id: '33333333-3333-4333-8333-333333333333', email: 'fixture@onlyfast.invalid',
  aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { onboarding_completed: true }, created_at: '2026-01-01T00:00:00.000Z',
};
const activeClass = {
  active_class: 'Winged Sprint', active_discipline: 'dirt-oval', tier: 'team', can_change: true,
  unlimited: true, onboarding_step: 'complete', onboarding_race_class: 'Winged Sprint',
  onboarding_discipline: 'dirt-oval',
};
const subscription = {
  user_id: user.id, plan: 'teams', status: 'active', subscription_source: 'revenuecat',
  revenuecat_expires_at: '2099-01-01T00:00:00Z', current_period_end: '2099-01-01T00:00:00Z',
};
const schedule = {
  id: '22222222-2222-4222-8222-222222222222', user_id: user.id, track: 'Fixture Raceway',
  race_date: '2099-06-02', race_end_date: null, organization: 'Fixture Series', finishing_position: null,
};
const storedSetup = {
  id: '44444444-4444-4444-8444-444444444444', user_id: user.id, setup_type: 'base_template',
  setup_name: 'Fixture Stored Setup', track_name: 'Fixture Raceway', race_class: 'Winged Sprint',
  created_at: '2026-01-01T00:00:00.000Z',
};
const validSession = expiry => ({
  access_token: `eyJhbGciOiJub25lIn0.${Buffer.from(JSON.stringify({ sub: user.id, exp: expiry })).toString('base64url')}.fixture`,
  refresh_token: 'fixture-only', expires_at: expiry, expires_in: 3600, token_type: 'bearer', user,
});
const model = ext => ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' })[ext] || 'application/octet-stream';
let servedBuild = baselineDir;
const cache = new Map();
const baselineAssets = await readdir(resolve(baselineDir, 'assets'));
const candidateAssets = await readdir(resolve(candidateDir, 'assets'));
const retiredDashboard = baselineAssets.find(name => prodChunk.test(name));
assert(retiredDashboard, 'Baseline must contain the lazy dashboard');
assert(!candidateAssets.some(name => prodChunk.test(name)), 'Candidate must not emit a standalone dashboard chunk');

async function entrySizes(dir, files) {
  const html = await readFile(resolve(dir, 'index.html'), 'utf8');
  const main = basename(html.match(/src="([^"]+\.js)"/)[1]);
  const startup = files.filter(name => /^(?:App-|testingEntry-|SetupDashboard-)\S+\.js$/.test(name));
  const sizes = [];
  for (const name of [main, ...startup]) {
    const buffer = await readFile(resolve(dir, 'assets', name));
    sizes.push({ name, bytes: buffer.length, gzip: gzipSync(buffer).length });
  }
  return sizes;
}
console.log(JSON.stringify({ sizes: {
  baseline: await entrySizes(baselineDir, baselineAssets), candidate: await entrySizes(candidateDir, candidateAssets),
} }));
const cutoverDir = await mkdtemp(join(tmpdir(), 'onlyfast-cutover-'));
await cp(candidateDir, cutoverDir, { recursive: true });
const retained = await retainWebAssets(cutoverDir, [baselineDir]);
console.log(JSON.stringify({ retainedAssets: retained.length }));

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const file = url.pathname === '/app' || url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  if (!/^[\w./-]+$/.test(file) || file.split('/').includes('..')) { res.writeHead(404).end(); return; }
  const buildAtRequest = servedBuild;
  try {
    const path = resolve(buildAtRequest, file);
    if (!cache.has(path)) {
      const bytes = await readFile(path);
      const compressible = /\.(html|js|css)$/.test(file);
      cache.set(path, { type: model(extname(file)), bytes: compressible ? gzipSync(bytes) : bytes, compressible });
    }
    const asset = cache.get(path);
    if (file.endsWith('.js')) await new Promise(resolve => setTimeout(resolve, 70));
    res.writeHead(200, {
      'content-type': asset.type,
      'cache-control': file.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
      ...(asset.compressible ? { 'content-encoding': 'gzip' } : {}),
    }).end(asset.bytes);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

async function fixture(browser, device, scenario) {
  const mobile = device !== 'Desktop Chromium';
  const native = /Median/.test(device);
  const context = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 },
    isMobile: mobile, hasTouch: mobile,
    ...(device === 'Android Median' ? { userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 7; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/143 Mobile Safari/537.36 Median' } : {}),
    ...(device === 'iOS Median' ? { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MedianIOS' } : {}),
  });
  const page = await context.newPage();
  const requests = [];
  const errors = [];
  const diagnostics = [];
  const moduleErrors = [];
  let releaseProfile;
  const profileGate = scenario === 'cutover' ? new Promise(resolve => { releaseProfile = resolve; }) : Promise.resolve();
  let scheduleAttempts = 0;
  let refreshAttempts = 0;
  let passwordAttempts = 0;
  let profileAttempts = 0;
  let documents = 0;
  const refreshedExpiry = Math.floor(Date.now() / 1000) + 600;
  let returningFromBackground = false;
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.text().startsWith('[onlyfast.startup]')) diagnostics.push(message.text());
    if (/Minified React error #306|unexpected module script|expected a JavaScript/i.test(message.text())) moduleErrors.push(message.text());
  });
  page.on('request', request => { if (request.resourceType() === 'document') documents++; });
  page.on('response', response => {
    if (response.url().startsWith(origin + '/assets/') && response.url().includes('.js')) {
      requests.push({ asset: basename(new URL(response.url()).pathname), status: response.status(), type: response.headers()['content-type'] });
    }
  });
  // All provider and backend traffic is stubbed. The real Vite outputs and
  // browser module/cache behavior are exercised over loopback HTTP.
  await context.routeWebSocket(/.*/, websocket => websocket.close());
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin) {
      if (scenario === 'module-retry' && /\/ScanTimingScreen-[\w-]+\.js$/.test(url.pathname)) {
        if (!url.searchParams.has('onlyfast_retry')) return route.abort('failed');
        const response = await route.fetch();
        const script = await response.text();
        const lastExport = /export\{([\w$]+) as default\};\s*$/.exec(script);
        assert(lastExport, 'Scanner build must supply its default export before the namespace fixture rewrites it');
        const wrapped = script.slice(0, lastExport.index) +
          'const __retryFixture=Object.freeze({default:' + lastExport[1] +
          ',[Symbol.toStringTag]:"Module"});export{__retryFixture as S};';
        return route.fulfill({ status: response.status(), contentType: 'application/javascript', body: wrapped });
      }
      return route.continue();
    }
    if (url.hostname !== `${projectRef}.supabase.co`) return route.abort('blockedbyclient');
    const headers = {
      'access-control-allow-origin': origin, 'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': '*',
    };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    let json = [];
    let status = 200;
    if (url.pathname.endsWith('/get_onlyfast_2027_environment')) json = { project_ref: testingRef, schema_version: 'phase1b-v1' };
    else if (url.pathname.endsWith('/get_active_race_class_state')) {
      profileAttempts++;
      await profileGate;
      json = activeClass;
      if (scenario === 'resume' && profileAttempts === 1) { status = 503; json = { code: 'PGRST000' }; }
    } else if (url.pathname === '/auth/v1/token') {
      if (url.searchParams.get('grant_type') === 'password') passwordAttempts++;
      else refreshAttempts++;
      json = validSession(scenario === 'resume' && !returningFromBackground ? refreshedExpiry : 4102444800);
    } else if (url.pathname === '/auth/v1/user') json = user;
    else if (url.pathname.endsWith('/user_subscriptions')) json = subscription;
    else if (url.pathname.endsWith('/get_onlyfast_membership')) json = { tier: 'team' };
    else if (url.pathname.endsWith('/get_onlyfast_2027_account_access')) json = { tier: 'team', active_class: 'Winged Sprint', selection_required: false };
    else if (url.pathname.endsWith('/list_user_setup_summaries')) json = [storedSetup];
    else if (url.pathname.endsWith('/get_onlyfast_2027_billing_status')) { status = 404; json = { code: 'PGRST202' }; }
    else if (/\/(get_onlyfast_test_tier|beta_tester_accounts)$/.test(url.pathname)) json = null;
    else if (url.pathname === '/rest/v1/race_schedule') {
      scheduleAttempts++;
      if (['resume', 'manual'].includes(scenario) && scheduleAttempts <= 2) { status = 503; json = { code: 'PGRST000' }; }
      else json = [schedule];
    }
    return route.fulfill({ status, headers, json });
  });
  await page.addInitScript(({ authKey, session }) => {
    if (session) localStorage.setItem(authKey, JSON.stringify(session));
    else sessionStorage.setItem('onlyfast_guest_tutorial_seen', 'true');
  }, { authKey, session: scenario === 'login' ? null : validSession(scenario === 'resume' ? 1 : 4102444800) });
  const url = origin + '/app' + (native ? '?nativeApp=true' : '');
  const landing = page.getByRole('button', { name: 'Parts Reference', exact: true });
  const start = performance.now();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    if (scenario === 'login') {
      const essential = page.getByRole('button', { name: 'Accept Essential', exact: true });
      await page.getByLabel('Email', { exact: true }).fill(user.email);
      await page.getByLabel('Password', { exact: true }).fill('fixture-password');
      if (await essential.isVisible()) await essential.click();
      await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    }
    if (scenario === 'cutover') {
      await page.waitForFunction(() => performance.getEntriesByType('resource').some(entry => /(?:App|main)-[\w-]+\.js/.test(entry.name)));
      const deadline = Date.now() + 15_000;
      while (!profileAttempts && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 25));
      assert(profileAttempts, 'Old app started authentication before publishing the new build');
      servedBuild = cutoverDir;
      releaseProfile();
    }
    await landing.waitFor({ timeout: 25_000 });
    const readyMs = Math.round(performance.now() - start);
    await page.locator('[aria-label="Account type: Team"]').waitFor({ timeout: 15_000 });
    if (['resume', 'manual'].includes(scenario)) {
      await page.getByRole('alert').filter({ hasText: 'Race schedule is temporarily unavailable' }).waitFor();
      await page.getByRole('button', { name: 'New Setup', exact: true }).first().click();
      const track = page.getByPlaceholder('Enter track name');
      await track.fill('Unsaved fixture draft');
      const nextSchedule = page.waitForResponse(response =>
        new URL(response.url()).pathname.endsWith('/race_schedule') && response.status() === 200);
      if (scenario === 'resume') {
        const expiry = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).expires_at, authKey);
        assert.equal(expiry, refreshedExpiry, 'The fixture must advance past the near-term session, before the distinct idle timeout');
        const priorRefreshes = refreshAttempts;
        assert(priorRefreshes >= 1, 'The expired startup session must refresh before opening the dashboard');
        const nextRefresh = page.waitForResponse(response => response.url().includes('grant_type=refresh_token') && response.status() === 200, { timeout: 8000 })
          .catch(() => null);
        returningFromBackground = true;
        await page.clock.setSystemTime(new Date((expiry + 1) * 1000));
        await page.evaluate(() => {
          window.dispatchEvent(new Event('pageshow'));
          window.dispatchEvent(new Event('online'));
          document.dispatchEvent(new Event('visibilitychange'));
        });
        assert(await nextRefresh, JSON.stringify({ expiry, priorRefreshes, refreshAttempts,
          page: await page.evaluate(() => ({ now: Math.floor(Date.now() / 1000), visible: document.visibilityState })),
        }));
        assert.equal(refreshAttempts, priorRefreshes + 1);
      } else {
        await page.getByRole('alert').filter({ hasText: 'Race schedule is temporarily unavailable' })
          .getByRole('button', { name: 'Try again', exact: true }).click();
      }
      await nextSchedule;
      await page.getByRole('alert').filter({ hasText: 'Race schedule is temporarily unavailable' }).waitFor({ state: 'hidden' });
      assert.equal(await track.inputValue(), 'Unsaved fixture draft');
      assert.equal(scheduleAttempts, 3);
      assert(diagnostics.some(value => value.includes('dashboard-schedule')));
    }
    if (scenario === 'candidate') {
      await page.getByRole('button', { name: 'Continue Saved Setup', exact: true }).click();
      await page.getByText('Fixture Stored Setup', { exact: true }).first().waitFor({ timeout: 10_000 });
      await page.getByRole('button', { name: 'Open menu', exact: true }).click();
      await page.getByRole('navigation', { name: 'App sections' }).getByRole('button', { name: /^Schedule/ }).click();
      await page.getByText('Fixture Raceway', { exact: true }).first().waitFor({ timeout: 10_000 });
    }
    if (scenario === 'module-retry') {
      await page.getByRole('button', { name: 'New Setup', exact: true }).first().click();
      const track = page.getByPlaceholder('Enter track name');
      await track.fill('Unsaved fixture draft');
      await page.getByRole('alert').filter({ hasText: 'timing scanner could not load' })
        .getByRole('button', { name: 'Try again', exact: true }).click();
      await page.getByRole('heading', { name: 'Scan Timing Screen', exact: true }).waitFor();
      assert.equal(await track.inputValue(), 'Unsaved fixture draft');
    }
    assert.equal(documents, 1, 'Startup and recovery share the same document');
    assert.deepEqual(errors, []);
    assert.deepEqual(moduleErrors, []);
    if (scenario === 'login') assert.equal(passwordAttempts, 1);
    assert(requests.every(request => request.status === 200 && /javascript/.test(request.type)));
    if (scenario === 'cutover') assert(requests.some(request => request.asset === retiredDashboard));
    if (servedBuild === candidateDir && scenario !== 'cutover') assert(requests.every(request => !prodChunk.test(request.asset)));
    return { device, scenario, readyMs, jsRequests: requests.length, documents, refreshAttempts, passwordAttempts, profileAttempts, scheduleAttempts };
  } finally {
    releaseProfile?.();
    await context.close();
  }
}

try {
  const profiles = [
    [chromium, 'Desktop Chromium'], [chromium, 'Android Median'], [webkit, 'iOS Median'], [webkit, 'Mobile WebKit browser'],
  ].filter(([, name]) => !process.env.ONLYFAST_BROWSER_PROFILE || name === process.env.ONLYFAST_BROWSER_PROFILE);
  for (const [engine, device] of profiles) {
    const executablePath = engine === chromium ? process.env.ONLYFAST_CHROME_PATH : undefined;
    const browser = await engine.launch({ executablePath });
    try {
      const scenarios = ['baseline', 'candidate', 'cutover', 'resume', 'manual', 'login'];
      if (engine === chromium) scenarios.push('module-retry');
      for (const scenario of scenarios.filter(value => !process.env.ONLYFAST_BROWSER_SCENARIO || value === process.env.ONLYFAST_BROWSER_SCENARIO)) {
        servedBuild = scenario === 'baseline' || scenario === 'cutover' ? baselineDir : candidateDir;
        console.log(JSON.stringify(await fixture(browser, device, scenario)));
      }
    } finally { await browser.close(); }
  }
} finally {
  await new Promise(resolve => server.close(resolve));
  await rm(cutoverDir, { recursive: true, force: true });
}
