import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

test('subscription membership writes stay bound to the original account during switching', async t => {
  const a = { access_token: 'jwt-account-a', user: { id: 'account-a' } };
  const b = { access_token: 'jwt-account-b', user: { id: 'account-b' } };
  let current = a;
  let fetchGate: ReturnType<typeof deferred<Response>> | undefined;
  let refreshGate: ReturnType<typeof deferred<{ data: { session: typeof a }; error: null }>> | undefined;
  let requestStarted = deferred<void>();
  let refreshStarted = deferred<void>();
  let refreshCalls = 0;
  const authListeners = new Set<(event: string, session: typeof a) => void>();
  const switchTo = (session: typeof a) => {
    current = session;
    for (const listener of authListeners) listener('SIGNED_IN', session);
  };
  const remote = new Map<string, unknown>();
  const cache = new Map<string, string>();
  const requests: { url: string; method: string; authorization: string | null }[] = [];
  const originalFetch = globalThis.fetch;
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const host = globalThis as typeof globalThis & { __membershipSwitchClient?: unknown };
  host.__membershipSwitchClient = {
    auth: {
      onAuthStateChange(listener: (event: string, session: typeof a) => void) {
        authListeners.add(listener);
        return { data: { subscription: { unsubscribe() { authListeners.delete(listener); } } } };
      },
      async getSession() { return { data: { session: current } }; },
      async refreshSession() {
        refreshCalls++;
        refreshStarted.resolve();
        return refreshGate ? refreshGate.promise : { data: { session: current }, error: null };
      },
      async updateUser() { assert.fail('An account-bound update must not select a new session implicitly'); },
      async setSession() { assert.fail('A delayed update must never restore an old session'); },
    },
  };
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (key: string) => cache.get(key) ?? null, setItem: (key: string, value: string) => cache.set(key, value) },
  });
  globalThis.fetch = async (input, init) => {
    const authorization = new Headers(init?.headers).get('Authorization');
    requests.push({ url: String(input), method: init?.method ?? 'GET', authorization });
    const owner = authorization === `Bearer ${a.access_token}` ? a.user.id : b.user.id;
    remote.set(owner, JSON.parse(String(init?.body)).data);
    requestStarted.resolve();
    return fetchGate ? fetchGate.promise : new Response('{}', { status: 200 });
  };
  try {
    let source = await readFile(new URL('../src/lib/membership.ts', import.meta.url), 'utf8');
    source = source.replace(/import \{ supabase, supabaseUrl, supabaseKey \} from '[^']+';/,
      "const supabase = globalThis.__membershipSwitchClient; const supabaseUrl = 'https://auth.example.invalid'; const supabaseKey = 'test-public-key';");
    source = source.replace(/import \{ isCurrentUserTestAccount \} from '[^']+';/,
      'const isCurrentUserTestAccount = () => false;');
    const compiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const membership = await import(`data:text/javascript;base64,${Buffer.from(compiled + '\n//# sourceURL=membership.account-switch.fixture.js').toString('base64')}`);
    const paid = { ...membership.DEFAULT_MEMBERSHIP, membership_tier: 'team' };
    const rookie = { ...membership.DEFAULT_MEMBERSHIP };
    const cacheKey = 'onlyfast_membership';
    const reset = () => {
      assert.equal(authListeners.size, 0, 'account-change listener must be cleaned up after each request');
      current = a; fetchGate = undefined; refreshGate = undefined;
      requestStarted = deferred<void>(); refreshStarted = deferred<void>(); refreshCalls = 0;
      remote.clear(); remote.set(b.user.id, rookie); cache.clear(); cache.set(cacheKey, JSON.stringify(rookie)); requests.length = 0;
    };

    await t.test('already switched account receives no request or cache update', async () => {
      reset(); switchTo(b);
      await membership.saveMembership(paid, a.user.id);
      assert.equal(requests.length, 0);
      assert.equal(refreshCalls, 0);
      assert.deepEqual(remote.get(b.user.id), rookie);
      assert.deepEqual(JSON.parse(cache.get(cacheKey)!), rookie);
    });

    await t.test('switch during the remote write keeps the captured JWT and skips cache refresh', async () => {
      reset(); fetchGate = deferred<Response>();
      const saving = membership.saveMembership(paid, a.user.id);
      await requestStarted.promise;
      switchTo(b);
      fetchGate.resolve(new Response('{}', { status: 200 }));
      await saving;
      assert.deepEqual(requests, [{ url: 'https://auth.example.invalid/auth/v1/user', method: 'PUT', authorization: 'Bearer jwt-account-a' }]);
      assert.deepEqual(remote.get(a.user.id), paid);
      assert.deepEqual(remote.get(b.user.id), rookie);
      assert.equal(refreshCalls, 0);
      assert.deepEqual(JSON.parse(cache.get(cacheKey)!), rookie);
    });

    await t.test('switch during session refresh cannot write the previous account into the shared cache', async () => {
      reset(); refreshGate = deferred<{ data: { session: typeof a }; error: null }>();
      const saving = membership.saveMembership(paid, a.user.id);
      await refreshStarted.promise;
      switchTo(b);
      // A refresh response can describe the account at request time even though
      // a newer login is now current. Do not treat that response as current state.
      refreshGate.resolve({ data: { session: a }, error: null });
      await saving;
      assert.deepEqual(remote.get(b.user.id), rookie);
      assert.equal(current.user.id, b.user.id);
      assert.deepEqual(JSON.parse(cache.get(cacheKey)!), rookie);
    });

    await t.test('unchanged account still refreshes and caches the confirmed membership', async () => {
      reset();
      await membership.saveMembership(paid, a.user.id);
      assert.deepEqual(remote.get(a.user.id), paid);
      assert.deepEqual(remote.get(b.user.id), rookie);
      assert.equal(refreshCalls, 1);
      assert.deepEqual(JSON.parse(cache.get(cacheKey)!), paid);
    });
    assert.equal(authListeners.size, 0, 'successful request must unsubscribe its account guard');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
    delete host.__membershipSwitchClient;
  }
});
