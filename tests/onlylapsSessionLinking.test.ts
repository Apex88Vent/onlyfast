import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  linkOnlyLapsSession,
  listOnlyLapsSessionCandidates,
  normalizeTrackName,
  OnlyLapsSessionLinkError,
  rankOnlyLapsCandidate,
  type LinkStoreResult,
  type OnlyFastLinkingSessionRow,
  type OnlyLapsCandidateLapRow,
  type OnlyLapsCandidateSessionRow,
  type OnlyLapsLinkRow,
  type OnlyLapsSessionLinkStore,
  unlinkOnlyLapsSession,
} from '../supabase/functions/_shared/onlylaps-session-linking.ts';

const userA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const userB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const fastA = '11111111-1111-4111-8111-111111111111';
const fastB = '11111111-1111-4111-8111-111111111112';
const fastOtherUser =
  '11111111-1111-4111-8111-111111111113';
const lapsHeat = '22222222-2222-4222-8222-222222222221';
const lapsMain = '22222222-2222-4222-8222-222222222222';
const lapsOtherUser =
  '22222222-2222-4222-8222-222222222223';

const onlyfastHeat: OnlyFastLinkingSessionRow = {
  id: fastA,
  user_id: userA,
  track_name: 'Barona Speedway',
  race_date: '2026-07-28',
  session_label: 'Heat',
  setup_type: 'heat',
};

const onlyfastMain: OnlyFastLinkingSessionRow = {
  ...onlyfastHeat,
  id: fastB,
  session_label: 'Main Event',
  setup_type: 'main',
};

const heatSession: OnlyLapsCandidateSessionRow = {
  id: lapsHeat,
  user_id: userA,
  track_map_id: null,
  name: 'Barona Speedway',
  session_name: 'Heat Race',
  session_type: 'heat',
  started_at: '2026-07-28T19:14:00.000Z',
  ended_at: '2026-07-28T19:25:00.000Z',
};

const mainSession: OnlyLapsCandidateSessionRow = {
  ...heatSession,
  id: lapsMain,
  session_name: 'Main Event',
  session_type: 'race',
  started_at: '2026-07-28T21:30:00.000Z',
};

const otherUserSession: OnlyLapsCandidateSessionRow = {
  ...heatSession,
  id: lapsOtherUser,
  user_id: userB,
  session_name: 'Another Driver',
};

const lapRows: OnlyLapsCandidateLapRow[] = [
  {
    timing_session_id: lapsHeat,
    lap_count: 3,
    valid_lap_count: 2,
    fastest_valid_lap_ms: 17_842,
  },
  {
    timing_session_id: lapsMain,
    lap_count: 1,
    valid_lap_count: 1,
    fastest_valid_lap_ms: 17_500,
  },
];

function result<T>(data: T): Promise<LinkStoreResult<T>> {
  return Promise.resolve({ data, error: null });
}

function createStatefulStore({
  onlyfastRows = [
    onlyfastHeat,
    onlyfastMain,
    { ...onlyfastHeat, id: fastOtherUser, user_id: userB },
  ],
  sessionRows = [heatSession, mainSession, otherUserSession],
}: {
  onlyfastRows?: OnlyFastLinkingSessionRow[];
  sessionRows?: OnlyLapsCandidateSessionRow[];
} = {}) {
  const state = {
    onlyfastRows: onlyfastRows.map((row) => ({ ...row })),
    sessionRows: sessionRows.map((row) => ({ ...row })),
    links: [] as OnlyLapsLinkRow[],
    setCalls: 0,
    unlinkCalls: 0,
  };

  const store: OnlyLapsSessionLinkStore = {
    findOwnedOnlyFastSession(sessionId, userId) {
      return result(
        state.onlyfastRows.find(
          (row) => row.id === sessionId && row.user_id === userId,
        ) || null,
      );
    },
    listOwnedLinksForOnlyFast(onlyfastSessionId, userId) {
      return result(
        state.links.filter(
          (link) =>
            link.onlyfast_session_id === onlyfastSessionId &&
            link.user_id === userId,
        ),
      );
    },
    findOwnedOnlyLapsSession(sessionId, userId) {
      return result(
        state.sessionRows.find(
          (row) => row.id === sessionId && row.user_id === userId,
        ) || null,
      );
    },
    listOwnedOnlyLapsSessions(userId, query) {
      const filtered = state.sessionRows
        .filter((row) => row.user_id === userId)
        .filter(
          (row) =>
            !query.startedAfter ||
            Boolean(row.started_at && row.started_at >= query.startedAfter),
        )
        .filter(
          (row) =>
            !query.startedBefore ||
            Boolean(row.started_at && row.started_at < query.startedBefore),
        )
        .sort((a, b) =>
          (b.started_at || '').localeCompare(a.started_at || ''),
        );
      const page = filtered.slice(
        query.offset,
        query.offset + query.limit,
      );
      return result({
        rows: page,
        hasMore: filtered.length > query.offset + query.limit,
      });
    },
    listOwnedLapSummaries(sessionIds, userId) {
      return result(
        lapRows.filter(
          (lap) =>
            userId === userA &&
            sessionIds.includes(lap.timing_session_id),
        ),
      );
    },
    listOwnedLinksForOnlyLaps(sessionIds, userId) {
      return result(
        state.links.filter(
          (link) =>
            link.user_id === userId &&
            sessionIds.includes(link.onlylaps_session_id),
        ),
      );
    },
    setOwnedLink(
      userId,
      onlyfastSessionId,
      onlylapsSessionId,
      linkMethod,
      matchConfidence,
    ) {
      state.setCalls += 1;
      if (
        state.links.some(
          (link) =>
            link.onlylaps_session_id === onlylapsSessionId &&
            link.onlyfast_session_id !== onlyfastSessionId,
        )
      ) {
        return Promise.resolve({
          data: null,
          error: '23505:duplicate OnlyLaps session link',
        });
      }
      const existing = state.links.find(
        (link) =>
          link.onlyfast_session_id === onlyfastSessionId &&
          link.user_id === userId,
      );
      const now = '2026-07-28T22:00:00.000Z';
      if (existing) {
        existing.onlylaps_session_id = onlylapsSessionId;
        existing.link_method = linkMethod;
        existing.match_confidence = matchConfidence;
        existing.updated_at = now;
        return result(existing);
      }
      const created: OnlyLapsLinkRow = {
        id: `44444444-4444-4444-8444-${String(
          state.links.length + 1,
        ).padStart(12, '0')}`,
        user_id: userId,
        onlyfast_session_id: onlyfastSessionId,
        onlylaps_session_id: onlylapsSessionId,
        link_method: linkMethod,
        match_confidence: matchConfidence,
        created_at: now,
        updated_at: now,
      };
      state.links.push(created);
      return result(created);
    },
    unlinkOwnedSession(userId, onlyfastSessionId) {
      state.unlinkCalls += 1;
      const before = state.links.length;
      state.links = state.links.filter(
        (link) =>
          !(
            link.user_id === userId &&
            link.onlyfast_session_id === onlyfastSessionId
          ),
      );
      return result(before !== state.links.length);
    },
  };

  return { state, store };
}

test('no linked session returns a ranked picker without writing a link', async () => {
  const { state, store } = createStatefulStore();
  const picker = await listOnlyLapsSessionCandidates({
    onlyfastSessionId: fastA,
    userId: userA,
    store,
  });

  assert.equal(picker.current_link, null);
  assert.equal(picker.current_session, null);
  assert.equal(picker.candidates[0].onlylaps_session_id, lapsHeat);
  assert.equal(picker.candidates[0].lap_count, 3);
  assert.equal(picker.candidates[0].valid_lap_count, 2);
  assert.equal(picker.candidates[0].fastest_valid_lap_ms, 17_842);
  assert.equal(state.setCalls, 0);
});

test('link, change, second-link replacement, and unlink keep one association', async () => {
  const { state, store } = createStatefulStore();
  const linked = await linkOnlyLapsSession({
    onlyfastSessionId: fastA,
    onlylapsSessionId: lapsHeat,
    userId: userA,
    store,
  });
  assert.equal(linked.action, 'linked');
  assert.equal(state.links.length, 1);
  assert.equal(state.links[0].onlylaps_session_id, lapsHeat);

  const changed = await linkOnlyLapsSession({
    onlyfastSessionId: fastA,
    onlylapsSessionId: lapsMain,
    userId: userA,
    store,
  });
  assert.equal(changed.action, 'changed');
  assert.equal(state.links.length, 1);
  assert.equal(state.links[0].onlylaps_session_id, lapsMain);

  const removed = await unlinkOnlyLapsSession({
    onlyfastSessionId: fastA,
    userId: userA,
    store,
  });
  assert.equal(removed.unlinked, true);
  assert.equal(state.links.length, 0);
  assert.equal(state.unlinkCalls, 1);
});

test('another user OnlyLaps or OnlyFast session cannot be modified', async (t) => {
  const { store } = createStatefulStore();

  await t.test('another user OnlyLaps session', async () => {
    await assert.rejects(
      linkOnlyLapsSession({
        onlyfastSessionId: fastA,
        onlylapsSessionId: lapsOtherUser,
        userId: userA,
        store,
      }),
      (error: unknown) =>
        error instanceof OnlyLapsSessionLinkError &&
        error.code === 'onlylaps_session_not_found',
    );
  });

  await t.test('another user OnlyFast session', async () => {
    await assert.rejects(
      linkOnlyLapsSession({
        onlyfastSessionId: fastOtherUser,
        onlylapsSessionId: lapsHeat,
        userId: userA,
        store,
      }),
      (error: unknown) =>
        error instanceof OnlyLapsSessionLinkError &&
        error.code === 'onlyfast_session_not_found',
    );
  });
});

test('one OnlyLaps session cannot be linked to two OnlyFast sessions', async () => {
  const { store } = createStatefulStore();
  await linkOnlyLapsSession({
    onlyfastSessionId: fastA,
    onlylapsSessionId: lapsHeat,
    userId: userA,
    store,
  });

  await assert.rejects(
    linkOnlyLapsSession({
      onlyfastSessionId: fastB,
      onlylapsSessionId: lapsHeat,
      userId: userA,
      store,
    }),
    (error: unknown) =>
      error instanceof OnlyLapsSessionLinkError &&
      error.code === 'already_linked_elsewhere',
  );
});

test('Hot Laps, Heat, Main, link changes, unlinks, and copied rows stay independent', async () => {
  const hotLapsSessionId =
    '11111111-1111-4111-8111-111111111115';
  const copiedSessionId =
    '11111111-1111-4111-8111-111111111114';
  const alternateOnlyLapsId =
    '22222222-2222-4222-8222-222222222225';
  const hotLapsRow: OnlyFastLinkingSessionRow = {
    ...onlyfastHeat,
    id: hotLapsSessionId,
    session_label: 'Hot Laps',
    setup_type: 'base',
  };
  const alternateOnlyLapsRow: OnlyLapsCandidateSessionRow = {
    ...heatSession,
    id: alternateOnlyLapsId,
    session_name: 'Heat Race Alternate',
    started_at: '2026-07-28T20:00:00.000Z',
  };
  const { state, store } = createStatefulStore({
    onlyfastRows: [hotLapsRow, onlyfastHeat, onlyfastMain],
    sessionRows: [
      heatSession,
      mainSession,
      alternateOnlyLapsRow,
      otherUserSession,
    ],
  });

  await linkOnlyLapsSession({
    onlyfastSessionId: fastA,
    onlylapsSessionId: lapsHeat,
    userId: userA,
    store,
  });
  await linkOnlyLapsSession({
    onlyfastSessionId: fastB,
    onlylapsSessionId: lapsMain,
    userId: userA,
    store,
  });

  const unlinkedHotLapsView = await listOnlyLapsSessionCandidates({
    onlyfastSessionId: hotLapsSessionId,
    userId: userA,
    store,
  });
  const heatView = await listOnlyLapsSessionCandidates({
    onlyfastSessionId: fastA,
    userId: userA,
    store,
  });
  const mainView = await listOnlyLapsSessionCandidates({
    onlyfastSessionId: fastB,
    userId: userA,
    store,
  });
  assert.equal(unlinkedHotLapsView.current_session, null);
  assert.equal(heatView.current_session?.onlylaps_session_id, lapsHeat);
  assert.equal(mainView.current_session?.onlylaps_session_id, lapsMain);

  await linkOnlyLapsSession({
    onlyfastSessionId: fastA,
    onlylapsSessionId: alternateOnlyLapsId,
    userId: userA,
    store,
  });
  const mainAfterHeatChange = await listOnlyLapsSessionCandidates({
    onlyfastSessionId: fastB,
    userId: userA,
    store,
  });
  assert.equal(
    mainAfterHeatChange.current_session?.onlylaps_session_id,
    lapsMain,
  );

  await unlinkOnlyLapsSession({
    onlyfastSessionId: fastA,
    userId: userA,
    store,
  });
  const mainAfterOtherUnlink = await listOnlyLapsSessionCandidates({
    onlyfastSessionId: fastB,
    userId: userA,
    store,
  });
  assert.equal(
    mainAfterOtherUnlink.current_session?.onlylaps_session_id,
    lapsMain,
  );

  state.onlyfastRows.push({
    ...onlyfastHeat,
    id: copiedSessionId,
    session_label: 'Copied Heat',
  });
  const copiedView = await listOnlyLapsSessionCandidates({
    onlyfastSessionId: copiedSessionId,
    userId: userA,
    store,
  });
  assert.equal(copiedView.current_link, null);
  assert.equal(copiedView.current_session, null);
  assert.equal(state.links.length, 1);
  assert.equal(state.links[0].onlyfast_session_id, fastB);
});

test('renaming either session changes display only and leaves the ID link intact', async () => {
  const { state, store } = createStatefulStore();
  await linkOnlyLapsSession({
    onlyfastSessionId: fastA,
    onlylapsSessionId: lapsHeat,
    userId: userA,
    store,
  });
  state.onlyfastRows.find((row) => row.id === fastA)!.session_label =
    'Qualifier 1';
  state.sessionRows.find((row) => row.id === lapsHeat)!.session_name =
    'Heat Race Renamed';

  const picker = await listOnlyLapsSessionCandidates({
    onlyfastSessionId: fastA,
    userId: userA,
    store,
  });
  assert.equal(state.links[0].onlyfast_session_id, fastA);
  assert.equal(state.links[0].onlylaps_session_id, lapsHeat);
  assert.equal(picker.current_session?.display_name, 'Heat Race Renamed');
});

test('picker reads updated custom names dynamically and supplies a historical fallback', async () => {
  const historical: OnlyLapsCandidateSessionRow = {
    ...heatSession,
    session_name: null,
  };
  const { state, store } = createStatefulStore({
    sessionRows: [historical],
  });

  const first = await listOnlyLapsSessionCandidates({
    onlyfastSessionId: fastA,
    userId: userA,
    store,
  });
  assert.equal(first.candidates[0].custom_name, null);
  assert.match(first.candidates[0].display_name, /^Session — /);

  state.sessionRows[0].session_name = 'Heat Race';
  const renamed = await listOnlyLapsSessionCandidates({
    onlyfastSessionId: fastA,
    userId: userA,
    store,
  });
  assert.equal(renamed.candidates[0].display_name, 'Heat Race');
});

test('ranking uses safe track, date, and session hints only for suggestions', async () => {
  assert.equal(normalizeTrackName('The Barona Speedway'), 'barona');
  const strong = rankOnlyLapsCandidate(onlyfastHeat, heatSession);
  const weak = rankOnlyLapsCandidate(onlyfastHeat, {
    ...heatSession,
    name: 'Different Circuit',
    session_name: 'Main Event',
    session_type: 'race',
    started_at: '2026-08-15T19:14:00.000Z',
  });
  assert.equal(strong.score, 110);
  assert.ok(strong.reasons.includes('same track'));
  assert.ok(strong.score > weak.score);

  const { state, store } = createStatefulStore();
  const picker = await listOnlyLapsSessionCandidates({
    onlyfastSessionId: fastA,
    userId: userA,
    store,
  });
  assert.equal(picker.suggested_candidate_id, lapsHeat);
  assert.equal(state.setCalls, 0);
});

test('ambiguous matching never silently creates a permanent link', async () => {
  const secondHeat: OnlyLapsCandidateSessionRow = {
    ...heatSession,
    id: '22222222-2222-4222-8222-222222222224',
    session_name: 'Heat Race 2',
    started_at: '2026-07-28T20:00:00.000Z',
  };
  const { state, store } = createStatefulStore({
    sessionRows: [heatSession, secondHeat],
  });
  const picker = await listOnlyLapsSessionCandidates({
    onlyfastSessionId: fastA,
    userId: userA,
    store,
  });

  assert.equal(picker.suggested_candidate_id, null);
  assert.equal(picker.ambiguous, true);
  assert.equal(state.links.length, 0);
  assert.equal(state.setCalls, 0);
});

test('migration audits conflicts, enforces one-to-one, and blocks direct client writes', () => {
  const sql = readFileSync(
    new URL(
      '../supabase/migrations/202607280004_onlyfast_onlylaps_session_linking.sql',
      import.meta.url,
    ),
    'utf8',
  );
  assert.match(sql, /having count\(\*\) > 1/gi);
  assert.match(
    sql,
    /unique index if not exists[\s\S]*onlyfast_session_id\)/i,
  );
  assert.match(
    sql,
    /unique index if not exists[\s\S]*onlylaps_session_id\)/i,
  );
  assert.match(
    sql,
    /revoke insert, update, delete[\s\S]*from authenticated/i,
  );
  assert.match(
    sql,
    /grant execute[\s\S]*onlyfast_set_onlylaps_session_link[\s\S]*to service_role/i,
  );
  assert.match(
    sql,
    /count\(\*\) filter \(where laps\.is_valid = true\)[\s\S]*min\(laps\.duration_ms\) filter/i,
  );
  assert.match(
    sql,
    /onlyfast_onlylaps_candidate_lap_summaries[\s\S]*to service_role/i,
  );
  assert.doesNotMatch(
    sql,
    /grant execute[\s\S]*onlyfast_set_onlylaps_session_link[\s\S]*to authenticated/i,
  );
  assert.doesNotMatch(sql, /delete from public\.race_setups/i);
  assert.doesNotMatch(sql, /delete from public\.onlylaps_/i);
  assert.doesNotMatch(sql, /onlylaps_telemetry_shares|onlylaps_resolve_telemetry_share/i);
});

test('UI and backend reuse the existing experimental test-account gate', () => {
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
  const card = readFileSync(
    new URL(
      '../src/components/OnlyLapsSessionLinkCard.tsx',
      import.meta.url,
    ),
    'utf8',
  );

  assert.match(
    dashboard,
    /testerKind === 'experimental'[\s\S]*BETA_FEATURES\.testAccountFullAccess/,
  );
  assert.match(
    dashboard,
    /enabled=\{onlyLapsLinkingEnabled\}/,
  );
  assert.match(
    edge,
    /hasBetaFeatureForUser\([\s\S]*ONLYLAPS_SESSION_LINK_BETA_FEATURE[\s\S]*'experimental'/,
  );
  assert.match(edge, /authClient\.auth\.getUser\(token\)/);
  assert.doesNotMatch(edge, /onlylaps_telemetry_samples|OPENAI_API_KEY|api\.openai\.com/);
  assert.match(card, /Linked elsewhere/);
  assert.doesNotMatch(
    card,
    />\s*\{candidate\.onlylaps_session_id\}\s*</,
  );
});

test('the existing context reader consumes the single authoritative ID link', () => {
  const reader = readFileSync(
    new URL(
      '../supabase/functions/_shared/onlylaps-setup-context.ts',
      import.meta.url,
    ),
    'utf8',
  );
  assert.match(reader, /store\.listOwnedLinks\(onlyfastSessionId, userId\)/);
  assert.match(reader, /if \(links\.length > 1\)/);
  assert.match(
    reader,
    /findOwnedOnlyLapsSession\(link\.onlylaps_session_id, userId\)/,
  );
  assert.doesNotMatch(reader, /findLatestOwnedLink/);
});
