// Mounted diagnostic UI with synthetic bridge responses. This is not evidence
// of an actual native device/transaction. Reuse the existing external QA renderer.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';
import * as policy from '../src/lib/nativeSandboxPolicy.ts';
import * as catalog from '../src/lib/nativeCatalogDiagnostic.ts';
import { isMedianUserAgent } from '../src/lib/nativeEnvironment.ts';

const qaRequire = createRequire(process.env.REACT_TEST_RENDERER_MODULE);
const React = qaRequire('react');
const { create, act } = qaRequire(process.env.REACT_TEST_RENDERER_MODULE);
const anon = 'a.' + btoa(JSON.stringify({ role: 'anon' })) + '.b';
const text = node => node == null ? '' : typeof node === 'string' ? node :
  Array.isArray(node) ? node.map(text).join(' ') : (node.children || []).map(text).join(' ');

function component(client) {
  const source = readFileSync(new URL('../src/pages/NativeSubscriptionTest.tsx', import.meta.url), 'utf8')
    .replaceAll('import.meta.env.MODE', JSON.stringify('native-sandbox'));
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const module = { exports: {} };
  const modules = {
    react: React,
    'react-router-dom': { Link: ({ to, children }) => React.createElement('a', { href: to }, children) },
    '@/lib/supabase': { supabase: client, supabaseUrl: 'http://127.0.0.1:54321', supabaseKey: anon },
    '@/lib/nativeEnvironment': { isMedianUserAgent },
    '@/lib/nativeSandboxPolicy': policy,
    '@/lib/nativeCatalogDiagnostic': catalog,
  };
  new Function('require', 'module', 'exports', code)(id => modules[id] || qaRequire(id), module, module.exports);
  return module.exports.default;
}

test('mounted diagnostic displays actual fields, clears revoked sessions and never exposes purchase controls', async () => {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const calls = [];
  let authorized = true;
  let authCallback;
  let uid = 'synthetic-local-a';
  let renderer;
  const client = {
    auth: {
      onAuthStateChange: callback => { authCallback = callback; return { data: { subscription: { unsubscribe() {} } } }; },
      getUser: async () => ({ data: { user: { id: uid } }, error: null }),
    },
    from: table => ({ select() { return this; }, eq() { return this; },
      maybeSingle: async () => ({ data: authorized ? { is_test_account: true, beta_features_enabled: true, tester_kind: 'experimental' } : null }),
      then: resolve => Promise.resolve({ data: [{ feature_key: policy.NATIVE_TEST_FEATURE, enabled: true }] }).then(resolve),
    }),
  };
  const bridge = {
    isInitialized: async () => { calls.push('isInitialized'); return { initialized: true }; },
    getOfferings: async () => { calls.push('getOfferings'); return { all: { onlyfast_monthly_v1: {
      identifier: 'onlyfast_monthly_v1', packages: [{ identifier: '$rc_monthly', product: {
        identifier: 'pro:pro', priceString: '4,99 €', title: '<script>untrusted store title</script>',
      } }],
    } } }; },
    purchase: () => { throw new Error('Must never purchase'); },
    restorePurchases: () => { throw new Error('Must never restore'); },
  };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { median: { revenueCat: bridge } } });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userAgent: 'MedianAndroid/1.0' } });
  try {
    const Diagnostic = component(client);
    await act(async () => { renderer = create(React.createElement(Diagnostic)); });
    const check = () => renderer.root.findAllByType('button').find(button => text(button.props.children) === 'Read initialization and offerings').props.onClick();
    await act(async () => { check(); });
    let ui = text(renderer.toJSON());
    assert.match(ui, /4,99 €/);
    assert.match(ui, /pro:pro/);
    assert.match(ui, /Exact identifier observed/);
    assert.match(ui, /does not prove it can be selected/);
    assert.match(ui, /not exposed by the documented bridge/);
    assert.equal(renderer.root.findAllByType('script').length, 0);
    assert.deepEqual(calls, ['isInitialized', 'getOfferings']);
    assert.equal(renderer.root.findAllByType('button').length, 2);
    await act(async () => { authorized = false; authCallback(); });
    ui = text(renderer.toJSON());
    assert.doesNotMatch(ui, /4,99 €|Exact identifier observed/);
    await act(async () => { check(); });
    assert.match(text(renderer.toJSON()), /explicitly authorized experimental tester/);
    assert.deepEqual(calls, ['isInitialized', 'getOfferings']);

    // An old account's delayed catalog must never appear after an auth change.
    authorized = true;
    let finish;
    let started;
    const pending = new Promise(resolve => { started = resolve; });
    bridge.getOfferings = () => { started(); return new Promise(resolve => { finish = resolve; }); };
    await act(async () => { check(); await pending; uid = 'synthetic-local-b'; authCallback(); finish({ identifiers: ['old-account-catalog'] }); });
    assert.doesNotMatch(text(renderer.toJSON()), /old-account-catalog|Device responses/);
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow); else delete globalThis.window;
    if (oldNavigator) Object.defineProperty(globalThis, 'navigator', oldNavigator); else delete globalThis.navigator;
  }
});
