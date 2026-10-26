import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';
// @ts-expect-error JS preparer is intentionally outside the application build.
import { prepareLocalPaywallSync } from '../scripts/prepare-median-paywall-local-sync.mjs';
test('prepared real-sync wrapper allows only the designated local user and Android/iOS sandbox records', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const fixture = await mkdtemp(path.join(root, 'tmp/paywall-sync-test-'));
  const workspace = path.join(fixture, 'local'); const output = path.join(fixture, 'prepared');
  await mkdir(path.join(workspace, 'supabase'), { recursive: true });
  await writeFile(path.join(workspace, 'supabase/config.toml'), 'project_id = "onlyfast-disposable-staging"\n[functions.unrelated]\nverify_jwt = true\n');
  await writeFile(path.join(workspace, 'local-status.json'), JSON.stringify({ API_URL: 'http://127.0.0.1:54321', DB_URL: 'postgresql://127.0.0.1:54322/postgres', ANON_KEY: 'public-local-fixture' }));
  const uid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const tester = path.join(fixture, 'tester.local.json'); const env = path.join(fixture, 'server.env.local');
  await writeFile(tester, JSON.stringify({ userId: uid, email: 'qa@example.invalid', localOnly: true }));
  await writeFile(env, 'REVENUECAT_SECRET_API_KEY=synthetic-server-key\n');
  await prepareLocalPaywallSync(workspace, output, tester, env);
  await assert.rejects(prepareLocalPaywallSync(workspace, output, tester, env), 'existing evidence is never overwritten');
  const preparedConfig = await readFile(path.join(output, 'supabase/config.toml'), 'utf8');
  assert.doesNotMatch(preparedConfig, /functions\.unrelated/);
  assert.match(preparedConfig, /\[functions.sync-revenuecat-subscription\]\nverify_jwt = false/);
  assert.equal(await readFile(path.join(output, 'server.env.local'), 'utf8'), 'REVENUECAT_SECRET_API_KEY=synthetic-server-key\nREVENUECAT_ALLOW_SANDBOX=true\n');
  assert.equal(await readFile(path.join(output, 'supabase/functions/sync-revenuecat-subscription/handler.ts'), 'utf8'),
    await readFile(path.join(root, 'supabase/functions/sync-revenuecat-subscription/index.ts'), 'utf8'));
  const wrapper = await readFile(path.join(output, 'supabase/functions/sync-revenuecat-subscription/index.ts'), 'utf8');
  const code = ts.transpileModule(wrapper.replace("await import('./handler.ts');", ''), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const original = globalThis.fetch;
  let record: { store: string; is_sandbox: boolean } = { store: 'play_store', is_sandbox: true };
  let networkCalls = 0;
  globalThis.fetch = async () => { networkCalls++; return Response.json({ subscriber: { subscriptions: { sku: record } } }); };
  try {
    const execute = new Function('Deno', code);
    const deno = (backend: string) => ({ env: { get: (key: string) => key === 'SUPABASE_URL' ? backend : 'true' } });
    assert.throws(() => execute(deno('https://production.supabase.co')), /Nonlocal/);
    execute(deno('http://kong:8000'));
    const customer = 'https://api.revenuecat.com/v1/subscribers/' + uid;
    for (const store of ['play_store', 'app_store']) {
      record = { store, is_sandbox: true }; assert.equal((await fetch(customer)).status, 200);
      record = { store, is_sandbox: false }; await assert.rejects(fetch(customer), /sandbox/);
    }
    record = { store: 'stripe', is_sandbox: true }; await assert.rejects(fetch(customer), /sandbox/);
    const before = networkCalls;
    await assert.rejects(fetch('https://api.revenuecat.com/v1/subscribers/someone-else'), /Other customer/);
    await assert.rejects(fetch('https://production.supabase.co/rest/v1/user_subscriptions'), /external API/);
    await assert.rejects(fetch(customer, { method: 'POST' }), /reads only/);
    assert.equal(networkCalls, before);
    assert.equal((await fetch('http://kong:8000/rest/v1/user_subscriptions')).status, 200);
  } finally { globalThis.fetch = original; }
});
