import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { hasBetaFeatureForUser } from '../supabase/functions/_shared/beta-features.ts';
import {
  BETA_FEATURES,
  buildBetaAccessSnapshot,
  clearCachedBetaAccess,
  hasCachedExperimentalBetaFeature,
  setCachedBetaAccess,
  type BetaTesterAccountRow,
  type UserFeatureFlagRow,
} from '../src/lib/betaFeatures.ts';

type BackendAccount = {
  is_test_account: boolean;
  beta_features_enabled: boolean;
  tester_kind: 'experimental' | 'personal';
} | null;

type BackendFlag = { enabled: boolean } | null;

function mockAdmin(account: BackendAccount, flag: BackendFlag) {
  return {
    from(table: string) {
      const chain = {
        select() {
          return chain;
        },
        eq() {
          return chain;
        },
        maybeSingle() {
          return Promise.resolve({
            data:
              table === 'beta_tester_accounts'
                ? account
                : table === 'user_feature_flags'
                  ? flag
                  : null,
            error: null,
          });
        },
      };
      return chain;
    },
  };
}

async function gateResults({
  account,
  flags,
  backendFlag,
}: {
  account: BetaTesterAccountRow | null;
  flags: UserFeatureFlagRow[];
  backendFlag: BackendFlag;
}) {
  const snapshot = buildBetaAccessSnapshot(account, flags);
  setCachedBetaAccess(snapshot);
  const frontend = hasCachedExperimentalBetaFeature(
    BETA_FEATURES.testAccountFullAccess,
  );
  const backend = await hasBetaFeatureForUser(
    mockAdmin(
      account
        ? {
            is_test_account: account.is_test_account,
            beta_features_enabled: account.beta_features_enabled,
            tester_kind: account.tester_kind,
          }
        : null,
      backendFlag,
    ) as never,
    account?.user_id || 'ordinary-user',
    BETA_FEATURES.testAccountFullAccess,
    'experimental',
  );
  clearCachedBetaAccess();
  return { frontend, backend };
}

const fullAccessFlag: UserFeatureFlagRow = {
  feature_key: BETA_FEATURES.testAccountFullAccess,
  enabled: true,
};

test('test@test remains allowed by both OnlyLaps linking gates', async () => {
  const result = await gateResults({
    account: {
      user_id: 'test-account-id',
      is_test_account: true,
      beta_features_enabled: true,
      tester_kind: 'experimental',
    },
    flags: [fullAccessFlag],
    backendFlag: { enabled: true },
  });
  assert.deepEqual(result, { frontend: true, backend: true });
});

test('c_marin88 receives the same canonical access after the migration', async () => {
  const result = await gateResults({
    account: {
      user_id: 'cmarin-account-id',
      is_test_account: true,
      beta_features_enabled: true,
      tester_kind: 'experimental',
    },
    flags: [fullAccessFlag],
    backendFlag: { enabled: true },
  });
  assert.deepEqual(result, { frontend: true, backend: true });
});

test('an ordinary production account remains denied by both gates', async () => {
  const result = await gateResults({
    account: null,
    flags: [],
    backendFlag: null,
  });
  assert.deepEqual(result, { frontend: false, backend: false });
});

test('migration uses the existing account and feature-flag tables', () => {
  const migration = readFileSync(
    new URL(
      '../supabase/migrations/202607280005_enable_cmar_test_account_full_access.sql',
      import.meta.url,
    ),
    'utf8',
  );
  assert.match(
    migration,
    /insert into public\.beta_tester_accounts[\s\S]*tester_kind[\s\S]*'experimental'/i,
  );
  assert.match(
    migration,
    /insert into public\.user_feature_flags[\s\S]*'test_account_full_access'[\s\S]*true/i,
  );
  assert.match(migration, /select id[\s\S]*from auth\.users/i);
  assert.doesNotMatch(
    migration,
    /create table|create type|alter table.*add column/i,
  );
});

test('OnlyLaps UI and Edge Function use the same canonical requirement without runtime email checks', () => {
  const dashboard = readFileSync(
    new URL('../src/components/SetupDashboard.tsx', import.meta.url),
    'utf8',
  );
  const edge = readFileSync(
    new URL(
      '../supabase/functions/manage-onlylaps-session-link/index.ts',
      import.meta.url,
    ),
    'utf8',
  );
  assert.match(
    dashboard,
    /testerKind === 'experimental'[\s\S]*BETA_FEATURES\.testAccountFullAccess/,
  );
  assert.match(
    edge,
    /ONLYLAPS_SESSION_LINK_BETA_FEATURE[\s\S]*'experimental'/,
  );
  assert.doesNotMatch(
    `${dashboard}\n${edge}`,
    /test@test\.com|c_marin88@yahoo\.com/i,
  );
});
