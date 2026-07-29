import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  CURRENT_ONLYLAPS_ANALYSIS_VERSION,
  getOnlyLapsSetupContext,
  OnlyLapsSetupContextError,
  type OnlyFastOnlyLapsLinkRow,
  type OnlyFastSessionRow,
  type OnlyLapsAnalysisRow,
  type OnlyLapsLapRow,
  type OnlyLapsSectorRow,
  type OnlyLapsSetupContextStore,
  type OnlyLapsTimingSessionRow,
  type OnlyLapsTrackMapRow,
  type StoreResult,
} from '../supabase/functions/_shared/onlylaps-setup-context.ts';

const userA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const userB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const onlyfastSessionId = '11111111-1111-4111-8111-111111111111';
const onlylapsSessionId = '22222222-2222-4222-8222-222222222222';
const trackMapId = '33333333-3333-4333-8333-333333333333';

const onlyfastSession: OnlyFastSessionRow = {
  id: onlyfastSessionId,
  user_id: userA,
};

const link: OnlyFastOnlyLapsLinkRow = {
  id: '44444444-4444-4444-8444-444444444444',
  user_id: userA,
  onlyfast_session_id: onlyfastSessionId,
  onlylaps_session_id: onlylapsSessionId,
  link_method: 'manual',
  match_confidence: null,
  created_at: '2026-07-28T10:00:00.000Z',
  updated_at: '2026-07-28T10:00:00.000Z',
};

const onlylapsSession: OnlyLapsTimingSessionRow = {
  id: onlylapsSessionId,
  user_id: userA,
  track_map_id: trackMapId,
  name: 'Fallback Session Name',
  session_name: 'Heat Race',
  vehicle_name: 'Dwarf Car 88',
  session_type: 'race',
  started_at: '2026-07-28T18:00:00.000Z',
  ended_at: '2026-07-28T18:20:00.000Z',
  weather: { temperatureF: 82 },
  device_info: { gForceConvention: 'vehicle_braking_positive_v2' },
};

const track: OnlyLapsTrackMapRow = {
  id: trackMapId,
  user_id: userA,
  created_by: userA,
  is_active: false,
  name: 'Fallback Track Name',
  track_name: 'Barona Speedway',
  track_type: 'dirt_oval',
  track_shape: 'oval',
  track_length: '1/4 mile',
};

const validLapOne: OnlyLapsLapRow = {
  id: '55555555-5555-4555-8555-555555555551',
  user_id: userA,
  timing_session_id: onlylapsSessionId,
  lap_number: 1,
  duration_ms: 60_000,
  sector_times_ms: [30_000, 30_000],
  is_valid: true,
  excluded_reason: null,
  average_speed: 40,
  max_speed: 70,
  max_lateral_g: 1.2,
  max_longitudinal_g: 0.8,
  max_accel_g: 0.5,
  max_braking_g: 0.7,
};

const validLapTwo: OnlyLapsLapRow = {
  ...validLapOne,
  id: '55555555-5555-4555-8555-555555555552',
  lap_number: 2,
  duration_ms: 62_000,
  sector_times_ms: [29_000, 31_000],
  average_speed: 42,
  max_speed: 72,
  max_lateral_g: 1.5,
  max_longitudinal_g: 0.9,
  max_accel_g: 0.6,
  max_braking_g: 0.8,
};

const excludedLap: OnlyLapsLapRow = {
  ...validLapOne,
  id: '55555555-5555-4555-8555-555555555553',
  lap_number: 3,
  duration_ms: 100_000,
  sector_times_ms: [50_000, 25_000],
  is_valid: false,
  excluded_reason:
    'More than 20% slower than clean session average / likely caution lap',
  average_speed: 20,
  max_speed: 200,
  max_lateral_g: 4,
  max_longitudinal_g: 3,
  max_accel_g: 3,
  max_braking_g: 3,
};

const sectors: OnlyLapsSectorRow[] = [
  {
    lap_id: validLapOne.id,
    timing_session_id: onlylapsSessionId,
    user_id: userA,
    sector_index: 1,
    duration_ms: 30_000,
    is_valid: true,
    source_definition_version: 2,
    source_kind: 'track_default',
  },
  {
    lap_id: validLapOne.id,
    timing_session_id: onlylapsSessionId,
    user_id: userA,
    sector_index: 2,
    duration_ms: 30_000,
    is_valid: true,
    source_definition_version: 2,
    source_kind: 'track_default',
  },
  {
    lap_id: validLapTwo.id,
    timing_session_id: onlylapsSessionId,
    user_id: userA,
    sector_index: 1,
    duration_ms: 29_000,
    is_valid: true,
    source_definition_version: 2,
    source_kind: 'track_default',
  },
  {
    lap_id: validLapTwo.id,
    timing_session_id: onlylapsSessionId,
    user_id: userA,
    sector_index: 2,
    duration_ms: 31_000,
    is_valid: true,
    source_definition_version: 2,
    source_kind: 'track_default',
  },
  {
    lap_id: excludedLap.id,
    timing_session_id: onlylapsSessionId,
    user_id: userA,
    sector_index: 2,
    duration_ms: 25_000,
    is_valid: true,
    source_definition_version: 2,
    source_kind: 'track_default',
  },
];

const analysis: OnlyLapsAnalysisRow = {
  id: '66666666-6666-4666-8666-666666666666',
  session_id: onlylapsSessionId,
  user_id: userA,
  summary_text: 'Carry more speed through corner one.',
  summary_json: {
    schemaVersion: CURRENT_ONLYLAPS_ANALYSIS_VERSION,
    analysisKind: 'corner_comparison',
    deterministicTelemetryContext: {
      source: 'onlylaps_precomputed_metrics',
      input: { selectedLapNumber: 2 },
    },
  },
  driving_observations: [
    {
      source: 'ai_interpretation',
      observation: 'Carry more speed through corner one.',
    },
  ],
  corner_observations: [
    {
      source: 'onlylaps_deterministic_corner_comparison',
      cornerNumber: 1,
      measuredDeltas: {
        entrySpeedDeltaMph: 1,
        minimumSpeedDeltaMph: -2,
        exitSpeedDeltaMph: 0.5,
        maximumLateralGDelta: 0.2,
        averageLateralGDelta: 0.1,
        cornerTimeDeltaSeconds: 0.15,
        entryTimeDeltaSeconds: 0.04,
        apexTimeDeltaSeconds: 0.09,
        exitTimeDeltaSeconds: 0.15,
      },
      derivedHeuristics: {
        lineDifference: { classification: 'meaningfully_wider' },
        possibleScrub: { detected: true },
        confidence: 'good',
      },
    },
  ],
  sector_observations: [
    {
      sectorIndex: 1,
      durationMs: 29_000,
      sourceLapId: validLapTwo.id,
      sourceLapNumber: 2,
    },
  ],
  consistency_observations: [],
  braking_observations: [],
  acceleration_observations: [],
  lateral_grip_observations: [
    {
      cornerNumber: 1,
      maximumLateralGDelta: 0.2,
      averageLateralGDelta: 0.1,
    },
  ],
  line_trajectory_observations: [
    {
      cornerNumber: 1,
      lineDifference: { classification: 'meaningfully_wider' },
    },
  ],
  setup_relevant_observations: [],
  optimum_lap_time_ms: 59_000,
  optimum_lap: {
    lapTimeMs: 59_000,
    deltaToFastestLapMs: 1_000,
    sectors: [
      {
        sectorIndex: 1,
        durationMs: 29_000,
        sourceLapId: validLapTwo.id,
        sourceLapNumber: 2,
      },
      {
        sectorIndex: 2,
        durationMs: 30_000,
        sourceLapId: validLapOne.id,
        sourceLapNumber: 1,
      },
    ],
    cornerContexts: [
      {
        sectorIndex: 1,
        cornerNumber: 1,
        sourceLapId: validLapTwo.id,
        sourceLapNumber: 2,
        entrySpeedMps: 20,
        minimumSpeedMps: 15,
        exitSpeedMps: 22,
        cornerTimeSeconds: 2,
        timeDeltaVsFastestSeconds: 0.1,
        lineClassification: 'wider',
      },
    ],
  },
  analysis_version: CURRENT_ONLYLAPS_ANALYSIS_VERSION,
  model_used: 'gpt-4.1-mini',
  created_at: '2026-07-28T19:00:00.000Z',
  updated_at: '2026-07-28T19:05:00.000Z',
};

type StoreData = {
  onlyfastSession: OnlyFastSessionRow | null;
  links: OnlyFastOnlyLapsLinkRow[];
  onlylapsSession: OnlyLapsTimingSessionRow | null;
  track: OnlyLapsTrackMapRow | null;
  laps: OnlyLapsLapRow[];
  sectors: OnlyLapsSectorRow[];
  analysis: OnlyLapsAnalysisRow | null;
};

function result<T>(data: T): Promise<StoreResult<T>> {
  return Promise.resolve({ data, error: null });
}

function createStore(
  overrides: Partial<StoreData> = {},
  onAnalysisVersion?: (version: string) => void,
): OnlyLapsSetupContextStore {
  const data: StoreData = {
    onlyfastSession,
    links: [link],
    onlylapsSession,
    track,
    laps: [validLapOne, validLapTwo, excludedLap],
    sectors,
    analysis,
    ...overrides,
  };

  return {
    findOwnedOnlyFastSession: () => result(data.onlyfastSession),
    listOwnedLinks: () => result(data.links),
    findOwnedOnlyLapsSession: () => result(data.onlylapsSession),
    findTrackMap: () => result(data.track),
    listOwnedLaps: () => result(data.laps),
    listOwnedSectorRows: () => result(data.sectors),
    findOwnedAnalysis: (_sessionId, _userId, version) => {
      onAnalysisVersion?.(version);
      return result(data.analysis);
    },
  };
}

async function loadContext(store = createStore()) {
  return getOnlyLapsSetupContext({
    onlyfastSessionId,
    store,
    userId: userA,
  });
}

test('fully populated link returns compact lap, sector, corner, and analysis context', async () => {
  const context = await loadContext();
  assert.equal(context.linked, true);
  if (!context.linked) return;

  assert.deepEqual(context.session, {
    onlylaps_session_id: onlylapsSessionId,
    display_name: 'Heat Race',
    track_map_id: trackMapId,
    track_name: 'Barona Speedway',
    track_type: 'dirt_oval',
    track_shape: 'oval',
    track_length: '1/4 mile',
    vehicle_name: 'Dwarf Car 88',
    session_type: 'race',
    session_date: '2026-07-28',
    started_at: '2026-07-28T18:00:00.000Z',
    ended_at: '2026-07-28T18:20:00.000Z',
    duration_ms: 1_200_000,
    recorded_lap_count: 3,
    valid_lap_count: 2,
    excluded_lap_count: 1,
    weather: { temperatureF: 82 },
  });
  assert.deepEqual(context.lap_performance, {
    fastest_lap_ms: 60_000,
    average_lap_ms: 61_000,
    median_lap_ms: 61_000,
    optimum_lap_ms: 59_000,
    lap_time_spread_ms: 2_000,
  });
  assert.deepEqual(context.speed, {
    maximum_mph: 72,
    average_lap_mph: 41,
    minimum_optimum_corner_mps: 15,
  });
  assert.deepEqual(context.g_force, {
    convention: 'vehicle_braking_positive_v2',
    max_abs_lateral_g: 1.5,
    max_abs_longitudinal_g: 0.9,
    max_acceleration_g: 0.6,
    max_braking_g: 0.8,
  });
  assert.deepEqual(
    context.sectors.map((sector) => [
      sector.sector_index,
      sector.best_duration_ms,
      sector.source_lap_number,
      sector.source,
    ]),
    [
      [1, 29_000, 2, 'onlylaps_lap_sector_times'],
      [2, 30_000, 1, 'onlylaps_lap_sector_times'],
    ],
  );
  assert.equal(context.corners[0].corner_number, 1);
  assert.equal(context.corners[0].entry_speed_mps, 20);
  assert.equal(context.corners[0].minimum_speed_mps, 15);
  assert.equal(context.corners[0].time_delta_ms, 150);
  assert.equal(context.corners[0].comparison?.minimum_speed_delta_mph, -2);
  assert.deepEqual(context.corners[0].trajectory, {
    classification: 'meaningfully_wider',
  });
  assert.equal(context.ai_analysis.summary, analysis.summary_text);
  assert.equal(
    context.ai_analysis.analysis_version,
    CURRENT_ONLYLAPS_ANALYSIS_VERSION,
  );
  assert.deepEqual(context.ai_analysis.braking_observations, []);
  assert.deepEqual(context.ai_analysis.setup_relevant_observations, []);
});

test('an owned OnlyFast session with no link returns linked false', async () => {
  const context = await loadContext(createStore({ links: [] }));
  assert.deepEqual(context, {
    schema_version: 'onlyfast_onlylaps_setup_context_v1',
    linked: false,
    onlyfast_session_id: onlyfastSessionId,
  });
});

test('more than one link is reported as an integrity error', async () => {
  await assert.rejects(
    loadContext(
      createStore({
        links: [
          link,
          {
            ...link,
            id: '77777777-7777-4777-8777-777777777777',
            onlylaps_session_id:
              '88888888-8888-4888-8888-888888888888',
          },
        ],
      }),
    ),
    (error: unknown) =>
      error instanceof OnlyLapsSetupContextError &&
      error.code === 'integrity_error',
  );
});

test('a linked session without AI analysis still returns telemetry metrics', async () => {
  const context = await loadContext(createStore({ analysis: null }));
  assert.equal(context.linked, true);
  if (!context.linked) return;
  assert.equal(context.lap_performance.fastest_lap_ms, 60_000);
  assert.equal(context.ai_analysis.summary, null);
  assert.equal(context.ai_analysis.analysis_version, null);
  assert.deepEqual(context.ai_analysis.corner_observations, []);
  assert.deepEqual(context.corners, []);
});

test('persisted optimum sectors are a fallback when sector rows are unavailable', async () => {
  const context = await loadContext(createStore({ sectors: [] }));
  assert.equal(context.linked, true);
  if (!context.linked) return;
  assert.equal(context.lap_performance.optimum_lap_ms, 59_000);
  assert.deepEqual(
    context.sectors.map((sector) => [
      sector.sector_index,
      sector.best_duration_ms,
      sector.source,
    ]),
    [
      [1, 29_000, 'onlylaps_session_analysis'],
      [2, 30_000, 'onlylaps_session_analysis'],
    ],
  );
});

test('partial telemetry returns null and empty optional values without failing', async () => {
  const partialLap: OnlyLapsLapRow = {
    ...validLapOne,
    average_speed: null,
    max_speed: null,
    max_lateral_g: null,
    max_longitudinal_g: null,
    max_accel_g: null,
    max_braking_g: null,
    sector_times_ms: null,
  };
  const partialSession: OnlyLapsTimingSessionRow = {
    ...onlylapsSession,
    track_map_id: null,
    ended_at: null,
    weather: null,
  };
  const context = await loadContext(
    createStore({
      onlylapsSession: partialSession,
      track: null,
      laps: [partialLap],
      sectors: [],
      analysis: null,
    }),
  );
  assert.equal(context.linked, true);
  if (!context.linked) return;
  assert.equal(context.session.track_name, 'Fallback Session Name');
  assert.equal(context.session.duration_ms, null);
  assert.equal(context.speed.maximum_mph, null);
  assert.equal(context.g_force.max_abs_lateral_g, null);
  assert.equal(context.lap_performance.optimum_lap_ms, null);
  assert.deepEqual(context.sectors, []);
  assert.deepEqual(context.corners, []);
});

test('legacy OnlyLaps sessions use the canonical acceleration/braking swap', async () => {
  const legacySession: OnlyLapsTimingSessionRow = {
    ...onlylapsSession,
    device_info: { gForceConvention: 'vehicle_acceleration_positive_v1' },
  };
  const context = await loadContext(
    createStore({ onlylapsSession: legacySession }),
  );
  assert.equal(context.linked, true);
  if (!context.linked) return;
  assert.equal(context.g_force.max_acceleration_g, 0.8);
  assert.equal(context.g_force.max_braking_g, 0.6);
  assert.equal(
    context.g_force.convention,
    'vehicle_braking_positive_v2',
  );
});

test('invalid and caution-excluded laps never contribute to metrics or optimum sectors', async () => {
  const context = await loadContext();
  assert.equal(context.linked, true);
  if (!context.linked) return;
  assert.equal(context.session.excluded_lap_count, 1);
  assert.notEqual(context.speed.maximum_mph, excludedLap.max_speed);
  assert.notEqual(context.lap_performance.average_lap_ms, 74_000);
  assert.equal(context.sectors[1].best_duration_ms, 30_000);
  assert.notEqual(
    context.sectors[1].source_lap_id,
    excludedLap.id,
  );
});

test('ownership mismatches fail closed for OnlyFast, link, OnlyLaps, and lap rows', async (t) => {
  await t.test('another user OnlyFast session', async () => {
    await assert.rejects(
      loadContext(
        createStore({
          onlyfastSession: { ...onlyfastSession, user_id: userB },
        }),
      ),
      (error: unknown) =>
        error instanceof OnlyLapsSetupContextError &&
        error.code === 'ownership_mismatch',
    );
  });

  await t.test('another user link', async () => {
    await assert.rejects(
      loadContext(createStore({ links: [{ ...link, user_id: userB }] })),
      (error: unknown) =>
        error instanceof OnlyLapsSetupContextError &&
        error.code === 'ownership_mismatch',
    );
  });

  await t.test('another user OnlyLaps session', async () => {
    await assert.rejects(
      loadContext(
        createStore({
          onlylapsSession: { ...onlylapsSession, user_id: userB },
        }),
      ),
      (error: unknown) =>
        error instanceof OnlyLapsSetupContextError &&
        error.code === 'ownership_mismatch',
    );
  });

  await t.test('another user lap row', async () => {
    await assert.rejects(
      loadContext(
        createStore({
          laps: [{ ...validLapOne, user_id: userB }],
        }),
      ),
      (error: unknown) =>
        error instanceof OnlyLapsSetupContextError &&
      error.code === 'ownership_mismatch',
    );
  });

  await t.test('another user private track map', async () => {
    await assert.rejects(
      loadContext(
        createStore({
          track: {
            ...track,
            user_id: userB,
            created_by: userB,
            is_active: false,
          },
        }),
      ),
      (error: unknown) =>
        error instanceof OnlyLapsSetupContextError &&
        error.code === 'ownership_mismatch',
    );
  });
});

test('malformed OnlyFast IDs are rejected before any store query', async () => {
  let queryCount = 0;
  const store = createStore();
  const guardedStore = Object.fromEntries(
    Object.entries(store).map(([key]) => [
      key,
      async () => {
        queryCount += 1;
        throw new Error('Store must not be called');
      },
    ]),
  ) as unknown as OnlyLapsSetupContextStore;

  await assert.rejects(
    getOnlyLapsSetupContext({
      onlyfastSessionId: '../../another-user-session',
      store: guardedStore,
      userId: userA,
    }),
    (error: unknown) =>
      error instanceof OnlyLapsSetupContextError &&
      error.code === 'invalid_session_id',
  );
  assert.equal(queryCount, 0);
});

test('reader requests exactly the current persisted analysis version', async () => {
  let requestedVersion: string | null = null;
  const context = await loadContext(
    createStore({}, (version) => {
      requestedVersion = version;
    }),
  );
  assert.equal(context.linked, true);
  assert.equal(requestedVersion, CURRENT_ONLYLAPS_ANALYSIS_VERSION);
});

test('edge reader verifies JWT ownership and never queries raw telemetry samples', () => {
  const edgeFunction = readFileSync(
    new URL(
      '../supabase/functions/get-onlylaps-setup-context/index.ts',
      import.meta.url,
    ),
    'utf8',
  );
  const store = readFileSync(
    new URL(
      '../supabase/functions/_shared/onlylaps-setup-context-store.ts',
      import.meta.url,
    ),
    'utf8',
  );
  assert.match(edgeFunction, /authClient\.auth\.getUser\(token\)/);
  assert.match(
    edgeFunction,
    /hasBetaFeatureForUser\([\s\S]*test_account_full_access[\s\S]*experimental/,
  );
  assert.ok(
    (store.match(/\.eq\('user_id', userId\)/g) ?? []).length >= 6,
  );
  assert.doesNotMatch(
    `${edgeFunction}\n${store}`,
    /\.from\('onlylaps_telemetry_samples'\)/,
  );
  assert.doesNotMatch(edgeFunction, /OPENAI_API_KEY|api\.openai\.com/);
});
