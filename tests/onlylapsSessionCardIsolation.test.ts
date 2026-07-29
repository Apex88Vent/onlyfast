import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resolveActiveOnlyFastSessionId } from '../src/lib/onlylapsSessionScope.ts';

const hotLapsId = '11111111-1111-4111-8111-111111111111';
const heatId = '11111111-1111-4111-8111-111111111112';
const mainId = '11111111-1111-4111-8111-111111111113';

test('the active setup hierarchy has exactly one telemetry-card mount point', () => {
  const dashboard = readFileSync(
    new URL('../src/components/SetupDashboard.tsx', import.meta.url),
    'utf8',
  );
  const slot = readFileSync(
    new URL(
      '../src/components/ActiveOnlyLapsSessionLinkSlot.tsx',
      import.meta.url,
    ),
    'utf8',
  );

  assert.equal(
    dashboard.match(/<ActiveOnlyLapsSessionLinkSlot\b/g)?.length,
    1,
  );
  assert.equal(dashboard.match(/<OnlyLapsSessionLinkCard\b/g)?.length || 0, 0);
  assert.equal(slot.match(/<OnlyLapsSessionLinkCard\b/g)?.length, 1);
  assert.doesNotMatch(slot, /\.map\s*\(/);

  // Setup fields and history/copy rows remain siblings of the one card slot;
  // their repeated data cannot create more card component instances.
  assert.equal(dashboard.match(/<TrackInfoSection\b/g)?.length, 1);
  assert.equal(dashboard.match(/<ChassisSetupForm\b/g)?.length, 1);
  assert.equal(dashboard.match(/<CustomFieldManager\b/g)?.length, 1);
  assert.match(dashboard, /savedSetupsList\.map\([\s\S]*<TrackInfoSection/);
});

test('Hot Laps, Heat, and Main resolve only their exact immutable row ID', () => {
  const sessionIds = {
    base: hotLapsId,
    heat: heatId,
    main: mainId,
  };

  assert.equal(
    resolveActiveOnlyFastSessionId('base', sessionIds),
    hotLapsId,
  );
  assert.equal(
    resolveActiveOnlyFastSessionId('heat', sessionIds),
    heatId,
  );
  assert.equal(
    resolveActiveOnlyFastSessionId('main', sessionIds),
    mainId,
  );
  assert.equal(resolveActiveOnlyFastSessionId('extra1', sessionIds), null);
  assert.equal(
    resolveActiveOnlyFastSessionId('heat', {
      heat: 'Heat Race',
      track_name: heatId,
      race_date: heatId,
    }),
    null,
  );
});

test('changing the active row ID remounts and rejects stale request data', () => {
  const slot = readFileSync(
    new URL(
      '../src/components/ActiveOnlyLapsSessionLinkSlot.tsx',
      import.meta.url,
    ),
    'utf8',
  );
  const card = readFileSync(
    new URL(
      '../src/components/OnlyLapsSessionLinkCard.tsx',
      import.meta.url,
    ),
    'utf8',
  );

  assert.match(slot, /key=\{`onlylaps-session-\$\{onlyfastSessionId\}`\}/);
  assert.match(card, /activeSessionIdRef/);
  assert.match(card, /requestVersionRef/);
  assert.match(
    card,
    /next\.onlyfast_session_id !== requestedSessionId/,
  );
  assert.match(card, /setResult\(null\)/);
});

test('queries and mutations use the exact selected race_setups ID', () => {
  const client = readFileSync(
    new URL('../src/lib/onlylapsSessionLink.ts', import.meta.url),
    'utf8',
  );
  const card = readFileSync(
    new URL(
      '../src/components/OnlyLapsSessionLinkCard.tsx',
      import.meta.url,
    ),
    'utf8',
  );

  assert.match(
    client,
    /onlyfast_session_id: onlyfastSessionId/g,
  );
  assert.match(
    card,
    /loadOnlyLapsSessionCandidates\(\s*requestedSessionId/,
  );
  assert.match(
    card,
    /linkOnlyLapsSession\(\s*requestedSessionId/,
  );
  assert.match(card, /unlinkOnlyLapsSession\(requestedSessionId\)/);
  const requestFunctions = client.slice(
    client.indexOf('export function loadOnlyLapsSessionCandidates'),
  );
  assert.doesNotMatch(
    requestFunctions,
    /track_name|race_date|session_label|setup_name/,
  );
});
