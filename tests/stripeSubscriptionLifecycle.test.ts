import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

test('signed Stripe lifecycle reconciles current provider state, records item-level periods, and never revokes on an old invoice failure', async () => {
  const source = readFileSync(new URL('../supabase/functions/stripe-webhook/index.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  let handler!: (req: Request) => Promise<Response>;
  let current: Record<string, unknown>;
  let fail = false;
  const writes: Array<Record<string, unknown>> = []; const requests: string[] = [];
  const future = Math.floor(Date.now() / 1000) + 3600;
  const uid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const env: Record<string, string> = { STRIPE_WEBHOOK_SECRET: 'fixture-signing-secret', STRIPE_SECRET_KEY: 'server-fixture-key',
    PROJECT_URL: 'https://fixture.invalid', SUPABASE_SERVICE_ROLE_KEY: 'server-only-fixture', STRIPE_PRO_PRICE_ID: 'price_pro', STRIPE_TEAMS_PRICE_ID: 'price_teams' };
  const before = Object.getOwnPropertyDescriptor(globalThis, 'Deno'); const fetchBefore = globalThis.fetch;
  Object.defineProperty(globalThis, 'Deno', { configurable: true, value: { env: { get: (key: string) => env[key] }, serve: (fn: typeof handler) => { handler = fn; } } });
  globalThis.fetch = async (input, init) => {
    requests.push(String(input)); assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer server-fixture-key');
    return new Response(JSON.stringify(fail ? { error: { message: 'Provider unavailable' } } : current), { status: fail ? 503 : 200 });
  };
  const query = { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: { user_id: uid } }),
    upsert: async (row: Record<string, unknown>) => { writes.push(row); return { error: null }; } };
  const invoke = async (event: unknown, valid = true) => {
    const body = JSON.stringify(event); const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac('sha256', env.STRIPE_WEBHOOK_SECRET).update(`${timestamp}.${body}`).digest('hex');
    return handler(new Request('https://fixture.invalid/webhook', { method: 'POST', body,
      headers: { 'stripe-signature': valid ? `t=${timestamp},v1=${signature}` : 't=1,v1=invalid' } }));
  };
  const provider = (plan: string, status: string, legacy = false) => ({ id: 'sub_verified', customer: 'cus_verified', status,
    metadata: { user_id: uid }, cancel_at_period_end: true,
    ...(legacy ? { current_period_end: future } : {}),
    items: { data: [{ price: { id: `price_${plan}` }, ...(!legacy ? { current_period_end: future } : {}) }] } });
  try {
    new Function('require', 'exports', js)(() => ({ createClient: () => ({ from: () => query }) }), {});
    const event = { type: 'customer.subscription.updated', data: { object: { id: 'sub_verified', status: 'active', metadata: { plan: 'teams' } } } };
    assert.equal((await invoke(event, false)).status, 401); assert.equal(requests.length, 0); assert.equal(writes.length, 0);
    for (const [plan, status, legacy] of [['pro', 'active', false], ['teams', 'active', true], ['pro', 'active', false],
      ['pro', 'canceled', false], ['teams', 'canceled', false], ['pro', 'trialing', false], ['pro', 'active', false]] as const) {
      current = provider(plan, status, legacy);
      assert.equal((await invoke(event)).status, 200);
      assert.equal(writes.at(-1)?.plan, plan); assert.equal(writes.at(-1)?.status, status);
      assert.equal(writes.at(-1)?.current_period_end, new Date(future * 1000).toISOString());
      assert.equal(writes.at(-1)?.user_id, uid);
    }
    current = provider('pro', 'active');
    assert.equal((await invoke({ type: 'invoice.payment_failed', data: { object: { subscription: 'sub_verified' } } })).status, 200);
    assert.equal(writes.at(-1)?.status, 'active', 'a delayed invoice failure cannot override confirmed renewal');
    const count = writes.length;
    current = { ...provider('pro', 'active'), status: undefined };
    assert.equal((await invoke(event)).status, 500); assert.equal(writes.length, count, 'malformed provider status cannot revoke or grant access');
    fail = true;
    assert.equal((await invoke(event)).status, 500); assert.equal(writes.length, count, 'failed confirmation must not rewrite entitlements');
  } finally {
    globalThis.fetch = fetchBefore;
    if (before) Object.defineProperty(globalThis, 'Deno', before); else Reflect.deleteProperty(globalThis, 'Deno');
  }
});
