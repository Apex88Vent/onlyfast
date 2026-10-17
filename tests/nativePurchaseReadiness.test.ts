import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import { NATIVE_PURCHASES_READY, NativePurchaseController } from '../src/lib/nativePurchaseController.ts';

function client() {
  let calls = 0;
  const code = ts.transpileModule(readFileSync(new URL('../src/lib/nativePurchases.ts', import.meta.url), 'utf8')
    .replaceAll('import.meta.env', '__env'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} as { nativePurchasesEnabled: boolean; nativePurchases: NativePurchaseController; syncNativeSubscription(id: string): Promise<void> } };
  const modules = {
    './nativePurchaseController': { NATIVE_PURCHASES_READY, NativePurchaseController },
    './paymentVisibility': { hideExternalPayments: true },
    './nativeEnvironment': { nativePlatform: () => 'android' },
    './membershipLifecycle': {}, './trustedMembership': {}, './subscription': {},
    './supabase': { supabase: {
      auth: { getSession: async () => ({ data: { session: { user: { id: 'local-test-uuid' }, access_token: 'synthetic-token' } } }) },
      functions: { invoke: async () => { calls++; return { data: { error: 'Not authorized' }, error: null }; } },
    } },
  };
  new Function('require', 'module', 'exports', '__env', code)((name: string) => {
    assert.ok(name in modules, 'Unexpected dependency: ' + name); return modules[name];
  }, mod, mod.exports, { VITE_REVENUECAT_ENABLED: 'true', VITE_REVENUECAT_ANDROID_API_KEY: 'public-test-key' });
  return { ...mod.exports, calls: () => calls };
}

test('release hold blocks native purchases and restoration even when the public environment flag is true', async () => {
  const module = client();
  assert.equal(module.nativePurchasesEnabled, false);
  await assert.rejects(module.nativePurchases.run('local-test-uuid', 'purchase'), /coming soon/);
  await assert.rejects(module.nativePurchases.run('local-test-uuid', 'restore'), /coming soon/);
  assert.equal(module.calls(), 0);
});

test('a server denial in a successful HTTP response cannot be reported as synchronized access', async () => {
  const module = client();
  await assert.rejects(module.syncNativeSubscription('local-test-uuid'), /could not confirm/);
  assert.equal(module.calls(), 1);
});
