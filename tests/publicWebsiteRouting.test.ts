import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import React from 'react';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const { create, act } = require('react-test-renderer');
type TestSession = { user: { id: string }; access_token: string; expires_at?: number } | null;
type AuthListener = (event: string, session: TestSession) => void;
type EntryState = { session: TestSession; checking: boolean; error: boolean; recovery: boolean };
type TestTree = { toJSON(): unknown; unmount(): void; update(element: React.ReactElement): void };
type EntryModule = { default: React.ComponentType };
type SessionModule = { useEntrySession(): EntryState };
type BackModule = {
  recordSafeBackRoute(path: string): void;
  recordSafeBackDashboardView(view: string): void;
  safeBack(navigate: (path: string) => void): void;
  consumePendingSafeBackDashboardView(): string | null;
};
function compile<T>(file: string, mocks: Record<string, unknown>, env = {}): T {
  const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8')
    .replaceAll('import.meta.env', `(${JSON.stringify(env)})`);
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true,
    },
  }).outputText;
  const output = { exports: {} as T };
  new Function('require', 'module', 'exports', code)(
    (name: string) => {
      if (name in mocks) return mocks[name];
      return require(name);
    },
    output,
    output.exports,
  );
  return output.exports;
}
const component = (label: string) => () => React.createElement('div', {}, label);
const session = { user: { id: 'preview-user' }, access_token: 'test-token', expires_at: Math.floor(Date.now() / 1000) + 3600 };
const settleValidation = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); });

function entry(native: boolean, pathname: string, auth: Record<string, unknown>) {
  let hookCalls = 0;
  const Page = compile<EntryModule>('pages/AppEntry.tsx', {
    '@/lib/paymentVisibility': { isNativeApp: native },
    '@/hooks/useEntrySession': {
      useEntrySession: () => {
        hookCalls++;
        return auth;
      },
    },
    './Index': { __esModule: true, default: component('Existing app, auth and onboarding') },
    './PublicHome': { __esModule: true, default: component('Public marketing homepage') },
    '@/components/AuthModal': { __esModule: true, default: component('Existing Supabase login') },
    'react-router-dom': {
      useLocation: () => ({ pathname, search: '?shared=preserve-me', hash: '#details' }),
      useNavigate: () => () => {},
      Navigate: ({ to }: { to: string }) => React.createElement('div', { 'data-redirect': to }),
      Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) =>
        React.createElement('a', { href: to, ...props }, children),
    },
  }).default;
  let tree!: TestTree;
  act(() => {
    tree = create(React.createElement(Page));
  });
  return { tree, hookCalls, html: JSON.stringify(tree.toJSON()) };
}

test('native entry bypasses the public gate and keeps all authentication in the existing app', () => {
  for (const path of ['/', '/app', '/login']) {
    const result = entry(true, path, {});
    assert.equal(result.hookCalls, 0);
    assert.match(result.html, /Existing app, auth and onboarding/);
    assert.doesNotMatch(result.html, /marketing/);
  }
});
test('session checks never flash marketing or login', () => {
  for (const path of ['/', '/app']) {
    const { html } = entry(false, path, { checking: true });
    assert.match(html, /Loading OnlyFast/);
    assert.doesNotMatch(html, /marketing|Existing Supabase login/);
  }
});
test('browser root shows marketing only when unauthenticated', () => {
  assert.match(entry(false, '/', { session: null }).html, /Public marketing homepage/);
  const { html } = entry(false, '/', { session });
  assert.match(html, /\/app\?shared=preserve-me#details/);
  assert.doesNotMatch(html, /marketing/);
});
test('browser app and login entries use existing login or app based on the session', () => {
  for (const path of ['/app', '/login'])
    assert.match(entry(false, path, { session: null }).html, /Existing Supabase login/);
  assert.match(entry(false, '/app', { session }).html, /Existing app, auth and onboarding/);
  assert.match(entry(false, '/login', { session }).html, /\/app\?shared=preserve-me#details/);
});
test('recovery takes priority over an authenticated app redirect and preserves callback parameters', () => {
  assert.match(
    entry(false, '/', { session, recovery: true }).html,
    /\/reset-password\?shared=preserve-me#details/,
  );
});
test('session failures offer retry without clearing sessions or showing marketing', () => {
  const { html } = entry(false, '/', { error: true });
  assert.match(html, /Unable to check your session/);
  assert.doesNotMatch(html, /marketing|Existing Supabase login/);
});

test('entry session ignores stale initial reads, handles signout and cleans up listeners', async () => {
  let listener!: AuthListener;
  let resolveInitial!: (value: { data: { session: TestSession }; error: null }) => void;
  let unsubscribed = false;
  const { useEntrySession } = compile<SessionModule>('hooks/useEntrySession.ts', {
    '@/lib/supabase': {
      supabase: {
        auth: {
          onAuthStateChange: (callback: AuthListener) => {
            listener = callback;
            return {
              data: {
                subscription: {
                  unsubscribe: () => {
                    unsubscribed = true;
                  },
                },
              },
            };
          },
          getSession: () =>
            new Promise<{ data: { session: TestSession }; error: null }>((resolve) => {
              resolveInitial = resolve;
            }),
          getUser: async () => ({ data: { user: session.user }, error: null }),
        },
      },
    },
  });
  let state!: EntryState;
  const Harness = () => {
    state = useEntrySession();
    return null;
  };
  let tree!: TestTree;
  act(() => {
    tree = create(React.createElement(Harness));
  });
  assert.equal(state.checking, true);
  act(() => listener('SIGNED_IN', session));
  assert.equal(state.session, null);
  await settleValidation();
  assert.equal(state.session, session);
  await act(async () => resolveInitial({ data: { session: null }, error: null }));
  assert.equal(state.session, session);
  act(() => listener('TOKEN_REFRESHED', session));
  assert.equal(state.session, session);
  act(() => listener('SIGNED_OUT', null));
  assert.equal(state.session, null);
  assert.equal(state.checking, false);
  act(() => tree.unmount());
  assert.equal(unsubscribed, true);
});

test('initial session failures are visible and password recovery events survive follow-up auth events', async () => {
  let listener!: AuthListener;
  const { useEntrySession } = compile<SessionModule>('hooks/useEntrySession.ts', {
    '@/lib/supabase': {
      supabase: {
        auth: {
          onAuthStateChange: (callback: AuthListener) => {
            listener = callback;
            return { data: { subscription: { unsubscribe() {} } } };
          },
          getSession: async () => {
            throw new Error('offline');
          },
          getUser: async () => ({ data: { user: session.user }, error: null }),
        },
      },
    },
  });
  let state!: EntryState;
  const Harness = () => {
    state = useEntrySession();
    return null;
  };
  let tree!: TestTree;
  await act(async () => {
    tree = create(React.createElement(Harness));
  });
  assert.equal(state.error, true);
  act(() => listener('PASSWORD_RECOVERY', session));
  act(() => listener('SIGNED_IN', session));
  assert.equal(state.recovery, true);
  act(() => tree.unmount());
});

test('persisted payment flags cannot classify ordinary browsers as native or hide browser payments', () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const cases = [
    { ua: 'Windows Chrome', search: '', bridge: false, native: false },
    { ua: 'Android Chrome', search: '', bridge: false, native: false },
    { ua: 'iPhone Safari', search: '', bridge: false, native: false },
    { ua: 'MedianAndroid/1.0', search: '', bridge: false, native: true },
    { ua: 'MedianIOS/1.0', search: '?nativeApp=false', bridge: false, native: true },
    { ua: 'GoNativeAndroid/1.0', search: '', bridge: false, native: true },
    { ua: 'GoNativeIOS/1.0', search: '', bridge: false, native: true },
    { ua: 'Android WebView', search: '', bridge: true, native: true },
    { ua: 'Windows Chrome', search: '?nativeApp=true', bridge: false, native: true },
  ];
  const native = compile<{ isMedianIOS: () => boolean; isMedianUserAgent(ua: string): boolean; isNativeAppContext(search: string, ua: string, bridge: boolean): boolean }>('lib/nativeEnvironment.ts', {});
  try {
    for (const c of cases) {
      const storage = new Map([['onlyfast_hide_external_payments', 'true'], ['saved-setting', 'keep']]);
      let cleaned = false;
      const window = {
        location: { search: c.search, href: `https://onlyfast.app/${c.search}` },
        history: { state: {}, replaceState() { cleaned = true; } },
        localStorage: { getItem: (key: string) => storage.get(key), setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) },
        ...(c.bridge ? { median: {} } : {}),
      };
      Object.defineProperty(globalThis, 'window', { configurable: true, value: window });
      Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userAgent: c.ua } });
      const result = compile<{ isNativeApp: boolean; hideExternalPayments: boolean }>('lib/paymentVisibility.ts', { './nativeEnvironment': native });
      assert.equal(result.isNativeApp, c.native, c.ua);
      assert.equal(result.hideExternalPayments, c.native, c.ua);
      assert.equal(storage.get('saved-setting'), 'keep');
      if (c.search === '?nativeApp=true' && !c.bridge && !/median|gonative/i.test(c.ua)) assert.equal(cleaned, false);
      const preference = compile<{ isNativeApp: boolean; hideExternalPayments: boolean }>('lib/paymentVisibility.ts', { './nativeEnvironment': native }, { VITE_HIDE_EXTERNAL_PAYMENTS: 'true' });
      assert.equal(preference.isNativeApp, c.native);
      assert.equal(preference.hideExternalPayments, true);
    }
  } finally {
    for (const [name, descriptor] of [['window', previousWindow], ['navigator', previousNavigator]] as const) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
});

function mountedSessionGate(initial: TestSession, verify: (token: string) => Promise<{ data: { user: { id: string } | null }; error: unknown }>) {
  let listener!: AuthListener;
  let state!: EntryState;
  const { useEntrySession } = compile<SessionModule>('hooks/useEntrySession.ts', {
    '@/lib/supabase': { supabase: { auth: {
      getSession: async () => ({ data: { session: initial }, error: null }),
      getUser: verify,
      onAuthStateChange: (callback: AuthListener) => {
        listener = callback;
        return { data: { subscription: { unsubscribe() {} } } };
      },
    } } },
  });
  const Harness = () => { state = useEntrySession(); return null; };
  let tree!: TestTree;
  act(() => { tree = create(React.createElement(Harness)); });
  return { state: () => state, emit: (event: string, next: TestSession) => act(() => listener(event, next)), unmount: () => act(() => tree.unmount()) };
}

test('browser sessions are accepted only after a current server user check', async () => {
  for (const [user, error] of [[null, { status: 401 }], [null, { status: 403 }], [null, null], [{ id: 'different-user' }, null], [session.user, null]] as const) {
    let requestedToken = '';
    const gate = mountedSessionGate(session, async token => { requestedToken = token; return { data: { user }, error }; });
    await settleValidation(); await settleValidation();
    assert.equal(requestedToken, session.access_token);
    assert.equal(gate.state().session, user?.id === session.user.id && !error ? session : null);
    assert.equal(gate.state().error, false);
    gate.unmount();
  }
});

test('expired candidates never count as authenticated and transient verification failures preserve retry', async () => {
  let calls = 0;
  const expired = mountedSessionGate({ ...session, expires_at: 1 }, async () => { calls++; return { data: { user: session.user }, error: null }; });
  await settleValidation();
  assert.equal(expired.state().session, null); assert.equal(expired.state().checking, false); assert.equal(calls, 0); expired.unmount();
  const offline = mountedSessionGate(session, async () => { throw new Error('offline'); });
  await settleValidation(); await settleValidation();
  assert.equal(offline.state().session, null); assert.equal(offline.state().error, true); offline.unmount();
});

test('logout cannot be undone by delayed user verification', async () => {
  let resolve!: (result: { data: { user: { id: string } }; error: null }) => void;
  const gate = mountedSessionGate(session, () => new Promise(done => { resolve = done; }));
  await settleValidation(); await settleValidation();
  gate.emit('SIGNED_OUT', null);
  await act(async () => resolve({ data: { user: session.user }, error: null }));
  assert.equal(gate.state().session, null); assert.equal(gate.state().checking, false);
  gate.unmount();
});

test('a transient refresh validation failure retains a previously verified unexpired session', async () => {
  let offline = false;
  const gate = mountedSessionGate(session, async () => {
    if (offline) throw new Error('offline');
    return { data: { user: session.user }, error: null };
  });
  await settleValidation(); await settleValidation();
  assert.equal(gate.state().session, session);
  offline = true;
  gate.emit('TOKEN_REFRESHED', { ...session, access_token: 'refreshed-token' });
  assert.equal(gate.state().checking, false);
  await settleValidation();
  assert.equal(gate.state().session, session); assert.equal(gate.state().error, false);
  gate.emit('SIGNED_OUT', null);
  assert.equal(gate.state().session, null);
  gate.unmount();
});

test('safe back preserves dashboard views at /app without installing native browser history guards', async () => {
  const previousWindow = globalThis.window;
  let guards = 0;
  const navigations: string[] = [];
  const events: Event[] = [];
  globalThis.window = {
    history: {
      state: {},
      replaceState() {},
      pushState() {
        guards++;
      },
    },
    location: { href: 'http://localhost/app' },
    dispatchEvent: (event: Event) => {
      events.push(event);
      return true;
    },
    setTimeout,
  } as unknown as Window & typeof globalThis;
  try {
    const back = compile<BackModule>('lib/safeBack.ts', {
      './paymentVisibility': { isNativeApp: false },
    });
    back.recordSafeBackRoute('/app?shared=keep');
    back.recordSafeBackDashboardView('saved');
    back.recordSafeBackRoute('/upgrade');
    back.safeBack((path: string) => navigations.push(path));
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.deepEqual(navigations, ['/app?shared=keep']);
    assert.equal(back.consumePendingSafeBackDashboardView(), 'saved');
    assert.equal(guards, 0);
    assert.equal((events[0] as CustomEvent).detail.view, 'saved');
  } finally {
    globalThis.window = previousWindow;
  }
});

test('app provider preserves advertising route support on both dashboard aliases and excludes other pages', () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  globalThis.window = {} as Window & typeof globalThis;
  globalThis.document = {} as Document;
  let pathname = '/';
  const supported: boolean[] = [];
  const { AppProvider } = compile<{ AppProvider: React.ComponentType<React.PropsWithChildren> }>(
    'contexts/AppContext.tsx',
    {
      '@/lib/nativePurchases': { watchNativePurchases: () => () => {} },
      '@/lib/nativeAds': {
        nativeAds: { setRouteSupported: (value: boolean) => supported.push(value) },
        watchNativeAds: () => () => {},
      },
      '@/lib/nativeBannerSafety': { watchNativeBannerSafety: () => () => {} },
      '@/lib/supabase': { supabase: {} },
      'react-router-dom': { useLocation: () => ({ pathname }) },
    },
  );
  let tree!: TestTree;
  try {
    act(() => {
      tree = create(React.createElement(AppProvider));
    });
    assert.equal(supported.at(-1), true);
    for (const path of ['/app', '/support', '/upgrade', '/reset-password', '/']) {
      pathname = path;
      act(() => tree.update(React.createElement(AppProvider)));
      assert.equal(supported.at(-1), path === '/' || path === '/app', path);
    }
    act(() => tree.unmount());
    assert.equal(supported.at(-1), false);
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
  }
});
