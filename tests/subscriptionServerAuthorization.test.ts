import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

for (const name of ['get-suggestions', 'scan-timing-screen']) test(`${name}: paid server authorization rejects editable claims and respects provider/grant expiry`, async () => {
  const source = readFileSync(new URL(`../supabase/functions/${name}/index.ts`, import.meta.url), 'utf8');
  const ast = ts.createSourceFile('edge.ts', source, ts.ScriptTarget.Latest, true);
  const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'resolveEffectiveTier');
  assert.ok(fn);
  const js = ts.transpileModule(fn.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const resolve = new Function('Deno', 'hasBetaFeatureForUser', 'normalizePlan', js + '; return resolveEffectiveTier;')(
    { env: { get: () => '' } }, async () => false,
    (plan: string) => plan === 'teams' || plan === 'team' ? 'team' : plan === 'pro' ? 'pro' : 'free');
  let row: any = null;
  let error: Error | null = null;
  const query = { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: row, error }; } };
  const admin = { from: () => query };
  const user = { id: 'uuid', user_metadata: { membership_tier: 'team', has_admin_full_access: true, promo_access_level: 'teams' }, app_metadata: {} as Record<string, unknown> };
  assert.equal(await resolve(admin, user, false), 'rookie');
  row = { plan: 'pro', status: 'active', subscription_source: 'stripe' };
  assert.equal(await resolve(admin, user, false), 'pro');
  user.app_metadata = { promo_access_level: 'teams', promo_access_expires_at: '2035-01-01' };
  assert.equal(await resolve(admin, user, false), 'team');
  user.app_metadata.promo_access_expires_at = '2000-01-01';
  assert.equal(await resolve(admin, user, false), 'pro');
  row = { plan: 'teams', status: 'active', subscription_source: 'revenuecat', revenuecat_expires_at: '2000-01-01' };
  assert.equal(await resolve(admin, user, false), 'rookie');
  row.revenuecat_expires_at = '2035-01-01';
  assert.equal(await resolve(admin, user, false), 'team');
  user.app_metadata = { has_admin_full_access: true };
  row = null;
  assert.equal(await resolve(admin, user, false), 'team');
  user.app_metadata = {}; error = new Error('database unavailable');
  await assert.rejects(resolve(admin, user, false), /database unavailable/);
});
