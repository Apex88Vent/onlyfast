import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { StartupTimeout, startupRead, restoreStartupSession } from '../src/lib/startupRecovery.ts';

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
