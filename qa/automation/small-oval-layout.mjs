// Local browser verification of the real sheet + snapshot code. No account or
// hosted API calls. Start Vite, then set ONLYFAST_PLAYWRIGHT_MODULE if external.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.ONLYFAST_PLAYWRIGHT_MODULE
  ? pathToFileURL(path.resolve(process.env.ONLYFAST_PLAYWRIGHT_MODULE)).href : 'playwright');
const origin = process.env.ONLYFAST_LAYOUT_URL || 'http://127.0.0.1:8085';
assert(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname));
const output = path.resolve('tmp/small-oval');
await mkdir(output, { recursive: true });
await writeFile(path.join(output, 'entry.tsx'), `
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import ChassisSetupForm from '/src/components/ChassisSetupForm.tsx';
import { BetaFeaturesContext } from '/src/contexts/betaFeaturesContextValue.ts';
import { buildBetaAccessSnapshot, CLOSED_BETA_ACCESS } from '/src/lib/betaFeatures.ts';
import { SMALL_OVAL_CLASS_CONFIGS } from '/src/lib/smallOvalSetupSchemas.ts';
import { buildLibraryCustomFields, libraryFieldsFromRow } from '/src/lib/setupLibraryStorage.ts';
import '/src/index.css';
const experimental = buildBetaAccessSnapshot({ user_id: 'local-fixture', is_test_account: true, beta_features_enabled: true, tester_kind: 'experimental' }, [{ feature_key: 'test_account_full_access', enabled: true }]);
function Review() {
  const id = new URLSearchParams(location.search).get('class') || 'micro_sprint';
  const access = id === 'micro_sprint' || new URLSearchParams(location.search).has('normal') ? CLOSED_BETA_ACCESS : experimental;
  const [data, setData] = useState({ micro_configuration: 'winged' });
  const save = () => localStorage.setItem('onlyfast-local-small-oval-qa-' + id, JSON.stringify(buildLibraryCustomFields(id, data)));
  const reopen = () => setData(libraryFieldsFromRow({ race_class: id, custom_fields: JSON.parse(localStorage.getItem('onlyfast-local-small-oval-qa-' + id)) }));
  return <BetaFeaturesContext.Provider value={{ ...access, loading: false, hasBetaFeature: () => false }}>
    <main className="min-h-screen bg-[#F5F5F7] p-3 sm:p-6"><div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">{SMALL_OVAL_CLASS_CONFIGS[id].name}</h1>
      <div className="flex gap-3 mb-4"><button onClick={save}>Save QA snapshot</button><button onClick={reopen}>Reopen QA snapshot</button></div>
      <ChassisSetupForm raceClass={id} data={data} customFields={[]} onChange={(key, value) => setData(prev => ({ ...prev, [key]: value }))} />
    </div></main>
  </BetaFeaturesContext.Provider>;
}
createRoot(document.getElementById('root')).render(<Review />);
`);
await writeFile(path.join(output, 'review.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local small oval QA</title></head><body><div id="root"></div><script type="module" src="/tmp/small-oval/entry.tsx"></script></body></html>`);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const hostedRequests = [];
    page.on('request', request => { if (new URL(request.url()).hostname.endsWith('.supabase.co')) hostedRequests.push(request.url()); });
    page.on('pageerror', error => errors.push(error.message));
    for (const id of ['micro_sprint', 'quarter_midget', 'junior_sprint', 'mini_dwarf']) {
      await page.goto(origin + '/tmp/small-oval/review.html?class=' + id, { waitUntil: 'domcontentloaded' });
      await page.locator('input[id$="-lf_cold_pressure"]').waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${id} overflow at ${viewport.width}`);
      for (const c of ['lf', 'rf', 'lr', 'rr']) await page.locator(`input[id$="-${c}_cold_pressure"]`).fill('9.5');
      if (id === 'micro_sprint') {
        assert.equal(await page.getByText('Development setup sheet', { exact: false }).count(), 0);
        const mode = page.locator('select[id$="-micro_configuration"]');
        const wing = page.locator('input[id$="-wing_angle"]');
        assert.equal(await wing.isEnabled(), true);
        await wing.fill('24');
        await page.getByRole('button', { name: 'Save QA snapshot' }).click();
        await mode.selectOption('non_winged');
        assert.equal(await wing.isDisabled(), true);
        assert.equal(await wing.inputValue(), '24');
        await page.getByRole('button', { name: 'Save QA snapshot' }).click();
        await page.reload();
        await page.getByRole('button', { name: 'Reopen QA snapshot' }).click();
        assert.equal(await mode.inputValue(), 'non_winged');
        assert.equal(await wing.isDisabled(), true);
        assert.equal(await wing.inputValue(), '24');
        await page.locator('section[aria-labelledby="micro-wing-heading"]').screenshot({ path: path.join(output, `micro-wing-disabled-${viewport.width}.png`) });
        await mode.selectOption('winged');
        assert.equal(await wing.isEnabled(), true);
        assert.equal(await wing.inputValue(), '24');
      } else {
        await page.getByRole('button', { name: 'Save QA snapshot' }).click();
        await page.reload();
        await page.getByRole('button', { name: 'Reopen QA snapshot' }).click();
        for (const c of ['lf', 'rf', 'lr', 'rr']) assert.equal(await page.locator(`input[id$="-${c}_cold_pressure"]`).inputValue(), '9.5');
      }
      await page.screenshot({ path: path.join(output, `${id}-${viewport.width}.png`), fullPage: true });
      console.log(`${id}: ${viewport.width}px renders without overflow; snapshot save/reopen passes`);
    }
    for (const id of ['quarter_midget', 'junior_sprint', 'mini_dwarf']) {
      await page.goto(origin + '/tmp/small-oval/review.html?normal&class=' + id, { waitUntil: 'domcontentloaded' });
      await page.getByRole('status').waitFor();
      assert.equal(await page.locator('input').count(), 0, `${id} denied to normal browser context`);
    }
    assert.deepEqual(hostedRequests, [], 'isolated form review never calls a hosted account/backend');
    await context.close();
  }
  assert.deepEqual(errors, []);
  console.log('Micro Sprint native disabled styling, retained 24° and reactivation verified. No browser exceptions.');
} finally { await browser.close(); }
