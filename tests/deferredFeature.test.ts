import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import * as startupRecovery from '../src/lib/startupRecovery.ts';

const require = createRequire(import.meta.url);
const React = require('react');
const { act, create } = require('react-test-renderer');
const compiled = ts.transpileModule(readFileSync(new URL('../src/components/DeferredFeature.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText;
const module = { exports: {} as any };
new Function('require', 'module', 'exports', compiled)(
  (name: string) => name === '@/lib/startupRecovery' ? startupRecovery : require(name), module, module.exports,
);
const { deferredFeature, deferredFeatureExport, resolveRetriedFeature } = module.exports;
const h = React.createElement;

test('a successful retry import selects the expected Vite namespace rather than an undefined or unrelated default', () => {
  const expected = deferredFeatureExport(() => h('span', null, 'expected'), 'scanner');
  const neighbor = deferredFeatureExport(() => h('span', null, 'wrong'), 'another tool');
  const grouped = { default: neighbor, S: { [Symbol.toStringTag]: 'Module', default: expected } };
  assert.equal(resolveRetriedFeature(grouped, 'scanner'), expected);
  assert.equal(resolveRetriedFeature({ default: expected }, 'scanner'), expected);
  assert.throws(() => resolveRetriedFeature(grouped, 'unknown'), /Unexpected deferred feature export/);
});

test('an undefined import default stays in the error boundary and the next valid retry mounts', async () => {
  const feature = deferredFeature(() => Promise.resolve({ default: ++loads === 1 ? undefined : () => h('span', null, 'mounted') }), 'fixture');
  const original = console.error;
  let loads = 0;
  let tree: any;
  console.error = () => {};
  try {
    await act(async () => { tree = create(h(feature.Component)); });
    assert(tree.root.findByProps({ role: 'alert' }));
    await act(async () => tree.root.findByType('button').props.onClick());
    assert.equal(tree.root.findByType('span').children[0], 'mounted');
  } finally { console.error = original; tree?.unmount(); }
});

test('deferred feature loads only on demand and shares an in-flight preload', async () => {
  let resolve: any;
  let calls = 0;
  const modulePromise = new Promise(r => { resolve = r; });
  const feature = deferredFeature(() => { calls++; return modulePromise; }, 'fixture');
  assert.equal(calls, 0);
  const pending = feature.preload();
  assert.equal(feature.preload(), pending);
  let tree: any;
  await act(async () => { tree = create(h(feature.Component)); });
  assert.equal(calls, 1);
  assert.equal(tree.root.findByProps({ role: 'status' }).children[0], 'Loading ');
  await act(async () => { resolve({ default: () => h('span', null, 'ready') }); await pending; });
  assert.equal(tree.root.findByType('span').children[0], 'ready');
  tree.unmount();
});

test('loading, settling, and parent rerenders preserve the parent draft and mounted feature', async () => {
  let resolve: any;
  let mounts = 0;
  const feature = deferredFeature(() => new Promise(r => { resolve = r; }), 'fixture');
  function Child() { React.useEffect(() => { mounts++; }, []); return h('span', null, 'ready'); }
  function Parent({ account }: { account: string }) {
    const [draft, setDraft] = React.useState('unsaved');
    return h('section', null, h('input', { value: draft, onChange: setDraft }), h(feature.Component, { key: account }));
  }
  let tree: any;
  await act(async () => { tree = create(h(Parent, { account: 'A' })); });
  await act(async () => { tree.root.findByType('input').props.onChange('edited during loading'); });
  await act(async () => { resolve({ default: Child }); });
  await act(async () => { tree.update(h(Parent, { account: 'A' })); });
  assert.equal(tree.root.findByType('input').props.value, 'edited during loading');
  assert.equal(mounts, 1);
  await act(async () => { tree.update(h(Parent, { account: 'B' })); });
  assert.equal(mounts, 2, 'the existing account key still remounts the feature for another owner');
  tree.unmount();
});

test('a completed preload renders immediately without a new loading fallback', async () => {
  const feature = deferredFeature(() => Promise.resolve({ default: () => h('span', null, 'preloaded') }), 'fixture');
  await feature.preload();
  let tree: any;
  act(() => { tree = create(h(feature.Component)); });
  assert.equal(tree.root.findByType('span').children[0], 'preloaded');
  assert.equal(tree.root.findAllByProps({ role: 'status' }).length, 0);
  tree.unmount();
});

test('failed chunk has a manual retry and preserves the parent without reloading', async () => {
  let calls = 0;
  const feature = deferredFeature(() => ++calls === 1 ? Promise.reject(new Error('offline')) : Promise.resolve({ default: () => h('span', null, 'recovered') }), 'fixture');
  let tree: any;
  const original = console.error;
  console.error = () => {};
  try {
    function Parent() { const [draft] = React.useState('keep me'); return h('section', null, h('input', { value: draft }), h(feature.Component)); }
    await act(async () => { tree = create(h(Parent)); });
    assert(tree.root.findByProps({ role: 'alert' }));
    assert.equal(calls, 1, 'no automatic retry');
    await act(async () => { tree.root.findByType('button').props.onClick(); });
    assert.equal(calls, 2);
    assert.equal(tree.root.findByType('span').children[0], 'recovered');
    assert.equal(tree.root.findByType('input').props.value, 'keep me');
    await act(async () => { tree.unmount(); tree = create(h(Parent)); });
    assert.equal(tree.root.findByType('span').children[0], 'recovered', 'reopening does not replay a cached rejection');
    assert.equal(calls, 2);
  } finally { console.error = original; tree?.unmount(); }
});

test('retry never dynamically imports remote, credentialed, or unrecognized error URLs', async () => {
  const previousWindow = (globalThis as any).window;
  (globalThis as any).window = { location: { origin: 'https://onlyfast.invalid' } };
  const original = console.error;
  console.error = () => {};
  try {
    for (const address of [
      'https://foreign.invalid/assets/Parts-abc.js',
      'https://user:password@onlyfast.invalid/assets/Parts-abc.js',
      'https://onlyfast.invalid/foreign.js',
      'https://onlyfast.invalid/assets/Parts-abc.js?token=untrusted',
    ]) {
      let calls = 0;
      const feature = deferredFeature(() => ++calls === 1
        ? Promise.reject(new TypeError(`Failed to fetch dynamically imported module: ${address}`))
        : Promise.resolve({ default: () => h('span', null, 'safe loader') }), 'fixture');
      let tree: any;
      await act(async () => { tree = create(h(feature.Component)); });
      await act(async () => { tree.root.findByType('button').props.onClick(); });
      assert.equal(calls, 2, address);
      assert.equal(tree.root.findByType('span').children[0], 'safe loader');
      tree.unmount();
    }
  } finally { console.error = original; (globalThis as any).window = previousWindow; }
});
