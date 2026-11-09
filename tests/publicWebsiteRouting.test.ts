import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import React from 'react';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const { create, act } = require('react-test-renderer');
type TestSession = { user: { id: string } } | null;
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
function compile<T>(file: string, mocks: Record<string, unknown>): T {
  const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
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
const session = { user: { id: 'preview-user' } };

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
