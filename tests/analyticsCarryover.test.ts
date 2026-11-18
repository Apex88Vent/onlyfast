import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { FIREBASE_PUBLIC_ENV_KEYS, verifyAnalyticsEnvironment, verifyAnalyticsSources } from '../scripts/verify-analytics-integration.mjs';

const require = createRequire(import.meta.url);
const React = require('react');
const renderer = require('react-test-renderer');
const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

test('Firebase source and release configuration cannot disappear without a failing carryover check', async () => {
  await verifyAnalyticsSources(fileURLToPath(new URL('../', import.meta.url)));
  const config = Object.fromEntries(FIREBASE_PUBLIC_ENV_KEYS.map(key => [key, key === 'VITE_FIREBASE_MEASUREMENT_ID' ? 'G-TEST' : 'public-test-value']));
  verifyAnalyticsEnvironment({ ...config, VITE_ANALYTICS_ENABLED: 'true' }, true);
  assert.throws(() => verifyAnalyticsEnvironment({ ...config, VITE_ANALYTICS_ENABLED: 'false' }, true), /January analytics release/);
  for (const key of FIREBASE_PUBLIC_ENV_KEYS) assert.throws(() => verifyAnalyticsEnvironment({ ...config, [key]: '', VITE_ANALYTICS_ENABLED: 'true' }, true), /Missing public Firebase/);
});

for (const [preview, testing] of [[false, false], [true, false], [true, true]]) {
  test(`shared analytics startup precedes app entry (2027=${preview}, testing=${testing})`, async () => {
    const events: string[] = [];
    const source = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8').replaceAll('import.meta.env', 'testEnv');
    const code = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    const dependencies = {
      'react/jsx-runtime': { jsx: () => ({}) }, './index.css': {},
      'react-dom/client': { createRoot: () => ({ render: () => events.push('render') }) },
      './lib/analytics': { startAnalytics: () => events.push('analytics') },
      './testingEntry': { mountTestingApp: () => events.push('testing-app') },
      './App': { default: () => null }, './pages/Phase2027Preview': { default: () => null },
    };
    new Function('require', 'exports', 'testEnv', 'document', code)((name: keyof typeof dependencies) => {
      assert.ok(name in dependencies); return dependencies[name];
    }, {}, { ONLYFAST_2027_PREVIEW: preview, ONLYFAST_2027_APP: testing }, { getElementById: () => ({}) });
    await settle();
    assert.deepEqual(events, ['analytics', testing ? 'testing-app' : 'render']);
  });
}

function component(file: string, analytics: Record<string, unknown>) {
  const source = readFileSync(new URL('../src/components/' + file, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const output: { default?: () => unknown } = {};
  new Function('require', 'exports', code)((name: string) => {
    if (name === '@/lib/analytics') return analytics;
    if (name === 'react' || name === 'react/jsx-runtime') return require(name);
    throw Error('Unexpected privacy dependency ' + name);
  }, output);
  return output.default;
}

test('essential-cookie buttons decline analytics; only explicit Allow Analytics grants permission', async () => {
  const original = globalThis.localStorage;
  try {
    for (const label of ['Accept Essential', 'Decline Optional', 'Allow Analytics']) {
      const choices: string[] = [];
      // A prior essential-cookie choice is not analytics permission.
      const stored = new Map([['onlyfast_cookie_consent', 'accepted']]);
      Object.assign(globalThis, { localStorage: { getItem: (key: string) => stored.get(key) || null, setItem: (key: string, value: string) => stored.set(key, value) } });
      const CookieConsent = component('CookieConsent.tsx', { getAnalyticsConsent: () => 'unknown', setAnalyticsConsent: (choice: string) => choices.push(choice) });
      let view: ReturnType<typeof renderer.create>;
      await renderer.act(async () => { view = renderer.create(React.createElement(CookieConsent)); });
      const buttons = view.root.findAllByType('button');
      const button = buttons.find((node: { children: string[] }) => node.children.join('') === label);
      assert.ok(button);
      await renderer.act(async () => { button.props.onClick(); });
      assert.deepEqual(choices, [label === 'Allow Analytics' ? 'granted' : 'denied']);
      await renderer.act(async () => view.unmount());
    }
  } finally { Object.assign(globalThis, { localStorage: original }); }
});

test('privacy control supports explicit opt-in and withdrawal without turning on a held build', async () => {
  let choice = 'unknown'; const listeners = new Set<() => void>();
  const Privacy = component('AnalyticsPrivacyControl.tsx', {
    getAnalyticsConsent: () => choice, analyticsEnabledInBuild: () => false,
    subscribeAnalyticsConsent: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); },
    setAnalyticsConsent: (value: string) => { choice = value; listeners.forEach(listener => listener()); },
  });
  let view: ReturnType<typeof renderer.create>;
  await renderer.act(async () => { view = renderer.create(React.createElement(Privacy)); });
  const text = () => JSON.stringify(view.toJSON());
  assert.match(text(), /Collection is disabled/);
  const buttons = view.root.findAllByType('button');
  await renderer.act(async () => buttons[1].props.onClick());
  assert.equal(choice, 'granted'); assert.match(text(), /Analytics permission allowed/);
  await renderer.act(async () => buttons[0].props.onClick());
  assert.equal(choice, 'denied'); assert.match(text(), /Analytics permission declined/);
  assert.match(text(), /Collection is disabled/);
  await renderer.act(async () => view.unmount());
});
