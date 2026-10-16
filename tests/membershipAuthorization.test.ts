import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { resolveAuthorizedMembership, clearTrustedMembership, setTrustedAuthorization, getTrustedMembership } from '../src/lib/trustedMembership.ts';

const paid = (plan: string) => ({ plan, status: 'active', subscription_source: 'stripe' });
test('server subscriptions preserve Stripe without any native entitlement; highest valid grant wins', () => {
  assert.equal(resolveAuthorizedMembership(paid('pro')).membership_tier, 'pro');
  assert.equal(resolveAuthorizedMembership(paid('teams')).membership_tier, 'team');
  assert.equal(resolveAuthorizedMembership(paid('pro'), { promo_access_level: 'teams' }).membership_tier, 'team');
  assert.equal(resolveAuthorizedMembership(paid('teams'), { promo_access_level: 'pro' }).membership_tier, 'team');
  assert.equal(resolveAuthorizedMembership(paid('pro'), { promo_access_level: 'teams', promo_access_expires_at: '2000-01-01' }).membership_tier, 'pro');
  assert.equal(resolveAuthorizedMembership(null, { has_admin_full_access: true }).has_admin_full_access, true);
});
test('native expiration fails closed; active cancellation is paid until expiration', () => {
  const row = { ...paid('teams'), subscription_source: 'revenuecat', revenuecat_expires_at: '2030-01-01' };
  assert.equal(resolveAuthorizedMembership(row, {}, Date.parse('2029-01-01')).membership_tier, 'team');
  assert.equal(resolveAuthorizedMembership(row, {}, Date.parse('2031-01-01')).membership_tier, 'rookie');
  assert.equal(resolveAuthorizedMembership({ ...row, revenuecat_expires_at: null }).membership_tier, 'rookie');
  assert.equal(resolveAuthorizedMembership({ ...row, revenuecat_expires_at: 'bad-date' }).membership_tier, 'rookie');
});
test('trusted cache clears immediately on account changes and recomputes expired grants', () => {
  clearTrustedMembership(); setTrustedAuthorization('a', paid('pro'), { promo_access_level: 'teams', promo_access_expires_at: '2000-01-01' });
  assert.equal(getTrustedMembership()?.membership_tier, 'pro');
  clearTrustedMembership('b'); assert.equal(getTrustedMembership(), null);
});
test('editing browser storage, metadata, and public promo codes cannot grant paid UI access', () => {
  const exports: any = {};
  const source = readFileSync(new URL('../src/lib/membership.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('require', 'exports', js)((name: string) => name.includes('testAccount') ? { isCurrentUserTestAccount: () => false } :
    name.includes('trustedMembership') ? { getTrustedMembership: () => null } : { supabase: {} }, exports);
  const forged = { membership_tier: 'team', has_admin_full_access: true, promo_access_level: 'admin_full_access' };
  assert.equal(exports.getEffectiveTier(exports.readMembership(forged)), 'rookie');
  assert.equal(exports.hasFeatureAccess(exports.readMembership(forged), 'setupExport'), false);
  assert.equal(exports.applyPromoCode('Launch26').ok, false);
});
