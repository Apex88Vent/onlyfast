import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

test('RevenueCat HTTP handlers authenticate, reject forged state and retry failed writes', async () => {
  const uid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const env = new Map(Object.entries({
    REVENUECAT_WEBHOOK_AUTHORIZATION: 'Bearer webhook-secret', REVENUECAT_SECRET_API_KEY: 'secret-test',
    REVENUECAT_APP_IDS: 'app_ios,app_android', SUPABASE_URL: 'https://example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'service-test',
  }));
  const rpcCalls: Record<string, unknown>[] = [];
  const fetched: string[] = [];
  let dbFailure = false;
  let duplicate = false;
  let rpcFailure = false;
  let fetchFailure = false;
  let responseSubscriber = { entitlements: {}, subscriptions: {} };
  let handler: (req: Request) => Promise<Response>;
  const originalFetch = globalThis.fetch;
  const host = globalThis as typeof globalThis & {
    Deno?: unknown;
    __revenuecatTestClient?: unknown;
  };
  const originalDeno = host.Deno;
  const query = {
    select() { return this; }, eq() { return this; },
    async maybeSingle() { return { data: duplicate ? { event_id: 'event_1' } : null, error: dbFailure ? new Error('database unavailable') : null }; },
    async single() { return { data: { plan: 'pro', status: 'active', subscription_source: 'stripe' }, error: null }; },
  };
  host.__revenuecatTestClient = {
    auth: { async getUser(token: string) { return token === 'valid-user-token' ? { data: { user: { id: uid } }, error: null } : { data: {}, error: new Error('invalid') }; } },
    from() { return query; },
    async rpc(_name: string, args: Record<string, unknown>) {
      rpcCalls.push(args); return { data: 'applied', error: rpcFailure ? new Error('failed write') : null };
    },
  };
  host.Deno = { env: { get: (key: string) => env.get(key) }, serve(callback: typeof handler) { handler = callback; } };
  globalThis.fetch = async input => {
    fetched.push(String(input));
    return fetchFailure ? new Response('', { status: 503 }) :
      Response.json({ request_date_ms: Date.now(), subscriber: responseSubscriber });
  };
  async function load(name: string) {
    let source = await readFile(new URL(`../supabase/functions/${name}/index.ts`, import.meta.url), 'utf8');
    source = source.replace(/import \{ createClient \} from '[^']+';/,
      'const createClient = () => globalThis.__revenuecatTestClient;');
    source = source.replace("'../_shared/revenuecat.ts'", JSON.stringify(new URL('../supabase/functions/_shared/revenuecat.ts', import.meta.url).href));
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
    await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
  }
  const event = { id: 'event_1', type: 'INITIAL_PURCHASE', app_user_id: uid, app_id: 'app_ios', environment: 'PRODUCTION', event_timestamp_ms: Date.now() };
  const request = (body: unknown, authorization = 'Bearer webhook-secret') => new Request('https://example.invalid', {
    method: 'POST', headers: { Authorization: authorization }, body: JSON.stringify(body),
  });
  try {
    await load('revenuecat-webhook');
    assert.equal((await handler!(request({ api_version: '1.0', event }, 'wrong'))).status, 401);
    assert.equal(rpcCalls.length, 0); assert.equal(fetched.length, 0);
    assert.equal((await handler!(request({ forged: true }))).status, 400);
    for (const invalid of [{ id: '' }, { type: '' }, { event_timestamp_ms: 1e30 }, { event_timestamp_ms: -1 }]) {
      assert.equal((await handler!(request({ api_version: '1.0', event: { ...event, ...invalid } }))).status, 400);
    }
    assert.equal((await handler!(request({ api_version: '1.0', event }))).status, 200);
    assert.equal(rpcCalls[0].p_user_id, uid);
    assert.equal((rpcCalls[0].p_snapshot as { plan: string }).plan, 'free');
    duplicate = true;
    assert.equal((await handler!(request({ api_version: '1.0', event }))).status, 200);
    assert.equal(rpcCalls.length, 1); duplicate = false;
    rpcFailure = true;
    assert.equal((await handler!(request({ api_version: '1.0', event }))).status, 500);
    rpcFailure = false; dbFailure = true;
    assert.equal((await handler!(request({ api_version: '1.0', event }))).status, 500);
    dbFailure = false;
    const before = rpcCalls.length;
    assert.equal((await handler!(request({ api_version: '1.0', event: { ...event, environment: 'SANDBOX' } }))).status, 200);
    assert.equal(rpcCalls.length, before);
    assert.equal((await handler!(request({ api_version: '1.0', event: { ...event, app_id: 'test_store' } }))).status, 200);
    assert.equal(rpcCalls.length, before);
    fetchFailure = true;
    assert.equal((await handler!(request({ api_version: '1.0', event }))).status, 500);
    assert.equal(rpcCalls.length, before, 'provider failure never writes a downgrade');
    fetchFailure = false;
    const future = new Date(Date.now() + 7 * 86400000).toISOString();
    for (const [entitlement, product, plan] of [
      ['OnlyFast Pro', 'app.onlyfast.pro.monthly', 'pro'],
      ['OnlyFast Teams', 'teams:teams', 'teams'],
    ]) {
      responseSubscriber = { entitlements: { [entitlement]: { product_identifier: product, expires_date: future } },
        subscriptions: { [product]: { store: plan === 'pro' ? 'app_store' : 'play_store', is_sandbox: false, expires_date: future } } };
      for (const type of ['INITIAL_PURCHASE', 'RENEWAL', 'CANCELLATION', 'UNCANCELLATION', 'PRODUCT_CHANGE', 'BILLING_ISSUE']) {
        assert.equal((await handler!(request({ api_version: '1.0', event: { ...event, type } }))).status, 200);
        assert.equal((rpcCalls.at(-1)?.p_snapshot as { plan: string }).plan, plan);
      }
    }
    responseSubscriber = { entitlements: {}, subscriptions: {} };
    assert.equal((await handler!(request({ api_version: '1.0', event: { ...event, type: 'EXPIRATION' } }))).status, 200);
    assert.equal((rpcCalls.at(-1)?.p_snapshot as { plan: string }).plan, 'free');
    // Official transfer payloads may omit environment and app_id entirely.
    const transfer = { id: 'transfer', type: 'TRANSFER', event_timestamp_ms: Date.now(), transferred_from: [uid], transferred_to: [other] };
    assert.equal((await handler!(request({ api_version: '1.0', event: transfer }))).status, 200);
    assert.deepEqual(rpcCalls.slice(-2).map(call => call.p_user_id), [uid, other]);

    await load('sync-revenuecat-subscription');
    assert.equal((await handler!(request({ plan: 'teams' }, ''))).status, 401);
    assert.equal((await handler!(request({}, 'Bearer invalid'))).status, 401);
    const response = await handler!(request({ user_id: other, plan: 'teams', status: 'active' }, 'Bearer valid-user-token'));
    assert.equal(response.status, 200);
    assert.equal(rpcCalls.at(-1)?.p_user_id, uid, 'caller cannot sync another account');
    assert.equal((rpcCalls.at(-1)?.p_snapshot as { plan: string }).plan, 'free', 'body never grants an entitlement');
    assert.equal((await response.json()).subscription.subscription_source, 'stripe', 'returns the effective database subscription');
    rpcFailure = true;
    assert.equal((await handler!(request({}, 'Bearer valid-user-token'))).status, 502);
  } finally {
    globalThis.fetch = originalFetch;
    host.Deno = originalDeno;
    delete host.__revenuecatTestClient;
  }
});
