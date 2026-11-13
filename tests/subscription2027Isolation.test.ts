import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { loadConfigFromFile } from 'vite';

test('2027 production builds fail even if the branch name is changed; normal legacy builds remain available', async () => {
  const oldEnv = process.env.VERCEL_ENV, oldBranch = process.env.VERCEL_GIT_COMMIT_REF;
  try {
    process.env.VERCEL_ENV = 'production'; process.env.VERCEL_GIT_COMMIT_REF = 'main';
    await assert.rejects(loadConfigFromFile({ command: 'build', mode: 'onlyfast-2027' }), /preview-only/);
    process.env.VERCEL_GIT_COMMIT_REF = 'develop/onlyfast-2027';
    await assert.rejects(loadConfigFromFile({ command: 'build', mode: 'production' }), /preview-only/);
    process.env.VERCEL_GIT_COMMIT_REF = 'main';
    const legacy = await loadConfigFromFile({ command: 'build', mode: 'production' });
    assert.equal(legacy?.config.define?.['import.meta.env.ONLYFAST_2027_PREVIEW'], 'false');
    process.env.VERCEL_ENV = 'preview';
    const preview = await loadConfigFromFile({ command: 'build', mode: 'onlyfast-2027' });
    assert.equal(preview?.config.define?.['import.meta.env.ONLYFAST_2027_PREVIEW'], 'true');
  } finally {
    if (oldEnv === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = oldEnv;
    if (oldBranch === undefined) delete process.env.VERCEL_GIT_COMMIT_REF; else process.env.VERCEL_GIT_COMMIT_REF = oldBranch;
  }
});

test('preview ignores inherited production credentials and cannot initialize a networked or persistent client', async () => {
  const source = readFileSync(new URL('../src/lib/supabase.ts', import.meta.url), 'utf8')
    .replaceAll('import.meta.env', 'testEnv');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  let observed: any;
  const exports: any = {};
  new Function('require', 'exports', 'testEnv', js)((name: string) => name === '@supabase/supabase-js'
    ? { createClient: (url: string, key: string, options: any) => { observed = { url, key, options }; return {}; } }
    : {}, exports, { ONLYFAST_2027_PREVIEW: true, VITE_SUPABASE_URL: 'https://thpyjvwtfvfxiufchrxn.supabase.co', VITE_SUPABASE_ANON_KEY: 'inherited-production-public-key' });
  assert.equal(observed.url, 'https://onlyfast-2027.invalid');
  assert.equal(observed.options.auth.persistSession, false);
  assert.equal(observed.options.auth.autoRefreshToken, false);
  await assert.rejects(observed.options.global.fetch('https://thpyjvwtfvfxiufchrxn.supabase.co'), /No request was sent/);
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(config.buildCommand, 'vite build --mode onlyfast-2027');
  assert.equal(config.git.deploymentEnabled.main, true);
  assert.equal(config.git.deploymentEnabled['develop/onlyfast-2027'], true);
  const csp = config.headers[0].headers.find((h: any) => h.key === 'Content-Security-Policy').value;
  assert.match(csp, /connect-src 'self' https:\/\/mfzajhnfonrfuiwxgvhe.supabase.co wss:\/\/mfzajhnfonrfuiwxgvhe.supabase.co;/);
  assert.doesNotMatch(csp, /thpyjvwtfvfxiufchrxn|https:\/\/\*/);
});
