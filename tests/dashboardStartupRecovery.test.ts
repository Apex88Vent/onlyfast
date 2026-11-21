import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { StartupTimeout, startupRead, restoreStartupSession } from '../src/lib/startupRecovery.ts';
import { retainWebAssets } from '../scripts/retain-web-assets.mjs';

test('startup reads abort a stalled request and recover once, without leaking error payloads', async context => {
  const logs = context.mock.method(console, 'warn', () => {});
  const signals: AbortSignal[] = [];
  const data = await startupRead('racing-profile', signal => {
    signals.push(signal);
    return signals.length === 1 ? new Promise(() => {}) : Promise.resolve('ready');
  }, undefined, { deadline: 12, delay: 1 });
  assert.equal(data, 'ready');
  assert.equal(signals.length, 2);
  assert(signals[0].reason instanceof StartupTimeout);
  assert(!signals[1].aborted);

  let calls = 0;
  await assert.rejects(startupRead('dashboard-schedule', () => {
    calls++;
    return Promise.reject({ status: 503, code: 'PGRST000', message: 'SECRET-TOKEN sample@example.com' });
  }, undefined, { deadline: 50, delay: 1 }));
  assert.equal(calls, 2);
  const output = JSON.stringify(logs.mock.calls.map(call => call.arguments));
  assert.match(output, /dashboard-schedule.*503.*PGRST000/);
  assert.doesNotMatch(output, /SECRET|example\.com/);

  let permanentCalls = 0;
  await assert.rejects(startupRead('saved-class', async () => { permanentCalls++; throw { status: 403 }; }));
  assert.equal(permanentCalls, 1);
});

test('concurrent startup consumers share one SDK session restoration and refresh again after it settles', async () => {
  const auth = { getSession: async () => { calls++; return { data: { session: null }, error: null }; } } satisfies Pick<SupabaseClient['auth'], 'getSession'>;
  let calls = 0;
  assert.deepEqual(await Promise.all([restoreStartupSession(auth), restoreStartupSession(auth)]), [null, null]);
  assert.equal(calls, 1);
  await restoreStartupSession(auth);
  assert.equal(calls, 2);
});

test('a candidate retains the previous entry’s dashboard and dependencies across deployment', async () => {
  const root = await mkdtemp(join(tmpdir(), 'onlyfast-asset-test-'));
  try {
    const previous = join(root, 'previous');
    const candidate = join(root, 'candidate');
    await mkdir(join(previous, 'assets'), { recursive: true });
    await mkdir(candidate);
    const assets = {
      'main-oldABCDE.js': 'import("./SetupDashboard-oldBCDEF.js");',
      'SetupDashboard-oldBCDEF.js': 'import "./shared-oldCDEFG.js"; export default function Dashboard() {}',
      'shared-oldCDEFG.js': 'export const value = 1;',
      'main-oldDEFGH.css': 'html { color: black; }',
    };
    await Promise.all(Object.entries(assets).map(([name, contents]) => writeFile(join(previous, 'assets', name), contents)));
    await writeFile(join(candidate, 'index.html'), 'candidate html');
    assert.equal((await retainWebAssets(candidate, [previous])).length, 4);
    assert.deepEqual(await retainWebAssets(candidate, [previous]), []);
    for (const [name, contents] of Object.entries(assets)) {
      assert.equal(await readFile(join(candidate, 'assets', name), 'utf8'), contents);
    }
    assert.equal(await readFile(join(candidate, 'index.html'), 'utf8'), 'candidate html');
    await writeFile(join(previous, 'assets', 'shared-oldCDEFG.js'), 'different bytes');
    await assert.rejects(retainWebAssets(candidate, [previous]), { code: 'EEXIST' });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
